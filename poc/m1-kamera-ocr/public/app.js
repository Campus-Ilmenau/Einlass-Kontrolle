/* M1-Prototyp: Kamera über self-signed HTTPS + OCR der Thoska (Wegwerf-Code). */
/* global Tesseract */
'use strict';

const $ = (sel) => document.querySelector(sel);
const video = $('#video');
const frameEl = $('#frame');
const preview = $('#preview');
const logEl = $('#log');

const MATRIKEL_RE = /(?<!\d)\d{5}(?!\d)/g;
// TT.MM.JJJJ – Punkte werden von der OCR oft verschluckt oder als Komma/Leerzeichen gelesen
const DATE_RE = /(?<!\d)(\d{2})[.,\s]?(\d{2})[.,\s]?(\d{4})(?!\d)/g;
// Stabilisierung je Feld innerhalb eines gleitenden Fensters (nicht zwingend hintereinander)
const WINDOW = 15;
const NEED_MATRIKEL = 3;
const NEED_DATE = 2;

let stream = null;
let track = null;
let torchOn = false;
let worker = null;
let workerLoading = null;
let liveRunning = false;

// ───────────────────────── Protokoll ─────────────────────────
function log(msg) {
  const t = new Date().toLocaleTimeString('de-DE');
  logEl.textContent = `[${t}] ${msg}\n` + logEl.textContent;
}

$('#btn-clear').onclick = () => (logEl.textContent = '');
$('#btn-copy').onclick = async () => {
  const report = [
    `Gerät: ${navigator.userAgent}`,
    `Secure Context: ${window.isSecureContext}`,
    `Kamera: ${$('#cam-info').textContent}`,
    '',
    logEl.textContent,
  ].join('\n');
  try {
    await navigator.clipboard.writeText(report);
    log('Bericht in Zwischenablage kopiert');
  } catch (e) {
    log('Kopieren fehlgeschlagen: ' + e.message);
  }
};

// ───────────────────────── 1 · Umgebung ─────────────────────────
function checks() {
  const list = $('#checklist');
  const add = (cls, text) => {
    const li = document.createElement('li');
    li.className = cls;
    li.textContent = text;
    list.appendChild(li);
  };
  add(location.protocol === 'https:' ? 'ok' : 'err', `Protokoll: ${location.protocol}`);
  add(
    window.isSecureContext ? 'ok' : 'err',
    `Sicherer Kontext (nötig für Kamera): ${window.isSecureContext}`,
  );
  add(navigator.mediaDevices?.getUserMedia ? 'ok' : 'err', 'getUserMedia verfügbar');
  add(typeof WebAssembly === 'object' ? 'ok' : 'err', 'WebAssembly verfügbar (für OCR)');
  add('info', `Gerätezeit: ${new Date().toLocaleString('de-DE')}`);
  add('info', navigator.userAgent);
  log(`Start: secure=${window.isSecureContext}, ${navigator.userAgent}`);
}

// ───────────────────────── 2 · Kamera ─────────────────────────
$('#btn-start').onclick = async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    });
  } catch (e) {
    log(`Kamera-Fehler: ${e.name} – ${e.message}`);
    $('#cam-info').textContent = `Fehler: ${e.name}`;
    return;
  }
  track = stream.getVideoTracks()[0];
  video.srcObject = stream;
  $('#viewer').hidden = false;
  await video.play();

  const s = track.getSettings();
  const caps = track.getCapabilities ? track.getCapabilities() : {};
  $('#cam-info').textContent = `${s.width}×${s.height} @ ${Math.round(s.frameRate || 0)} fps, ${
    s.facingMode || 'facingMode ?'
  }, Licht: ${caps.torch ? 'ja' : 'nein'}`;
  log(`Kamera läuft: ${$('#cam-info').textContent}`);

  $('#btn-torch').hidden = !caps.torch;
  $('#btn-stop').hidden = false;
  $('#btn-start').hidden = true;
  $('#btn-snap').disabled = false;
  $('#btn-live').disabled = false;
};

$('#btn-stop').onclick = () => {
  stopLive();
  stream?.getTracks().forEach((t) => t.stop());
  stream = track = null;
  $('#viewer').hidden = true;
  $('#btn-torch').hidden = $('#btn-stop').hidden = true;
  $('#btn-start').hidden = false;
  $('#btn-snap').disabled = $('#btn-live').disabled = true;
};

