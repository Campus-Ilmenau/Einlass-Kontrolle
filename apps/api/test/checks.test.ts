import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { matrikelHash } from '../src/checks/matrikel-hash.js';
import { CheckLogSchema } from '../src/db/entities.js';
import { runRetention } from '../src/jobs/retention.js';
import {
  createTestApp,
  createTestDatabase,
  createUser,
  sessionCookie,
  type FakeHost,
  type TestClock,
} from './helpers.js';

let dataSource: DataSource;
let drop: () => Promise<void>;
let app: Awaited<ReturnType<typeof createTestApp>>['app'];
let clock: TestClock;
let host: FakeHost;
let adminCookie: string;
let controllerCookie: string;

const HOUR = 3600_000;
const DAY = 24 * HOUR;

beforeAll(async () => {
  ({ dataSource, drop } = await createTestDatabase());
});
afterAll(async () => drop());

const loginAs = async (name: string) => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { name, password: 'richtiges-passwort', clientTime: clock.now().toISOString() },
  });
  return sessionCookie(res)!;
};

beforeEach(async () => {
  await dataSource.query('TRUNCATE users, free_lists, events, settings, time_sync_logs CASCADE');
  ({ app, clock, host } = await createTestApp(dataSource));
  await createUser(dataSource, { name: 'chefin', role: 'ADMIN' });
  await createUser(dataSource, { name: 'tuer1' });
  adminCookie = await loginAs('chefin');
  controllerCookie = await loginAs('tuer1');
});

const admin = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
  app.inject({
    method,
    url: `/api/admin${url}`,
    cookies: { einlass_session: adminCookie },
    ...(payload ? { payload } : {}),
  });

const check = (matrikelnummer: string, birthDate: string, cookie = controllerCookie) =>
  app.inject({
    method: 'POST',
    url: '/api/checks',
    cookies: { einlass_session: cookie },
    payload: { matrikelnummer, birthDate },
  });

/** Liste mit Nummern + laufende Veranstaltung mit dieser Liste */
async function setupEvent(
  lists: Record<string, string[]> = { 'FS EI': ['53902', '12345'] },
  hours: [number, number] = [-1, 5],
) {
  const listIds: string[] = [];
  for (const [name, numbers] of Object.entries(lists)) {
    const list = (await admin('POST', '/lists', { name })).json();
    if (numbers.length)
      await admin('POST', `/lists/${list.id}/entries`, { matrikelnummern: numbers });
    listIds.push(list.id);
  }
  const at = (h: number) => new Date(clock.now().getTime() + h * HOUR).toISOString();
  const event = await admin('POST', '/events', {
    name: 'Freitag',
    startsAt: at(hours[0]),
    endsAt: at(hours[1]),
    listIds,
  });
  return { event: event.json(), listIds };
}

/** Geburtsdatum für ein bestimmtes Alter (Geburtstag war vor einer Woche) */
const bornYearsAgo = (years: number) => {
  const d = new Date(clock.now().getTime() - 7 * DAY);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
};

describe('GET /api/checks/context', () => {
  it('ohne aktive Veranstaltung: event = null', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/checks/context',
      cookies: { einlass_session: controllerCookie },
    });
    expect(res.json()).toMatchObject({ event: null });
  });

  it('mit aktiver Veranstaltung: Name und Listen', async () => {
    await setupEvent();
    const res = await app.inject({
      method: 'GET',
      url: '/api/checks/context',
      cookies: { einlass_session: controllerCookie },
    });
    expect(res.json().event).toMatchObject({ name: 'Freitag', lists: [{ name: 'FS EI' }] });
  });

  it('Admins dürfen nicht scannen', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/checks/context',
      cookies: { einlass_session: adminCookie },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('POST /api/checks', () => {
  it('ohne aktive Veranstaltung → 409 NO_ACTIVE_EVENT', async () => {
    await setupEvent(undefined, [2, 6]); // erst in 2 Stunden
    const res = await check('53902', '1994-07-27');
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('NO_ACTIVE_EVENT');
  });

  it('auf der Freiliste, volljährig', async () => {
    await setupEvent();
    const res = await check('53902', '1994-07-27');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      isFree: true,
      matchedLists: [{ name: 'FS EI' }],
      ageGroup: 'ADULT',
      alreadySeenAt: null,
    });
  });

  it('nicht auf der Liste → normaler Eintritt', async () => {
    await setupEvent();
    expect((await check('99999', '1994-07-27')).json()).toMatchObject({
      isFree: false,
      matchedLists: [],
    });
  });

  it('nur Listen der aktiven Veranstaltung zählen', async () => {
    await admin('POST', '/lists', { name: 'Andere' }).then((r) =>
      admin('POST', `/lists/${r.json().id}/entries`, { matrikelnummern: ['77777'] }),
    );
    await setupEvent();
    expect((await check('77777', '1994-07-27')).json().isFree).toBe(false);
  });

  it('auf mehreren Listen', async () => {
    await setupEvent({ 'FS EI': ['53902'], Helfer: ['53902'] });
    const res = (await check('53902', '1994-07-27')).json();
    expect(res.matchedLists.map((l: { name: string }) => l.name)).toEqual(['FS EI', 'Helfer']);
  });

  it.each([
    [15, 'U16'],
    [16, 'U18'],
    [17, 'U18'],
    [18, 'ADULT'],
  ])('Alter %i → %s', async (years, group) => {
    await setupEvent();
    const res = (await check('12345', bornYearsAgo(years))).json();
    expect(res).toMatchObject({ age: years, ageGroup: group });
  });

  it('Doppel-Scan: Zeitpunkt des ersten Scans', async () => {
    await setupEvent();
    const first = (await check('53902', '1994-07-27')).json();
    expect(first.alreadySeenAt).toBeNull();
    clock.advance(30 * 60_000);
    const second = (await check('53902', '1994-07-27')).json();
    expect(second.alreadySeenAt).not.toBeNull();
    const third = (await check('53902', '1994-07-27')).json();
    expect(third.alreadySeenAt).toBe(second.alreadySeenAt);
  });

  it('Protokoll enthält weder Matrikelnummer noch Geburtsdatum', async () => {
    await setupEvent();
    await check('53902', '1994-07-27');
    const rows = await dataSource.query('SELECT row_to_json(c)::text AS j FROM check_logs c');
    expect(rows[0].j).not.toContain('53902');
    expect(rows[0].j).not.toContain('1994');
    expect(rows[0].j).toContain('ADULT');
  });

  it('Pseudonym ist pro Veranstaltung verschieden', () => {
    expect(matrikelHash('salt-a', '53902')).not.toBe(matrikelHash('salt-b', '53902'));
    expect(matrikelHash('salt-a', '53902')).toHaveLength(64);
  });

  it('unplausibles Geburtsdatum → 400', async () => {
    await setupEvent();
    expect((await check('53902', '2099-01-01')).json().error).toBe('INVALID_BIRTH_DATE');
    expect((await check('53902', '1920-01-01')).json().error).toBe('INVALID_BIRTH_DATE');
    expect((await check('53902', '2001-02-29')).statusCode).toBe(400);
  });

  it('ungültige Matrikelnummer → 400 VALIDATION', async () => {
    await setupEvent();
    expect((await check('5390', '1994-07-27')).json().error).toBe('VALIDATION');
  });
});

