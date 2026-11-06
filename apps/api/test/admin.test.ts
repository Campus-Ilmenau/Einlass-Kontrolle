import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import writeXlsxFile from 'write-excel-file/node';
import { UserSchema } from '../src/db/entities.js';
import {
  createTestApp,
  createTestDatabase,
  createUser,
  sessionCookie,
  type TestClock,
} from './helpers.js';

let dataSource: DataSource;
let drop: () => Promise<void>;
let app: Awaited<ReturnType<typeof createTestApp>>['app'];
let clock: TestClock;
let admin: { id: string; cookie: string };

const HOUR = 3600_000;

beforeAll(async () => {
  ({ dataSource, drop } = await createTestDatabase());
});
afterAll(async () => drop());

beforeEach(async () => {
  await dataSource.query('TRUNCATE users, free_lists, events, settings CASCADE');
  ({ app, clock } = await createTestApp(dataSource));
  const user = await createUser(dataSource, { name: 'chefin', role: 'ADMIN' });
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      name: 'chefin',
      password: 'richtiges-passwort',
      clientTime: clock.now().toISOString(),
    },
  });
  admin = { id: user.id, cookie: sessionCookie(res)! };
});

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';
const call = (method: Method, url: string, payload?: unknown, cookie = admin.cookie) =>
  app.inject({
    method,
    url: `/api/admin${url}`,
    cookies: { einlass_session: cookie },
    ...(payload === undefined ? {} : { payload: payload as object }),
  });

/** multipart/form-data für Datei-Uploads */
function multipart(
  file: { name: string; data: Buffer; type: string },
  fields: Record<string, string> = {},
) {
  const boundary = '----einlass' + Math.random().toString(16).slice(2);
  const parts: Buffer[] = [];
  for (const [k, v] of Object.entries(fields)) {
    parts.push(
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`),
    );
  }
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\n` +
        `Content-Type: ${file.type}\r\n\r\n`,
    ),
    file.data,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  );
  return {
    payload: Buffer.concat(parts),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

const upload = (
  listId: string,
  file: Parameters<typeof multipart>[0],
  fields?: Record<string, string>,
) => {
  const body = multipart(file, fields);
  return app.inject({
    method: 'POST',
    url: `/api/admin/lists/${listId}/import`,
    cookies: { einlass_session: admin.cookie },
    ...body,
  });
};

const csv = (text: string) => ({ name: 'liste.csv', data: Buffer.from(text), type: 'text/csv' });

describe('Zugriffsschutz', () => {
  it('ohne Anmeldung 401, als Kontrolleur:in 403', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/admin/users' })).statusCode).toBe(401);

    await createUser(dataSource, { name: 'kontrolle' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        name: 'kontrolle',
        password: 'richtiges-passwort',
        clientTime: clock.now().toISOString(),
      },
    });
    expect((await call('GET', '/users', undefined, sessionCookie(res)!)).statusCode).toBe(403);
  });
});

