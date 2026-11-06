import { describe, expect, it } from 'vitest';
import {
  calendarDateInTimeZone,
  formatGermanDate,
  formatIsoDate,
  isValidCalendarDate,
  parseGermanDate,
  parseIsoDate,
} from './dates.js';

describe('parseGermanDate', () => {
  it.each(['27.07.1994', '27,07.1994', '27 07 1994', '27071994', ' 27.07.1994 '])(
    'liest %j',
    (s) => {
      expect(parseGermanDate(s)).toEqual({ year: 1994, month: 7, day: 27 });
    },
  );

  it.each(['31.02.2000', '7.7.1994', '27.07.94', '27.13.1994', 'abc', ''])('lehnt %j ab', (s) => {
    expect(parseGermanDate(s)).toBeNull();
  });
});

describe('parseIsoDate', () => {
  it('liest YYYY-MM-DD', () => {
    expect(parseIsoDate('2008-02-29')).toEqual({ year: 2008, month: 2, day: 29 });
  });

  it('lehnt ungültige Daten ab', () => {
    expect(parseIsoDate('2007-02-29')).toBeNull();
    expect(parseIsoDate('2007-2-1')).toBeNull();
  });
});

describe('Formatierung', () => {
  const date = { year: 1994, month: 7, day: 3 };
  it('ISO', () => expect(formatIsoDate(date)).toBe('1994-07-03'));
  it('deutsch', () => expect(formatGermanDate(date)).toBe('03.07.1994'));
});

describe('isValidCalendarDate', () => {
  it('Schaltjahre', () => {
    expect(isValidCalendarDate({ year: 2000, month: 2, day: 29 })).toBe(true);
    expect(isValidCalendarDate({ year: 1900, month: 2, day: 29 })).toBe(false);
    expect(isValidCalendarDate({ year: 2024, month: 2, day: 29 })).toBe(true);
  });
});

describe('calendarDateInTimeZone', () => {
  it('liefert das Berliner Datum', () => {
    expect(calendarDateInTimeZone(new Date('2026-12-31T23:30:00Z'))).toEqual({
      year: 2027,
      month: 1,
      day: 1,
    });
  });
});
