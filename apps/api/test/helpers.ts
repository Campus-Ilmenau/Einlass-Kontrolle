import { randomBytes } from 'node:crypto';
import pg from 'pg';
import type { DataSource } from 'typeorm';
import { inject } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Config } from '../src/config.js';
import { createDataSource, initDatabase } from '../src/db/data-source.js';
import { UserSchema, type UserEntity } from '../src/db/entities.js';
import { hashPassword } from '../src/auth/password.js';
import {
  HostUnavailableError,
  type HostClient,
  type HostTimeStatus,
} from '../src/host/hostd-client.js';

/** Eigene, frisch migrierte Datenbank pro Testdatei. */
export async function createTestDatabase(): Promise<{
  dataSource: DataSource;
  drop: () => Promise<void>;
}> {
  const base = inject('pgBaseUrl');
  const name = `test_${randomBytes(6).toString('hex')}`;
  const admin = new pg.Client({ connectionString: `${base}/postgres` });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();

  const dataSource = createDataSource(`${base}/${name}`);
  await initDatabase(dataSource);
  return {
    dataSource,
    drop: async () => {
      await dataSource.destroy();
      const c = new pg.Client({ connectionString: `${base}/postgres` });
      await c.connect();
      await c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await c.end();
    },
  };
}

/** Steuerbare Uhr für Tests. */
export class TestClock {
  private offsetMs = 0;
  constructor(private readonly base = Date.now()) {}
  readonly now = () => new Date(this.base + this.offsetMs + (Date.now() - this.started));
  private readonly started = Date.now();
  advance(ms: number) {
    this.offsetMs += ms;
  }
  set(to: Date) {
    this.offsetMs += to.getTime() - this.now().getTime();
  }
}

/** Host-Dienst-Attrappe: "setzt" die Uhr, indem sie die TestClock verstellt. */
export class FakeHost implements HostClient {
  readonly available = true;
  readonly setCalls: { time: Date; source: string }[] = [];
  lastKnownTime: Date | null = null;
  failSet = false;

  constructor(private readonly clock: TestClock) {}

  async getTime(): Promise<HostTimeStatus> {
    return {
      systemTime: this.clock.now().toISOString(),
      ntpSynchronized: false,
      rtcPresent: false,
      rtcTime: null,
      lastKnownTime: this.lastKnownTime?.toISOString() ?? null,
      lastSetAt: null,
      lastRtcWrite: null,
    };
  }

  async setTime(time: Date, source: string) {
    if (this.failSet) throw new HostUnavailableError('simuliert');
    const previous = this.clock.now();
    this.clock.set(time);
    this.setCalls.push({ time, source });
    return {
      previous: previous.toISOString(),
      now: time.toISOString(),
      driftSeconds: (time.getTime() - previous.getTime()) / 1000,
      rtcWritten: false,
    };
  }

  async shutdown() {}
  async reboot() {}
}

export const testConfig: Config = {
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: 0,
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'postgres://unused/unused',
  JWT_SECRET: 'test-secret-mit-mindestens-zweiunddreissig-zeichen',
  COOKIE_SECURE: true,
  SESSION_HOURS: 12,
  HOSTD_SOCKET: '/nonexistent',
  ADMIN_INITIAL_NAME: 'admin',
  ADMIN_INITIAL_PASSWORD: undefined,
};

export async function createTestApp(dataSource: DataSource, overrides: Partial<Config> = {}) {
  const clock = new TestClock();
  const host = new FakeHost(clock);
  const app = await buildApp({
    config: { ...testConfig, ...overrides },
    dataSource,
    host,
    now: clock.now,
    jobs: false,
  });
  await app.ready();
  return { app, clock, host };
}

export async function createUser(
  dataSource: DataSource,
  data: Partial<UserEntity> & { name: string; password?: string },
): Promise<UserEntity> {
  const { password = 'richtiges-passwort', ...rest } = data;
  const repo = dataSource.getRepository(UserSchema);
  const saved = await repo.save({
    role: 'CONTROLLER',
    ...rest,
    passwordHash: await hashPassword(password),
  });
  return repo.findOneByOrFail({ id: saved.id });
}

/** Wert des Session-Cookies aus einer Antwort. */
export function sessionCookie(res: {
  cookies: { name: string; value: string }[];
}): string | undefined {
  return res.cookies.find((c) => c.name === 'einlass_session')?.value;
}
