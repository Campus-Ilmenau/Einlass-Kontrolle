import { describe, expect, it } from 'vitest';
import { CheckRequestSchema, EventRequestSchema, LoginRequestSchema } from './schemas.js';

describe('CheckRequestSchema', () => {
  it('akzeptiert gültige Anfrage und trimmt die Matrikelnummer', () => {
    expect(
      CheckRequestSchema.parse({ matrikelnummer: ' 53902 ', birthDate: '1994-07-27' }),
    ).toEqual({
      matrikelnummer: '53902',
      birthDate: '1994-07-27',
    });
  });

  it('lehnt falsche Formate ab', () => {
    expect(
      CheckRequestSchema.safeParse({ matrikelnummer: '5390', birthDate: '1994-07-27' }).success,
    ).toBe(false);
    expect(
      CheckRequestSchema.safeParse({ matrikelnummer: '53902', birthDate: '27.07.1994' }).success,
    ).toBe(false);
  });
});

describe('LoginRequestSchema', () => {
  it('verlangt eine Client-Zeit mit Zeitzone', () => {
    const base = { name: 'kontrolle1', password: 'geheim123' };
    expect(
      LoginRequestSchema.safeParse({ ...base, clientTime: '2026-11-06T20:00:00.000Z' }).success,
    ).toBe(true);
    expect(
      LoginRequestSchema.safeParse({ ...base, clientTime: '2026-11-06T21:00:00+01:00' }).success,
    ).toBe(true);
    expect(LoginRequestSchema.safeParse({ ...base, clientTime: '2026-11-06 20:00' }).success).toBe(
      false,
    );
  });
});

describe('EventRequestSchema', () => {
  it('Ende muss nach Start liegen', () => {
    const r = EventRequestSchema.safeParse({
      name: 'Freitag',
      startsAt: '2026-11-06T21:00:00Z',
      endsAt: '2026-11-06T20:00:00Z',
    });
    expect(r.success).toBe(false);
  });

  it('listIds ist optional', () => {
    const r = EventRequestSchema.parse({
      name: 'Freitag',
      startsAt: '2026-11-06T20:00:00Z',
      endsAt: '2026-11-07T04:00:00Z',
    });
    expect(r.listIds).toEqual([]);
  });
});
