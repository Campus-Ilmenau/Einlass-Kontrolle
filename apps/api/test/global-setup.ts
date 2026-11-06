import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    pgBaseUrl: string;
  }
}

/**
 * Startet für alle Tests ein temporäres PostgreSQL (embedded-postgres, ohne Docker).
 * Mit TEST_DATABASE_URL kann stattdessen ein vorhandener Server genutzt werden (z. B. in der CI).
 */
export default async function setup(project: TestProject) {
  const external = process.env.TEST_DATABASE_URL;
  if (external) {
    project.provide('pgBaseUrl', external.replace(/\/[^/]*$/, ''));
    return;
  }

  const dir = await mkdtemp(join(tmpdir(), 'einlass-pg-'));
  const port = 54000 + Math.floor(Math.random() * 1000);
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    port,
    user: 'einlass',
    password: 'einlass',
    persistent: false,
    onLog: () => {},
  });
  await pg.initialise();
  await pg.start();
  project.provide('pgBaseUrl', `postgres://einlass:einlass@127.0.0.1:${port}`);

  return async () => {
    await pg.stop();
    await rm(dir, { recursive: true, force: true });
  };
}
