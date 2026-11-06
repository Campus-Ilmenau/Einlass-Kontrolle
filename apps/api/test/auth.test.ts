import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DataSource } from 'typeorm';
import { EventSchema, TimeSyncLogSchema, UserSchema } from '../src/db/entities.js';
import { ensureInitialAdmin } from '../src/seed.js';
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

const MIN = 60_000;

beforeAll(async () => {
  ({ dataSource, drop } = await createTestDatabase());
});

afterAll(async () => {
  await drop();
});

beforeEach(async () => {
  await dataSource.query('TRUNCATE users, events, time_sync_logs CASCADE');
  ({ app, clock, host } = await createTestApp(dataSource));
});

const login = (name: string, password: string, clientTime = clock.now()) =>
  app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { name, password, clientTime: clientTime.toISOString() },
  });

describe('GET /api/health', () => {
  it('antwortet ohne Anmeldung', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, hostd: true });
  });
});

describe('ensureInitialAdmin', () => {
  const log = { info() {}, warn() {} } as never;

  it('legt den ersten Admin genau einmal an', async () => {
    const cfg = { ADMIN_INITIAL_NAME: 'admin', ADMIN_INITIAL_PASSWORD: 'start-passwort' };
    expect(await ensureInitialAdmin(dataSource, cfg, log)).toBe('created');
    expect(await ensureInitialAdmin(dataSource, cfg, log)).toBe('exists');
    expect(await dataSource.getRepository(UserSchema).countBy({ role: 'ADMIN' })).toBe(1);
  });

  it('ohne Passwort wird kein Admin angelegt', async () => {
    const cfg = { ADMIN_INITIAL_NAME: 'admin', ADMIN_INITIAL_PASSWORD: undefined };
    expect(await ensureInitialAdmin(dataSource, cfg, log)).toBe('missing-password');
  });
});

describe('POST /api/auth/login', () => {
  it('erfolgreich: Cookie + Benutzer + Zeitabgleich', async () => {
    await createUser(dataSource, { name: 'Kontrolle1' });
    const res = await login('kontrolle1', 'richtiges-passwort');

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      user: { name: 'Kontrolle1', role: 'CONTROLLER', validUntil: null },
      timeSync: { action: 'none' },
    });
    const cookie = res.cookies.find((c) => c.name === 'einlass_session');
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Strict', path: '/' });
  });

  it('Name ist nicht case-sensitiv, Benutzernamen sind eindeutig', async () => {
    await createUser(dataSource, { name: 'Anna' });
    await expect(createUser(dataSource, { name: 'anna' })).rejects.toThrow();
    expect((await login('ANNA', 'richtiges-passwort')).statusCode).toBe(200);
  });

  it('unbekannter Benutzer → INVALID ohne Hinweis auf Existenz', async () => {
    const res = await login('gibtsnicht', 'egal-was');
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: 'INVALID' });
    expect(res.json().remainingAttempts).toBeUndefined();
  });

  it('5 Fehlversuche → 15 min gesperrt, danach wieder möglich', async () => {
    await createUser(dataSource, { name: 'tim' });

    for (let i = 4; i >= 1; i--) {
      const res = await login('tim', 'falsch');
      expect(res.statusCode).toBe(401);
      expect(res.json().remainingAttempts).toBe(i);
    }
    const locked = await login('tim', 'falsch');
    expect(locked.statusCode).toBe(423);
    expect(locked.json().error).toBe('LOCKED');

    // Während der Sperre hilft auch das richtige Passwort nicht
    expect((await login('tim', 'richtiges-passwort')).statusCode).toBe(423);

    clock.advance(15 * MIN + 1000);
    expect((await login('tim', 'richtiges-passwort')).statusCode).toBe(200);
  });

  it('erfolgreicher Login setzt den Fehlversuchszähler zurück', async () => {
    await createUser(dataSource, { name: 'eva' });
    await login('eva', 'falsch');
    await login('eva', 'falsch');
    expect((await login('eva', 'richtiges-passwort')).statusCode).toBe(200);
    const user = await dataSource.getRepository(UserSchema).findOneByOrFail({ name: 'eva' });
    expect(user.failedLoginCount).toBe(0);
    expect(user.lastLoginAt).not.toBeNull();
  });

  it('deaktiviertes Konto → DISABLED', async () => {
    await createUser(dataSource, { name: 'max', disabled: true });
    const res = await login('max', 'richtiges-passwort');
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('DISABLED');
  });

  it('abgelaufenes Konto → EXPIRED', async () => {
    await createUser(dataSource, {
      name: 'lea',
      validUntil: new Date(clock.now().getTime() - MIN),
    });
    const res = await login('lea', 'richtiges-passwort');
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('EXPIRED');
  });

  it('ungültige Anfrage → 400 VALIDATION', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { name: 'x', password: 'y', clientTime: 'gestern' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('VALIDATION');
  });
});

