import {
  type CalendarDate,
  calendarDateInTimeZone,
  compareCalendarDates,
  DEFAULT_TIME_ZONE,
  isValidCalendarDate,
} from './dates.js';

export const AGE_GROUPS = ['U16', 'U18', 'ADULT'] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

/** Älteste plausible Geburtsjahre für Studierende. */
export const MIN_BIRTH_YEAR = 1930;

/**
 * Alter in vollendeten Lebensjahren am Stichtag.
 *
 * Nach §§ 187 Abs. 2, 188 Abs. 2 BGB ist ein Lebensjahr mit Ablauf des Vortags des Geburtstags
 * vollendet. Am Geburtstag selbst gilt man also schon als älter. Wer am 29.02. geboren ist, wird in
 * Nicht-Schaltjahren am 01.03. älter (Lebensjahr endet mit Ablauf des 28.02.). Der einfache
 * Monat/Tag-Vergleich bildet beides korrekt ab.
 */
export function ageOn(birthDate: CalendarDate, onDate: CalendarDate): number {
  let age = onDate.year - birthDate.year;
  const hadBirthday =
    onDate.month > birthDate.month ||
    (onDate.month === birthDate.month && onDate.day >= birthDate.day);
  if (!hadBirthday) age--;
  return age;
}

export function ageGroupFor(age: number): AgeGroup {
  if (age < 16) return 'U16';
  if (age < 18) return 'U18';
  return 'ADULT';
}

export type BirthDateProblem = 'INVALID_DATE' | 'IN_FUTURE' | 'TOO_OLD';

/** Prüft ein Geburtsdatum auf Plausibilität. Gibt `null` zurück, wenn es in Ordnung ist. */
export function checkBirthDate(
  birthDate: CalendarDate,
  today: CalendarDate,
): BirthDateProblem | null {
  if (!isValidCalendarDate(birthDate)) return 'INVALID_DATE';
  if (compareCalendarDates(birthDate, today) > 0) return 'IN_FUTURE';
  if (birthDate.year < MIN_BIRTH_YEAR) return 'TOO_OLD';
  return null;
}

export interface AgeResult {
  age: number;
  ageGroup: AgeGroup;
  /** Stichtag, an dem gerechnet wurde (lokales Datum in der Zeitzone) */
  today: CalendarDate;
}

/** Alter und Altersgruppe zu einem Zeitpunkt, bezogen auf das lokale Datum (Standard: Europe/Berlin). */
export function ageAt(birthDate: CalendarDate, now: Date, timeZone = DEFAULT_TIME_ZONE): AgeResult {
  const today = calendarDateInTimeZone(now, timeZone);
  const age = ageOn(birthDate, today);
  return { age, ageGroup: ageGroupFor(age), today };
}
