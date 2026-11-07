import {
  type CalendarDate,
  compareCalendarDates,
  formatIsoDate,
  parseGermanDate,
} from './dates.js';
import { MIN_BIRTH_YEAR } from './age.js';

/**
 * Auswertung des OCR-Texts einer Thoska (Datenbereich mit den Zeilen
 * "geb. 27.07.1994" und "Matrikel-Nr. 53902").
 *
 * Achtung: Auf der Karte steht im wiederbeschreibbaren Bereich ein zweites Datum
 * ("Semesterticket gültig bis 30.09.2018"). Ein Datum nach "bis" ist nie das Geburtsdatum.
 */

const GEB_RE = /geb\W{0,3}(\d{2}[.,\s]?\d{2}[.,\s]?\d{4})(?!\d)/i;
const NR_RE = /Nr\W{0,3}(\d{5})(?!\d)/i;
const DATE_RE = /(?<!\d)(\d{2}[.,\s]?\d{2}[.,\s]?\d{4})(?!\d)/g;
const MATRIKEL_RE = /(?<!\d)\d{5}(?!\d)/g;

export interface ThoskaOcrResult {
  /** Eindeutig erkannte Matrikelnummer oder null */
  matrikel: string | null;
  /** Eindeutig erkanntes Geburtsdatum (YYYY-MM-DD) oder null */
  birthDate: string | null;
  /** Alle Kandidaten (zur Diagnose) */
  matrikelCandidates: string[];
  birthDateCandidates: string[];
  /** Welche Anker gefunden wurden */
  anchors: { geb: boolean; nr: boolean };
}

function plausibleBirthDate(d: CalendarDate | null, today: CalendarDate): d is CalendarDate {
  return !!d && d.year >= MIN_BIRTH_YEAR && compareCalendarDates(d, today) <= 0;
}

export function parseThoskaText(text: string, today: CalendarDate): ThoskaOcrResult {
  const geb = GEB_RE.exec(text);
  const gebDate = geb ? parseGermanDate(geb[1]!) : null;
  const nr = NR_RE.exec(text);

  let birthDateCandidates: string[];
  if (plausibleBirthDate(gebDate, today)) {
    birthDateCandidates = [formatIsoDate(gebDate)];
  } else {
    const found = new Set<string>();
    for (const m of text.matchAll(DATE_RE)) {
      const before = text.slice(Math.max(0, m.index - 8), m.index);
      if (/bis\W*$/i.test(before)) continue;
      const d = parseGermanDate(m[1]!);
      if (plausibleBirthDate(d, today)) found.add(formatIsoDate(d));
    }
    birthDateCandidates = [...found];
  }

  const matrikelCandidates = nr ? [nr[1]!] : [...new Set(text.match(MATRIKEL_RE) ?? [])];

  return {
    matrikel: matrikelCandidates.length === 1 ? matrikelCandidates[0]! : null,
    birthDate: birthDateCandidates.length === 1 ? birthDateCandidates[0]! : null,
    matrikelCandidates,
    birthDateCandidates,
    anchors: { geb: plausibleBirthDate(gebDate, today), nr: !!nr },
  };
}

/** Abstimmung über mehrere Frames: häufigster Wert, wenn er mindestens `need`-mal vorkommt. */
export function majorityVote<T>(values: readonly (T | null | undefined)[], need: number): T | null {
  const counts = new Map<T, number>();
  for (const v of values) if (v != null) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | null = null;
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return bestCount >= need ? best : null;
}

/**
 * Datenbereich der Thoska (Zeilen "geb." und "Matrikel-Nr.") relativ zur Karte im Querformat,
 * vermessen an einem Foto (siehe konzept/08). Name, Foto und Semesterticket liegen außerhalb.
 */
export const THOSKA_DATA_ROI = { x: 0.4, y: 0.36, w: 0.46, h: 0.3 } as const;

/** Seitenverhältnis einer Scheckkarte (ISO/IEC 7810 ID-1) */
export const CARD_ASPECT_RATIO = 85.6 / 54;

/** Stabilisierung der Live-Erkennung (Werte aus dem M1-Prototyp). */
export const OCR_STABILIZATION = {
  window: 15,
  matrikelHits: 3,
  birthDateHits: 2,
} as const;
