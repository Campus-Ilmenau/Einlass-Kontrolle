/** Kalenderdatum ohne Uhrzeit und Zeitzone. */
export interface CalendarDate {
  year: number;
  /** 1–12 */
  month: number;
  /** 1–31 */
  day: number;
}

export const DEFAULT_TIME_ZONE = 'Europe/Berlin';

export function isValidCalendarDate({ year, month, day }: CalendarDate): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/** Vergleich: negativ, wenn a vor b liegt. */
export function compareCalendarDates(a: CalendarDate, b: CalendarDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

const pad = (n: number, len = 2) => String(n).padStart(len, '0');

/** `YYYY-MM-DD` (für API und Datenbank). */
export function formatIsoDate(d: CalendarDate): string {
  return `${pad(d.year, 4)}-${pad(d.month)}-${pad(d.day)}`;
}

/** `TT.MM.JJJJ` (Anzeige, Aufdruck auf der Thoska). */
export function formatGermanDate(d: CalendarDate): string {
  return `${pad(d.day)}.${pad(d.month)}.${pad(d.year, 4)}`;
}

/** Liest `YYYY-MM-DD`. Gibt `null` bei ungültigem Format oder Datum zurück. */
export function parseIsoDate(value: string): CalendarDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  return isValidCalendarDate(d) ? d : null;
}

/**
 * Liest `TT.MM.JJJJ`. Toleriert, was die OCR typischerweise liefert:
 * Komma oder Leerzeichen statt Punkt oder fehlende Punkte (`27071994`).
 */
export function parseGermanDate(value: string): CalendarDate | null {
  const m = /^(\d{2})[.,\s]?(\d{2})[.,\s]?(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const d = { year: Number(m[3]), month: Number(m[2]), day: Number(m[1]) };
  return isValidCalendarDate(d) ? d : null;
}

/** Kalenderdatum eines Zeitpunkts in einer Zeitzone (Standard: Europe/Berlin). */
export function calendarDateInTimeZone(instant: Date, timeZone = DEFAULT_TIME_ZONE): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}
