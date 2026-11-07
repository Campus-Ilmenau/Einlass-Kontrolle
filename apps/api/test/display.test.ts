import type { DisplayScanEvent } from '@einlass/shared';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createTestApp,
  createTestDatabase,
  createUser,
  sessionCookie,
  testConfig,
  type TestClock,
} from './helpers.js';

let dataSource: DataSource;
let drop: () => Promise<void>;
let app: Awaited<ReturnType<typeof createTestApp>>['app'];
let clock: TestClock;
let adminCookie: string;
let controllerCookie: string;

const TOKEN = testConfig.DISPLAY_TOKEN!;
const MIN = 60_000;

beforeAll(async () => {
  ({ dataSource, drop } = await createTestDatabase());
});
afterAll(async () => drop());

const loginAs = async (name: string) =>
  sessionCookie(
    await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { name, password: 'richtiges-passwort', clientTime: clock.now().toISOString() },
    }),
  )!;

beforeEach(async () => {
  await dataSource.query('TRUNCATE users, free_lists, events, settings CASCADE');
  ({ app, clock } = await createTestApp(dataSource));
  await createUser(dataSource, { name: 'chefin', role: 'ADMIN' });
  await createUser(dataSource, { name: 'tuer1' });
  adminCookie = await loginAs('chefin');
  controllerCookie = await loginAs('tuer1');
});

const display = (path: string, token: string | null = TOKEN) =>
  app.inject({ method: 'GET', url: `/api/display${path}${token ? `?token=${token}` : ''}` });

async function setupEvent(startOffsetMin = -50) {
  const list = (
    await app.inject({
      method: 'POST',
      url: '/api/admin/lists',
      cookies: { einlass_session: adminCookie },
      payload: { name: 'FS EI' },
    })
  ).json();
  await app.inject({
    method: 'POST',
    url: `/api/admin/lists/${list.id}/entries`,
    cookies: { einlass_session: adminCookie },
    payload: { matrikelnummern: ['53902'] },
  });
  const at = (m: number) => new Date(clock.now().getTime() + m * MIN).toISOString();
  await app.inject({
    method: 'POST',
    url: '/api/admin/events',
    cookies: { einlass_session: adminCookie },
    payload: { name: 'Freitag', startsAt: at(startOffsetMin), endsAt: at(300), listIds: [list.id] },
  });
}

const check = (matrikelnummer: string, birthDate: string) =>
  app.inject({
    method: 'POST',
    url: '/api/checks',
    cookies: { einlass_session: controllerCookie },
    payload: { matrikelnummer, birthDate },
  });

describe('Display-Token', () => {
  it('ohne oder mit falschem Token → 401', async () => {
    expect((await display('/info', null)).statusCode).toBe(401);
    expect((await display('/info', 'falsch')).statusCode).toBe(401);
    expect((await display('/stream', 'falsch')).statusCode).toBe(401);
  });

  it('Token auch per Header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/display/info',
      headers: { 'x-display-token': TOKEN },
    });
    expect(res.statusCode).toBe(200);
  });

  it('ohne konfiguriertes Token ist das Display abgeschaltet', async () => {
    const { app: noDisplay } = await createTestApp(dataSource, { DISPLAY_TOKEN: undefined });
    const res = await noDisplay.inject({ method: 'GET', url: `/api/display/info?token=${TOKEN}` });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('DISPLAY_DISABLED');
  });
});

describe('GET /api/display/info', () => {
  it('WLAN-Daten, App-Adresse und aktive Veranstaltung', async () => {
    expect((await display('/info')).json()).toMatchObject({
      wifi: { ssid: 'Einlass-Test', password: 'wlan-passwort' },
      appUrl: 'https://einlass.lan',
      event: null,
    });
    await setupEvent();
    expect((await display('/info')).json().event).toMatchObject({ name: 'Freitag' });
  });
});

describe('GET /api/display/stats', () => {
  it('ohne Veranstaltung: leer', async () => {
    expect((await display('/stats')).json()).toMatchObject({
      event: null,
      persons: 0,
      timeline: [],
    });
  });

  it('Zahlen und lückenloser Zeitverlauf in 15-Minuten-Abschnitten', async () => {
    await setupEvent(-50); // Beginn vor 50 min → 4 Abschnitte: -50, -35, -20, -5
    clock.advance(-40 * MIN); // Scan im ersten Abschnitt
    await check('53902', '1994-07-27');
    clock.advance(40 * MIN); // zurück ins Jetzt (letzter Abschnitt)
    await check('53902', '1994-07-27');
    await check('11111', '2010-01-01');

    const stats = (await display('/stats')).json();
    expect(stats).toMatchObject({
      persons: 2,
      scans: 3,
      freePersons: 1,
      perList: [{ name: 'FS EI', persons: 1 }],
      ageGroups: { U16: 0, U18: 1, ADULT: 1 },
    });
    expect(stats.timeline.map((t: { scans: number }) => t.scans)).toEqual([1, 0, 0, 2]);
  });
});

describe('Live-Ereignis nach einem Scan', () => {
  it('wird ohne Matrikelnummer und Geburtsdatum veröffentlicht', async () => {
    await setupEvent();
    const events: DisplayScanEvent[] = [];
    const unsubscribe = app.displayBus.subscribe((e) => events.push(e));

    await check('53902', '1994-07-27');
    await check('53902', '1994-07-27');
    unsubscribe();

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      isFree: true,
      lists: ['FS EI'],
      ageGroup: 'ADULT',
      alreadySeen: false,
    });
    expect(events[1]!.alreadySeen).toBe(true);
    const json = JSON.stringify(events);
    expect(json).not.toContain('53902');
    expect(json).not.toContain('1994');
  });
});
