import { describe, expect, it } from 'vitest';
import { ageAt, ageGroupFor, ageOn, checkBirthDate } from './age.js';

const d = (year: number, month: number, day: number) => ({ year, month, day });

describe('ageOn', () => {
  it('rechnet vollendete Lebensjahre', () => {
    expect(ageOn(d(1994, 7, 27), d(2026, 11, 6))).toBe(32);
  });

  it('am Tag vor dem Geburtstag noch jünger', () => {
    expect(ageOn(d(2008, 11, 7), d(2026, 11, 6))).toBe(17);
  });

  it('am Geburtstag bereits älter', () => {
    expect(ageOn(d(2008, 11, 6), d(2026, 11, 6))).toBe(18);
  });

  it('am Tag nach dem Geburtstag älter', () => {
    expect(ageOn(d(2008, 11, 5), d(2026, 11, 6))).toBe(18);
  });

  describe('Geburtstag am 29.02.', () => {
    const birth = d(2008, 2, 29);

    it('im Nicht-Schaltjahr am 28.02. noch nicht 18', () => {
      expect(ageOn(birth, d(2026, 2, 28))).toBe(17);
    });

    it('im Nicht-Schaltjahr am 01.03. 18', () => {
      expect(ageOn(birth, d(2026, 3, 1))).toBe(18);
    });

    it('im Schaltjahr am 29.02. älter', () => {
      expect(ageOn(d(2012, 2, 29), d(2028, 2, 29))).toBe(16);
      expect(ageOn(d(2012, 2, 29), d(2028, 2, 28))).toBe(15);
    });
  });

  it('am Jahreswechsel', () => {
    expect(ageOn(d(2008, 1, 1), d(2025, 12, 31))).toBe(17);
    expect(ageOn(d(2008, 1, 1), d(2026, 1, 1))).toBe(18);
  });
});

describe('ageGroupFor', () => {
  it.each([
    [0, 'U16'],
    [15, 'U16'],
    [16, 'U18'],
    [17, 'U18'],
    [18, 'ADULT'],
    [65, 'ADULT'],
  ] as const)('%i → %s', (age, group) => {
    expect(ageGroupFor(age)).toBe(group);
  });
});

describe('checkBirthDate', () => {
  const today = d(2026, 11, 6);

  it('akzeptiert plausible Daten', () => {
    expect(checkBirthDate(d(1994, 7, 27), today)).toBeNull();
    expect(checkBirthDate(today, today)).toBeNull();
  });

  it('lehnt ungültige Daten ab', () => {
    expect(checkBirthDate(d(2001, 2, 29), today)).toBe('INVALID_DATE');
    expect(checkBirthDate(d(2001, 13, 1), today)).toBe('INVALID_DATE');
    expect(checkBirthDate(d(2001, 4, 31), today)).toBe('INVALID_DATE');
  });

  it('lehnt Daten in der Zukunft ab', () => {
    expect(checkBirthDate(d(2026, 11, 7), today)).toBe('IN_FUTURE');
  });

  it('lehnt zu alte Daten ab', () => {
    expect(checkBirthDate(d(1929, 12, 31), today)).toBe('TOO_OLD');
  });
});

describe('ageAt (Zeitzone Europe/Berlin)', () => {
  const birth = d(2008, 11, 7);

  it('23:30 Uhr am Vortag (Berlin) → noch 17, obwohl UTC schon …', () => {
    // 06.11.2026 23:30 MEZ = 22:30 UTC
    expect(ageAt(birth, new Date('2026-11-06T22:30:00Z'))).toMatchObject({
      age: 17,
      ageGroup: 'U18',
    });
  });

  it('00:30 Uhr am Geburtstag (Berlin) → 18, obwohl in UTC noch Vortag', () => {
    // 07.11.2026 00:30 MEZ = 06.11.2026 23:30 UTC
    const result = ageAt(birth, new Date('2026-11-06T23:30:00Z'));
    expect(result).toMatchObject({ age: 18, ageGroup: 'ADULT', today: d(2026, 11, 7) });
  });

  it('Sommerzeit wird berücksichtigt', () => {
    // 15.07.2026 00:30 MESZ = 14.07.2026 22:30 UTC
    expect(ageAt(d(2008, 7, 15), new Date('2026-07-14T22:30:00Z')).age).toBe(18);
  });
});