$('#btn-torch').onclick = async () => {
  torchOn = !torchOn;
  try {
    await track.applyConstraints({ advanced: [{ torch: torchOn }] });
    $('#btn-torch').textContent = torchOn ? 'Licht aus' : 'Licht an';
  } catch (e) {
    log('Licht nicht schaltbar: ' + e.message);
  }
};

/** Schneidet den Bereich des Kartenrahmens aus dem Videobild (object-fit: cover berücksichtigt). */
function grabFrameRegion() {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const box = video.getBoundingClientRect();
  const fr = frameEl.getBoundingClientRect();
  const scale = Math.max(box.width / vw, box.height / vh);
  const offX = (vw * scale - box.width) / 2;
  const offY = (vh * scale - box.height) / 2;
  const sx = (fr.left - box.left + offX) / scale;
  const sy = (fr.top - box.top + offY) / scale;
  const sw = fr.width / scale;
  const sh = fr.height / scale;

  const c = document.createElement('canvas');
  c.width = Math.round(sw);
  c.height = Math.round(sh);
  c.getContext('2d').drawImage(video, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c;
}

// ───────────────────────── 3 · Vorverarbeitung + OCR ─────────────────────────
/** Graustufen, Kontrast strecken, optional Otsu-Schwellwert. Skaliert auf ~1600 px Breite. */
function preprocess(src, useThreshold) {
  const targetW = Math.min(1600, Math.max(1000, src.width));
  const scale = targetW / src.width;
  preview.width = Math.round(src.width * scale);
  preview.height = Math.round(src.height * scale);
  const ctx = preview.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0, preview.width, preview.height);
  const img = ctx.getImageData(0, 0, preview.width, preview.height);
  const d = img.data;

  const gray = new Uint8ClampedArray(d.length / 4);
  let min = 255;
  let max = 0;
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    gray[j] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = Math.max(1, max - min);
  for (let j = 0; j < gray.length; j++) gray[j] = ((gray[j] - min) * 255) / range;

  let threshold = -1;
  if (useThreshold) threshold = otsu(gray);

  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const v = threshold < 0 ? gray[j] : gray[j] > threshold ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return preview;
}

