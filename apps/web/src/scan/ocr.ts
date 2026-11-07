import type { Worker } from 'tesseract.js';

/**
 * Texterkennung im Browser (Tesseract.js, WASM, im Web Worker). Alle Dateien kommen vom Pi
 * (public/ocr), es wird nichts aus dem Internet geladen. Der Worker wird nur einmal erzeugt.
 */
let workerPromise: Promise<Worker> | null = null;

export function getOcrWorker(onProgress?: (p: number) => void): Promise<Worker> {
  workerPromise ??= (async () => {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng', 1 /* OEM: nur LSTM */, {
      workerPath: '/ocr/worker.min.js',
      corePath: '/ocr/core',
      langPath: '/ocr/lang',
      gzip: true,
      workerBlobURL: false,
      logger: (m) => {
        if (m.status?.startsWith('loading') && typeof m.progress === 'number')
          onProgress?.(m.progress);
      },
    });
    await worker.setParameters({
      // Datenbereich: zusammenhängender Textblock (PSM 6). Buchstaben nur für die Anker "geb." / "Matrikel-Nr."
      tessedit_pageseg_mode: '6' as never,
      tessedit_char_whitelist: '0123456789.,-gebMatrikelNr',
    });
    return worker;
  })().catch((err: unknown) => {
    workerPromise = null;
    throw err;
  });
  return workerPromise;
}

/** Graustufen + Kontrast strecken, optional Otsu-Schwellwert. Ergebnis mind. 1000 px breit. */
export function preprocess(src: HTMLCanvasElement, threshold: boolean): HTMLCanvasElement {
  const targetW = Math.min(1600, Math.max(1000, src.width));
  const scale = targetW / src.width;
  const out = document.createElement('canvas');
  out.width = Math.round(src.width * scale);
  out.height = Math.round(src.height * scale);
  const ctx = out.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, out.width, out.height);
  const img = ctx.getImageData(0, 0, out.width, out.height);
  const d = img.data;

  const gray = new Uint8ClampedArray(d.length / 4);
  let min = 255;
  let max = 0;
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const g = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
    gray[j] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = Math.max(1, max - min);
  for (let j = 0; j < gray.length; j++) gray[j] = ((gray[j]! - min) * 255) / range;

  const t = threshold ? otsu(gray) : -1;
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const v = t < 0 ? gray[j]! : gray[j]! > t ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

function otsu(gray: Uint8ClampedArray): number {
  const hist = new Array<number>(256).fill(0);
  for (const g of gray) hist[g]!++;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t]!;
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]!;
    if (!wB) continue;
    const wF = gray.length - wB;
    if (!wF) break;
    sumB += t * hist[t]!;
    const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}
