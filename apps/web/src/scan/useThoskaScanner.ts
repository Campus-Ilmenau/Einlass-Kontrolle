import {
  calendarDateInTimeZone,
  majorityVote,
  OCR_STABILIZATION,
  parseThoskaText,
  THOSKA_DATA_ROI,
} from '@einlass/shared';
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { getOcrWorker, preprocess } from './ocr';

export interface ScanHit {
  matrikelnummer: string;
  /** YYYY-MM-DD */
  birthDate: string;
}

export interface ScannerProgress {
  /** OCR lädt (0–1) bzw. null, wenn bereit */
  loading: number | null;
  matrikel: string | null;
  birthDate: string | null;
  error: string | null;
}

/** Schneidet den Datenbereich der Karte aus dem Videobild (object-fit: cover berücksichtigt). */
export function grabDataRegion(
  video: HTMLVideoElement,
  frame: HTMLElement,
): HTMLCanvasElement | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const box = video.getBoundingClientRect();
  const fr = frame.getBoundingClientRect();
  const scale = Math.max(box.width / vw, box.height / vh);
  const offX = (vw * scale - box.width) / 2;
  const offY = (vh * scale - box.height) / 2;
  const cardX = (fr.left - box.left + offX) / scale;
  const cardY = (fr.top - box.top + offY) / scale;
  const cardW = fr.width / scale;
  const cardH = fr.height / scale;

  const sx = cardX + cardW * THOSKA_DATA_ROI.x;
  const sy = cardY + cardH * THOSKA_DATA_ROI.y;
  const sw = cardW * THOSKA_DATA_ROI.w;
  const sh = cardH * THOSKA_DATA_ROI.h;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(sw));
  c.height = Math.max(1, Math.round(sh));
  c.getContext('2d')!.drawImage(video, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c;
}

/**
 * Live-Erkennung: liest Bild für Bild den Datenbereich, stimmt Matrikelnummer und Geburtsdatum
 * getrennt über die letzten Bilder ab und meldet ein Ergebnis, sobald beide sicher sind.
 */
export function useThoskaScanner(
  videoRef: RefObject<HTMLVideoElement | null>,
  frameRef: RefObject<HTMLElement | null>,
  active: boolean,
  onHit: (hit: ScanHit) => void,
) {
  const [progress, setProgress] = useState<ScannerProgress>({
    loading: 0,
    matrikel: null,
    birthDate: null,
    error: null,
  });
  const onHitRef = useRef(onHit);
  onHitRef.current = onHit;
  const runId = useRef(0);

  const reset = useCallback(() => {
    setProgress((p) => ({ ...p, matrikel: null, birthDate: null }));
  }, []);

  useEffect(() => {
    if (!active) return;
    const id = ++runId.current;
    const alive = () => runId.current === id;
    const mHist: (string | null)[] = [];
    const dHist: (string | null)[] = [];
    let frameNo = 0;

    void (async () => {
      let worker;
      try {
        worker = await getOcrWorker((p) => alive() && setProgress((s) => ({ ...s, loading: p })));
      } catch {
        if (alive())
          setProgress((s) => ({ ...s, error: 'Texterkennung konnte nicht geladen werden' }));
        return;
      }
      if (alive()) setProgress((s) => ({ ...s, loading: null, error: null }));

      while (alive()) {
        const video = videoRef.current;
        const frame = frameRef.current;
        const region = video && frame ? grabDataRegion(video, frame) : null;
        if (!region) {
          await new Promise((r) => setTimeout(r, 150));
          continue;
        }
        frameNo++;
        const { data } = await worker.recognize(preprocess(region, frameNo % 2 === 1));
        if (!alive()) return;

        const r = parseThoskaText(data.text, calendarDateInTimeZone(new Date()));
        mHist.push(r.matrikel);
        dHist.push(r.birthDate);
        if (mHist.length > OCR_STABILIZATION.window) mHist.shift();
        if (dHist.length > OCR_STABILIZATION.window) dHist.shift();
        const m = majorityVote(mHist, OCR_STABILIZATION.matrikelHits);
        const d = majorityVote(dHist, OCR_STABILIZATION.birthDateHits);
        setProgress((s) => ({ ...s, matrikel: m, birthDate: d }));

        if (m && d) {
          runId.current++; // Schleife beenden
          onHitRef.current({ matrikelnummer: m, birthDate: d });
          return;
        }
      }
    })();

    return () => {
      runId.current++;
    };
  }, [active, videoRef, frameRef]);

  return { progress, reset };
}