describe('Kontrolleur:innen', () => {
  it('anlegen, auflisten, ändern, löschen', async () => {
    const validUntil = new Date(clock.now().getTime() + 8 * HOUR).toISOString();
    const created = await call('POST', '/users', {
      name: 'Tür 1',
      password: 'geheim-123',
      role: 'CONTROLLER',
      validUntil,
    });
    expect(created.statusCode).toBe(201);
    const user = created.json();
    expect(user).toMatchObject({ name: 'Tür 1', role: 'CONTROLLER', status: 'ACTIVE', validUntil });

    const list = (await call('GET', '/users')).json();
    expect(list.map((u: { name: string }) => u.name)).toEqual(['chefin', 'Tür 1']);

    const disabled = await call('PATCH', `/users/${user.id}`, { disabled: true });
    expect(disabled.json().status).toBe('DISABLED');

    expect((await call('DELETE', `/users/${user.id}`)).statusCode).toBe(204);
    expect((await call('DELETE', `/users/${user.id}`)).statusCode).toBe(404);
  });

  it('doppelter Name (ohne Groß-/Kleinschreibung) → 409 NAME_TAKEN', async () => {
    const res = await call('POST', '/users', {
      name: 'CHEFIN',
      password: 'geheim-123',
      role: 'ADMIN',
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('NAME_TAKEN');
  });

  it('Status "abgelaufen" und "gesperrt" werden angezeigt, Entsperren funktioniert', async () => {
    const expired = await createUser(dataSource, {
      name: 'alt',
      validUntil: new Date(clock.now().getTime() - HOUR),
    });
    const locked = await createUser(dataSource, {
      name: 'gesperrt',
      lockedUntil: new Date(clock.now().getTime() + 10 * 60_000),
    });
    const users = (await call('GET', '/users')).json() as { id: string; status: string }[];
    expect(users.find((u) => u.id === expired.id)!.status).toBe('EXPIRED');
    expect(users.find((u) => u.id === locked.id)!.status).toBe('LOCKED');

    const unlocked = await call('PATCH', `/users/${locked.id}`, { unlock: true });
    expect(unlocked.json()).toMatchObject({ status: 'ACTIVE', lockedUntil: null });
  });

  it('Passwort zurücksetzen erlaubt Login mit neuem Passwort', async () => {
    const u = await createUser(dataSource, { name: 'vergesslich' });
    await call('PATCH', `/users/${u.id}`, { password: 'neues-passwort' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        name: 'vergesslich',
        password: 'neues-passwort',
        clientTime: clock.now().toISOString(),
      },
    });
    expect(res.statusCode).toBe(200);
  });

  it('eigenes Konto: nicht löschen, sperren oder herabstufen', async () => {
    expect((await call('DELETE', `/users/${admin.id}`)).json().error).toBe('SELF');
    expect((await call('PATCH', `/users/${admin.id}`, { disabled: true })).json().error).toBe(
      'SELF',
    );
    expect((await call('PATCH', `/users/${admin.id}`, { role: 'CONTROLLER' })).json().error).toBe(
      'SELF',
    );
    // Namen und Passwort ändern ist erlaubt
    expect((await call('PATCH', `/users/${admin.id}`, { name: 'Chefin' })).statusCode).toBe(200);
  });

  it('letzter aktiver Admin kann nicht entfernt werden', async () => {
    const other = await createUser(dataSource, { name: 'admin2', role: 'ADMIN', disabled: true });
    // Einziger aktiver Admin ist "chefin" → anderen (deaktivierten) Admin löschen geht
    expect((await call('DELETE', `/users/${other.id}`)).statusCode).toBe(204);

    const second = await createUser(dataSource, { name: 'admin3', role: 'ADMIN' });
    // Jetzt gibt es zwei aktive Admins → herabstufen geht
    expect((await call('PATCH', `/users/${second.id}`, { role: 'CONTROLLER' })).statusCode).toBe(
      200,
    );
  });

  it('Validierung: zu kurzes Passwort → 400', async () => {
    const res = await call('POST', '/users', { name: 'xy', password: 'kurz', role: 'CONTROLLER' });
    expect(res.statusCode).toBe(400);
  });
});

describe('Freilisten', () => {
  const createList = async (name = 'FS EI') => (await call('POST', '/lists', { name })).json();

  it('anlegen, Einträge hinzufügen (Duplikate werden übersprungen), suchen, löschen', async () => {
    const list = await createList();
    expect(list).toMatchObject({ name: 'FS EI', entryCount: 0 });

    const add = await call('POST', `/lists/${list.id}/entries`, {
      matrikelnummern: ['53902', '12345', '53902'],
    });
    expect(add.json()).toEqual({ added: 2, alreadyInList: 0 });
    const again = await call('POST', `/lists/${list.id}/entries`, {
      matrikelnummern: ['12345', '54321'],
    });
    expect(again.json()).toEqual({ added: 1, alreadyInList: 1 });

    const page = (await call('GET', `/lists/${list.id}/entries?search=5&pageSize=10`)).json();
    expect(page.total).toBe(2);
    expect(page.items.map((e: { matrikelnummer: string }) => e.matrikelnummer)).toEqual([
      '53902',
      '54321',
    ]);

    const lists = (await call('GET', '/lists')).json();
    expect(lists[0].entryCount).toBe(3);

    const entryId = page.items[0].id;
    expect((await call('DELETE', `/lists/${list.id}/entries/${entryId}`)).statusCode).toBe(204);
    expect((await call('DELETE', `/lists/${list.id}/entries`)).json()).toEqual({ removed: 2 });
    expect((await call('DELETE', `/lists/${list.id}`)).statusCode).toBe(204);
  });

  it('ungültige Matrikelnummer → 400', async () => {
    const list = await createList();
    const res = await call('POST', `/lists/${list.id}/entries`, { matrikelnummern: ['1234'] });
    expect(res.statusCode).toBe(400);
  });

  it('CSV-Import mit Überschrift, Semikolon und ungültigen Zeilen', async () => {
    const list = await createList();
    const res = await upload(
      list.id,
      csv('Name;Matrikel\nAnna;53902\nBen;12345\nCem;??\nDora;53902\n'),
    );
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      mode: 'append',
      format: 'csv',
      column: 'Matrikel',
      rows: 4,
      added: 2,
      duplicatesInFile: 1,
      invalidCount: 1,
      invalid: [{ row: 4, value: '??' }],
    });
  });

  it('XLSX-Import, Zahlen ohne führende Nullen werden aufgefüllt', async () => {
    const list = await createList();
    const data = await writeXlsxFile([
      [{ value: 'Mat.-Nr.' }, { value: 'Name' }],
      [{ value: 53902 }, { value: 'Anna' }],
      [{ value: 123 }, { value: 'Ben' }],
    ]).toBuffer();
    const res = await upload(list.id, {
      name: 'liste.xlsx',
      data,
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ format: 'xlsx', column: 'Mat.-Nr.', added: 2 });
    const page = (await call('GET', `/lists/${list.id}/entries`)).json();
    expect(page.items.map((e: { matrikelnummer: string }) => e.matrikelnummer)).toEqual([
      '00123',
      '53902',
    ]);
  });

  it('Import "replace" ersetzt den Inhalt', async () => {
    const list = await createList();
    await call('POST', `/lists/${list.id}/entries`, { matrikelnummern: ['11111', '22222'] });
    const res = await upload(list.id, csv('22222\n33333\n'), { mode: 'replace' });
    expect(res.json()).toMatchObject({ mode: 'replace', added: 1, alreadyInList: 1, removed: 1 });
    const page = (await call('GET', `/lists/${list.id}/entries`)).json();
    expect(page.items.map((e: { matrikelnummer: string }) => e.matrikelnummer)).toEqual([
      '22222',
      '33333',
    ]);
  });

  it('Import-Fehler: keine Matrikel-Spalte, unbekannte Spalte', async () => {
    const list = await createList();
    expect((await upload(list.id, csv('Name\nAnna\n'))).json().error).toBe('NO_MATRIKEL_COLUMN');
    expect((await upload(list.id, csv('a;b\n53902;1\n'), { column: 'x' })).json().error).toBe(
      'UNKNOWN_COLUMN',
    );
  });

  it('unbekannte Liste → 404', async () => {
    const res = await call('GET', '/lists/00000000-0000-4000-8000-000000000000/entries');
    expect(res.statusCode).toBe(404);
  });
});

