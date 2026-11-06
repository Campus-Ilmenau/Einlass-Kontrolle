import { describe, expect, it } from 'vitest';
import { decideTimeSync } from './time-sync.js';

const at = (iso: string) => new Date(iso);
const server = at('2026-11-06T20:00:00Z');
const plus = (seconds: number, base = server) => new Date(base.getTime() + seconds * 1000);

describe('decideTimeSync', () => {
  it('kleine Abweichung (≤ 30 s) → nichts tun', () => {
    const r = decideTimeSync({ serverNow: server, clientTime: plus(25), eventActive: false });
    expect(r).toMatchObject({ action: 'none', reason: 'WITHIN_THRESHOLD', driftSeconds: 25 });
  });

  it('Pi geht nach (typisch nach Stromausfall ohne RTC) → korrigieren', () => {
    const client = plus(2 * 24 * 3600); // 2 Tage im Schrank
    const r = decideTimeSync({
      serverNow: server,
      clientTime: client,
      lastKnownTime: plus(-60),
      eventActive: false,
    });
    expect(r.action).toBe('adjusted');
    expect(r.targetTime).toEqual(client);
    expect(r.largeCorrection).toBe(true);
  });

  it('mittlere Abweichung → korrigieren ohne Admin-Hinweis', () => {
    const r = decideTimeSync({ serverNow: server, clientTime: plus(90), eventActive: false });
    expect(r).toMatchObject({ action: 'adjusted', largeCorrection: false });
  });

  it('Client-Zeit vor der letzten bekannten Zeit → ablehnen', () => {
    const r = decideTimeSync({
      serverNow: server,
      clientTime: plus(-3600),
      lastKnownTime: plus(-30),
      eventActive: false,
    });
    expect(r).toMatchObject({ action: 'rejected', reason: 'BELOW_LAST_KNOWN_TIME' });
  });

  it('kleine Korrektur zurück innerhalb der Toleranz der letzten bekannten Zeit ist erlaubt', () => {
    const r = decideTimeSync({
      serverNow: server,
      clientTime: plus(-45),
      lastKnownTime: plus(-20),
      eventActive: false,
    });
    expect(r.action).toBe('adjusted');
  });

  it('mehr als 2 Jahre in der Zukunft → ablehnen', () => {
    const r = decideTimeSync({
      serverNow: server,
      clientTime: plus(3 * 365 * 24 * 3600),
      eventActive: false,
    });
    expect(r).toMatchObject({ action: 'rejected', reason: 'TOO_FAR_IN_FUTURE' });
  });

  it('kurz nach einer Korrektur → nur Warnung (kein Hin- und Herspringen)', () => {
    const r = decideTimeSync({
      serverNow: server,
      clientTime: plus(120),
      lastAdjustmentAt: plus(-5 * 60),
      eventActive: false,
    });
    expect(r).toMatchObject({ action: 'warning', reason: 'RECENTLY_ADJUSTED' });
  });

  it('nach Ablauf der Sperrzeit wieder korrigieren', () => {
    const r = decideTimeSync({
      serverNow: server,
      clientTime: plus(120),
      lastAdjustmentAt: plus(-11 * 60),
      eventActive: false,
    });
    expect(r.action).toBe('adjusted');
  });

  it('aktive Veranstaltung: bis 5 min automatisch', () => {
    const r = decideTimeSync({ serverNow: server, clientTime: plus(4 * 60), eventActive: true });
    expect(r.action).toBe('adjusted');
  });

  it('aktive Veranstaltung: großer Sprung → Warnung, Admin muss bestätigen', () => {
    const r = decideTimeSync({ serverNow: server, clientTime: plus(30 * 60), eventActive: true });
    expect(r).toMatchObject({ action: 'warning', reason: 'EVENT_ACTIVE_LARGE_JUMP' });
  });

  it('ungültige Client-Zeit → ablehnen', () => {
    const r = decideTimeSync({
      serverNow: server,
      clientTime: new Date('kaputt'),
      eventActive: false,
    });
    expect(r).toMatchObject({ action: 'rejected', reason: 'INVALID_CLIENT_TIME' });
  });
});