describe('Statistik', () => {
  it('zählt Personen, Doppel-Scans, Listen, Altersstufen und Kontrolleur:innen', async () => {
    const { event } = await setupEvent({ 'FS EI': ['53902', '12345'], Helfer: ['12345'] });
    await createUser(dataSource, { name: 'tuer2' });
    const tuer2 = await loginAs('tuer2');

    await check('53902', '1994-07-27'); // frei, FS EI
    await check('53902', '1994-07-27'); // Doppel-Scan
    await check('12345', bornYearsAgo(17), tuer2); // frei, beide Listen, U18
    await check('99999', bornYearsAgo(15), tuer2); // nicht frei, U16

    const stats = (await admin('GET', `/events/${event.id}/stats`)).json();
    expect(stats).toMatchObject({
      scans: 4,
      persons: 3,
      repeatedScans: 1,
      freePersons: 2,
      ageGroups: { U16: 1, U18: 1, ADULT: 1 },
      archived: false,
    });
    expect(stats.perList).toEqual([
      expect.objectContaining({ name: 'FS EI', persons: 2 }),
      expect.objectContaining({ name: 'Helfer', persons: 1 }),
    ]);
    expect(stats.perUser).toEqual([
      { name: 'tuer1', scans: 2 },
      { name: 'tuer2', scans: 2 },
    ]);
  });

  it('Display-Status ohne Anmeldung: nur Veranstaltung und Personenzahl', async () => {
    await setupEvent();
    await check('53902', '1994-07-27');
    await check('53902', '1994-07-27');
    const res = await app.inject({ method: 'GET', url: '/api/system/display' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ event: { name: 'Freitag' }, persons: 1 });
  });
});

describe('Aufräum-Job', () => {
  it('löscht Protokolle beendeter Veranstaltungen nach der Frist, Statistik bleibt', async () => {
    const { event } = await setupEvent(undefined, [-1, 1]);
    await admin('PATCH', '/settings', { checkLogRetentionDays: 2 });
    await check('53902', '1994-07-27');
    await check('99999', '1994-07-27');

    // Noch innerhalb der Frist → nichts passiert
    expect(await runRetention(dataSource, new Date(clock.now().getTime() + DAY))).toEqual({
      events: 0,
      deletedLogs: 0,
    });

    const later = new Date(clock.now().getTime() + 3 * DAY);
    expect(await runRetention(dataSource, later)).toEqual({ events: 1, deletedLogs: 2 });
    expect(await dataSource.getRepository(CheckLogSchema).count()).toBe(0);

    const stats = (await admin('GET', `/events/${event.id}/stats`)).json();
    expect(stats).toMatchObject({ scans: 2, persons: 2, freePersons: 1, archived: true });
  });

  it('laufende Veranstaltungen werden nie aufgeräumt', async () => {
    await setupEvent(undefined, [-1, 24 * 10]);
    await admin('PATCH', '/settings', { checkLogRetentionDays: 1 });
    await check('53902', '1994-07-27');
    const result = await runRetention(dataSource, new Date(clock.now().getTime() + 3 * DAY));
    expect(result.deletedLogs).toBe(0);
  });
});

describe('System (Admin)', () => {
  it('Zeit anzeigen und manuell setzen, Protokoll', async () => {
    const time = (await admin('GET', '/system/time')).json();
    expect(time).toMatchObject({ hostd: true, rtcPresent: false });

    const target = new Date(clock.now().getTime() + 2 * HOUR);
    const res = await admin('POST', '/system/time', { time: target.toISOString() });
    expect(res.statusCode).toBe(200);
    expect(host.setCalls).toHaveLength(1);

    const log = (await admin('GET', '/system/time-log')).json();
    expect(log[0]).toMatchObject({ source: 'ADMIN', userName: 'chefin', reason: 'MANUAL' });
  });

  it('Herunterfahren: 202, für Kontrolleur:innen verboten', async () => {
    expect((await admin('POST', '/system/shutdown')).statusCode).toBe(202);
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/system/shutdown',
      cookies: { einlass_session: controllerCookie },
    });
    expect(res.statusCode).toBe(403);
  });
});