function otsu(gray) {
  const hist = new Array(256).fill(0);
  for (const g of gray) hist[g | 0]++;
  const total = gray.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

async function getWorker() {
  if (worker) return worker;
  if (workerLoading) return workerLoading;
  const t0 = performance.now();
  $('#ocr-status').textContent = 'OCR wird geladen …';
  workerLoading = Tesseract.createWorker('eng', 1, {
    workerPath: 'vendor/tesseract/worker.min.js',
    corePath: 'vendor/tesseract/core',
    langPath: 'vendor/tesseract/lang',
    gzip: true,
    workerBlobURL: false,
    logger: (m) => {
      if (m.status && m.progress < 1) {
        $('#ocr-status').textContent = `${m.status} ${Math.round(m.progress * 100)} %`;
      }
    },
  }).then(async (w) => {
    await w.setParameters({
      tessedit_char_whitelist: '0123456789.,',
      tessedit_pageseg_mode: '11', // sparse text: einzelne Textblöcke irgendwo auf der Karte
    });
    worker = w;
    const ms = Math.round(performance.now() - t0);
    $('#ocr-status').textContent = `OCR bereit (geladen in ${ms} ms)`;
    log(`OCR geladen in ${ms} ms`);
    return w;
  });
  return workerLoading;
}

function parse(text) {
  const matrikel = [...new Set(text.match(MATRIKEL_RE) || [])];
  const now = new Date();
  const dates = [];
  for (const m of text.matchAll(DATE_RE)) {
    const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const dt = new Date(year, month - 1, day);
    const valid =
      dt.getFullYear() === year &&
      dt.getMonth() === month - 1 &&
      dt.getDate() === day &&
      year >= 1930 &&
      dt <= now;
    if (valid) {
      dates.push(`${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`);
    }
  }
  return { matrikel, dates: [...new Set(dates)] };
}

async function recognize(source, label, useThreshold = $('#opt-threshold').checked) {
  const w = await getWorker();
  const t0 = performance.now();
  const input = preprocess(source, useThreshold);
  const { data } = await w.recognize(input);
  const ms = Math.round(performance.now() - t0);
  const { matrikel, dates } = parse(data.text);

  $('#result').hidden = false;
  $('#result').classList.toggle('partial', !(matrikel.length && dates.length));
  $('#r-matrikel').textContent = matrikel.join(' / ') || '–';
  $('#r-date').textContent = dates.join(' / ') || '–';
  $('#r-time').textContent = `${ms} ms`;
  $('#r-raw').textContent =
    `Konfidenz: ${Math.round(data.confidence)} %\n\n${data.text.trim()}\n\n` +
    `Matrikel-Kandidaten: ${matrikel.join(', ') || '–'}\nDatum-Kandidaten: ${dates.join(', ') || '–'}`;
  const mode = useThreshold ? 'S/W' : 'Grau';
  const raw = dates.length ? '' : ` Roh="${data.text.trim().replace(/\s+/g, ' ').slice(0, 80)}"`;
  log(`${label} [${mode}]: ${ms} ms, Matrikel=[${matrikel}] Datum=[${dates}]${raw}`);
  return { matrikel, dates, ms };
}

$('#btn-snap').onclick = async () => {
  $('#btn-snap').disabled = true;
  try {
    await recognize(grabFrameRegion(), 'Einzelbild');
  } catch (e) {
    log('OCR-Fehler: ' + e.message);
  } finally {
    $('#btn-snap').disabled = false;
  }
};

$('#file').onchange = async (ev) => {
  const file = ev.target.files?.[0];
  if (!file) return;
  const bmp = await createImageBitmap(file);
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext('2d').drawImage(bmp, 0, 0);
  try {
    await recognize(c, `Foto ${file.name}`);
  } catch (e) {
    log('OCR-Fehler: ' + e.message);
  }
  ev.target.value = '';
};

// ───────────────────────── Live-Erkennung mit Stabilisierung ─────────────────────────
$('#btn-live').onclick = () => (liveRunning ? stopLive() : startLive());

function stopLive() {
  liveRunning = false;
  $('#btn-live').textContent = 'Live-Erkennung';
  $('#btn-live').classList.remove('active');
}

/** Häufigster Wert im Fenster, wenn er oft genug vorkommt – sonst null. */
function vote(values, need) {
  const counts = new Map();
  for (const v of values) if (v) counts.set(v, (counts.get(v) || 0) + 1);
  let best = null;
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return bestCount >= need ? best : null;
}

async function startLive() {
  liveRunning = true;
  const mHist = [];
  const dHist = [];
  frameEl.classList.remove('found');
  $('#btn-live').textContent = 'Live stoppen';
  $('#btn-live').classList.add('active');
  const t0 = performance.now();
  let frames = 0;
  let matrikelAt = null;
  log('Live-Erkennung gestartet (abwechselnd S/W und Grau)');

  while (liveRunning && stream) {
    frames++;
    let r;
    try {
      // abwechselnd mit und ohne Schwellwert – je nach Licht klappt mal das eine, mal das andere
      r = await recognize(grabFrameRegion(), `Live #${frames}`, frames % 2 === 1);
    } catch (e) {
      log('OCR-Fehler: ' + e.message);
      break;
    }
    // Nur eindeutige Lesungen zählen
    mHist.push(r.matrikel.length === 1 ? r.matrikel[0] : null);
    dHist.push(r.dates.length === 1 ? r.dates[0] : null);
    if (mHist.length > WINDOW) mHist.shift();
    if (dHist.length > WINDOW) dHist.shift();

    const m = vote(mHist, NEED_MATRIKEL);
    const d = vote(dHist, NEED_DATE);
    const elapsed = Math.round(performance.now() - t0);
    if (m && matrikelAt === null) matrikelAt = elapsed;
    $('#ocr-status').textContent = `Matrikel: ${m ? '✓ ' + m : '…'} · Datum: ${d ? '✓ ' + d : '…'}`;

    if (m && d) {
      frameEl.classList.add('found');
      navigator.vibrate?.(150);
      log(
        `✅ STABIL nach ${frames} Frames / ${elapsed} ms (Matrikel schon nach ${matrikelAt} ms): ${m} · ${d}`,
      );
      $('#ocr-status').textContent =
        `✅ ${m} · ${d} – stabil in ${(elapsed / 1000).toFixed(1)} s (${frames} Frames)`;
      break;
    }
  }
  stopLive();
}

checks();
