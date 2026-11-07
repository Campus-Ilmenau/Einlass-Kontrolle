import dayjs from 'dayjs';

/** 07.11.2026, 21:30 */
export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? dayjs(iso).format('DD.MM.YYYY, HH:mm') : '–';

/** Fr 07.11., 21:30 */
export const fmtShort = (iso: string) => dayjs(iso).format('dd DD.MM., HH:mm');

/** 21:30 */
export const fmtTime = (iso: string) => dayjs(iso).format('HH:mm');

/** Zeitraum einer Veranstaltung: "Fr 07.11., 21:00 – 05:00" bzw. mit Datum, wenn mehrtägig */
export function fmtRange(startIso: string, endIso: string): string {
  const start = dayjs(startIso);
  const end = dayjs(endIso);
  const sameNight = end.diff(start, 'hour') < 24;
  return `${fmtShort(startIso)} – ${sameNight ? end.format('HH:mm') : fmtShort(endIso)}`;
}

/** Gut abtippbares Zufallspasswort (ohne 0/O, 1/l/I) */
export function randomPassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (v) => chars[v % chars.length]).join('');
}