describe('Session', () => {
  it('GET /me mit Cookie liefert den Benutzer, ohne Cookie 401', async () => {
    await createUser(dataSource, { name: 'ole' });
    const cookie = sessionCookie(await login('ole', 'richtiges-passwort'))!;

    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { einlass_session: cookie },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.name).toBe('ole');

    expect((await app.inject({ method: 'GET', url: '/api/auth/me' })).statusCode).toBe(401);
  });

  it('Sperre wirkt sofort auf laufende Sitzungen', async () => {
    const user = await createUser(dataSource, { name: 'ida' });
    const cookie = sessionCookie(await login('ida', 'richtiges-passwort'))!;
    await dataSource.getRepository(UserSchema).update(user.id, { disabled: true });

    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { einlass_session: cookie },
    });
    expect(me.statusCode).toBe(401);
    expect(me.json().error).toBe('DISABLED');
  });

  it('Sitzung endet spätestens mit "gültig bis"', async () => {
    await createUser(dataSource, {
      name: 'jan',
      validUntil: new Date(clock.now().getTime() + 30 * MIN),
    });
    const res = await login('jan', 'richtiges-passwort');
    const cookie = res.cookies.find((c) => c.name === 'einlass_session')!;
    const expires = new Date(cookie.expires!).getTime();
    expect(Math.abs(expires - (clock.now().getTime() + 30 * MIN))).toBeLessThan(2000);

    clock.advance(31 * MIN);
    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { einlass_session: cookie.value },
    });
    expect(me.statusCode).toBe(401);
  });

  it('Logout löscht das Cookie', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/logout' });
    expect(res.statusCode).toBe(204);
    const cleared = res.cookies.find((c) => c.name === 'einlass_session');
    expect(cleared?.value).toBe('');
  });
});

describe('Zeitabgleich beim Login', () => {
  it('Pi geht 2 Tage nach → Uhr wird vor dem Signieren korrigiert, Sitzung bleibt gültig', async () => {
    await createUser(dataSource, { name: 'admin1', role: 'ADMIN' });
    const realTime = new Date(clock.now().getTime() + 2 * 24 * 3600_000);

    const res = await login('admin1', 'richtiges-passwort', realTime);
    expect(res.statusCode).toBe(200);
    expect(res.json().timeSync).toMatchObject({ action: 'adjusted', reason: 'LARGE_CORRECTION' });
    expect(host.setCalls).toHaveLength(1);
    expect(Math.abs(clock.now().getTime() - realTime.getTime())).toBeLessThan(2000);

    // Token wurde mit der korrigierten Zeit ausgestellt → weiterhin gültig
    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { einlass_session: sessionCookie(res)! },
    });
    expect(me.statusCode).toBe(200);

    const logs = await dataSource.getRepository(TimeSyncLogSchema).find();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ source: 'LOGIN', action: 'adjusted' });
  });

  it('zweiter Client kurz danach mit anderer Zeit → nur Warnung', async () => {
    await createUser(dataSource, { name: 'user_a' });
    await createUser(dataSource, { name: 'user_b' });
    await login('user_a', 'richtiges-passwort', new Date(clock.now().getTime() + 3600_000));
    const res = await login(
      'user_b',
      'richtiges-passwort',
      new Date(clock.now().getTime() + 120_000),
    );
    expect(res.json().timeSync).toMatchObject({ action: 'warning', reason: 'RECENTLY_ADJUSTED' });
    expect(host.setCalls).toHaveLength(1);
  });

  it('falsches Passwort löst keinen Zeitabgleich aus', async () => {
    await createUser(dataSource, { name: 'user_c' });
    await login('user_c', 'falsch', new Date(clock.now().getTime() + 3600_000));
    expect(host.setCalls).toHaveLength(0);
  });

  it('während einer Veranstaltung: großer Sprung nur als Warnung', async () => {
    await createUser(dataSource, { name: 'user_d' });
    const now = clock.now();
    await dataSource.getRepository(EventSchema).insert({
      name: 'Freitag',
      startsAt: new Date(now.getTime() - 3600_000),
      endsAt: new Date(now.getTime() + 3600_000),
      hashSalt: 'x'.repeat(64),
    });
    const res = await login('user_d', 'richtiges-passwort', new Date(now.getTime() + 30 * MIN));
    expect(res.json().timeSync).toMatchObject({
      action: 'warning',
      reason: 'EVENT_ACTIVE_LARGE_JUMP',
    });
    expect(host.setCalls).toHaveLength(0);
  });

  it('Host-Dienst nicht erreichbar → Warnung, Login trotzdem möglich', async () => {
    await createUser(dataSource, { name: 'user_e' });
    host.failSet = true;
    const res = await login(
      'user_e',
      'richtiges-passwort',
      new Date(clock.now().getTime() + 3600_000),
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().timeSync).toMatchObject({ action: 'warning', reason: 'HOST_UNAVAILABLE' });
  });

  it('GET /me mit X-Client-Time gleicht ebenfalls ab', async () => {
    await createUser(dataSource, { name: 'user_f' });
    const cookie = sessionCookie(await login('user_f', 'richtiges-passwort'))!;
    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { einlass_session: cookie },
      headers: { 'x-client-time': new Date(clock.now().getTime() + 600_000).toISOString() },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().timeSync).toMatchObject({ action: 'adjusted' });
  });
});

describe('Datenbank-Constraints', () => {
  it('Veranstaltungen dürfen sich nicht überschneiden', async () => {
    const repo = dataSource.getRepository(EventSchema);
    const t = (h: number) => new Date(Date.UTC(2026, 10, 6, h));
    await repo.insert({ name: 'A', startsAt: t(20), endsAt: t(23), hashSalt: 'a'.repeat(64) });
    await expect(
      repo.insert({ name: 'B', startsAt: t(22), endsAt: t(26), hashSalt: 'b'.repeat(64) }),
    ).rejects.toThrow(/events_no_overlap/);
    // direkt anschließend ist erlaubt
    await repo.insert({ name: 'C', startsAt: t(23), endsAt: t(26), hashSalt: 'c'.repeat(64) });
  });
});
