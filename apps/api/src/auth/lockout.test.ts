import { describe, expect, it } from 'vitest';
import { accountProblem, isLocked, LOCKOUT, registerFailure } from './lockout.js';

const now = new Date('2026-11-06T20:00:00Z');
const min = (m: number) => new Date(now.getTime() + m * 60_000);

describe('registerFailure', () => {
  it('zählt Fehlversuche hoch und meldet die verbleibenden Versuche', () => {
    const r = registerFailure({ failedLoginCount: 0, lockedUntil: null }, now);
    expect(r).toMatchObject({ failedLoginCount: 1, remainingAttempts: 4, lockedNow: false });
  });

  it('sperrt beim 5. Fehlversuch für 15 Minuten', () => {
    const r = registerFailure({ failedLoginCount: 4, lockedUntil: null }, now);
    expect(r.lockedNow).toBe(true);
    expect(r.lockedUntil).toEqual(min(LOCKOUT.lockMinutes));
    expect(r.failedLoginCount).toBe(0);
  });

  it('nach Ablauf der Sperre beginnt die Zählung neu', () => {
    const r = registerFailure({ failedLoginCount: 3, lockedUntil: min(-1) }, now);
    expect(r).toMatchObject({ failedLoginCount: 1, remainingAttempts: 4 });
  });
});

describe('isLocked', () => {
  it('gesperrt bis einschließlich kurz vor Ablauf', () => {
    expect(isLocked({ failedLoginCount: 0, lockedUntil: min(1) }, now)).toBe(true);
    expect(isLocked({ failedLoginCount: 0, lockedUntil: now }, now)).toBe(false);
    expect(isLocked({ failedLoginCount: 0, lockedUntil: null }, now)).toBe(false);
  });
});

describe('accountProblem', () => {
  it('deaktiviert hat Vorrang', () => {
    expect(accountProblem({ disabled: true, validUntil: min(-5) }, now)).toBe('DISABLED');
  });

  it('abgelaufen ab dem Zeitpunkt "gültig bis"', () => {
    expect(accountProblem({ disabled: false, validUntil: now }, now)).toBe('EXPIRED');
    expect(accountProblem({ disabled: false, validUntil: min(1) }, now)).toBeNull();
  });

  it('ohne "gültig bis" unbegrenzt', () => {
    expect(accountProblem({ disabled: false, validUntil: null }, now)).toBeNull();
  });
});