describe('Veranstaltungen', () => {
  const at = (h: number) => new Date(clock.now().getTime() + h * HOUR).toISOString();

  it('anlegen mit Listen, Status, ändern, vorzeitig beenden', async () => {
    const list = (await call('POST', '/lists', { name: 'FS EI' })).json();
    const created = await call('POST', '/events', {
      name: 'Freitag',
      startsAt: at(-1),
      endsAt: at(5),
      listIds: [list.id],
    });
    expect(created.statusCode).toBe(201);
    const event = created.json();
    expect(event).toMatchObject({
      name: 'Freitag',
      status: 'ACTIVE',
      lists: [{ id: list.id, name: 'FS EI' }],
    });

    const renamed = await call('PATCH', `/events/${event.id}`, {
      name: 'Freitagsparty',
      listIds: [],
    });
    expect(renamed.json()).toMatchObject({ name: 'Freitagsparty', lists: [] });

    const ended = await call('POST', `/events/${event.id}/end`);
    expect(ended.json().status).toBe('PAST');
    expect((await call('POST', `/events/${event.id}/end`)).json().error).toBe('NOT_ACTIVE');
  });

  it('Überschneidung → 409 EVENT_OVERLAP', async () => {
    await call('POST', '/events', { name: 'A', startsAt: at(1), endsAt: at(5) });
    const res = await call('POST', '/events', { name: 'B', startsAt: at(4), endsAt: at(8) });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('EVENT_OVERLAP');
  });

  it('Ende vor Start → 400', async () => {
    const created = (
      await call('POST', '/events', { name: 'A', startsAt: at(1), endsAt: at(5) })
    ).json();
    expect((await call('PATCH', `/events/${created.id}`, { endsAt: at(0) })).json().error).toBe(
      'INVALID_RANGE',
    );
    expect(
      (await call('POST', '/events', { name: 'B', startsAt: at(9), endsAt: at(8) })).statusCode,
    ).toBe(400);
  });

  it('unbekannte Liste → 400 UNKNOWN_LIST', async () => {
    const res = await call('POST', '/events', {
      name: 'A',
      startsAt: at(1),
      endsAt: at(2),
      listIds: ['00000000-0000-4000-8000-000000000000'],
    });
    expect(res.json().error).toBe('UNKNOWN_LIST');
  });

  it('Liste nach Status sortiert (neueste zuerst), Löschen', async () => {
    await call('POST', '/events', { name: 'Vergangen', startsAt: at(-30), endsAt: at(-25) });
    const planned = (
      await call('POST', '/events', { name: 'Geplant', startsAt: at(24), endsAt: at(30) })
    ).json();
    const events = (await call('GET', '/events')).json();
    expect(events.map((e: { name: string; status: string }) => `${e.name}:${e.status}`)).toEqual([
      'Geplant:PLANNED',
      'Vergangen:PAST',
    ]);
    expect((await call('DELETE', `/events/${planned.id}`)).statusCode).toBe(204);
  });
});

describe('Einstellungen', () => {
  it('Standardwerte lesen und ändern', async () => {
    expect((await call('GET', '/settings')).json()).toEqual({ checkLogRetentionDays: 7 });
    expect((await call('PATCH', '/settings', { checkLogRetentionDays: 30 })).json()).toEqual({
      checkLogRetentionDays: 30,
    });
    expect((await call('PATCH', '/settings', { checkLogRetentionDays: 0 })).statusCode).toBe(400);
  });
});

describe('Benutzer-Entity', () => {
  it('Admin-Login hat lastLoginAt gesetzt', async () => {
    const u = await dataSource.getRepository(UserSchema).findOneByOrFail({ id: admin.id });
    expect(u.lastLoginAt).not.toBeNull();
  });
});
