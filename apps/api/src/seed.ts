import type { FastifyBaseLogger } from 'fastify';
import type { DataSource } from 'typeorm';
import type { Config } from './config.js';
import { UserSchema } from './db/entities.js';
import { hashPassword } from './auth/password.js';

/** Legt den ersten Admin an, solange es noch keinen gibt. */
export async function ensureInitialAdmin(
  dataSource: DataSource,
  config: Pick<Config, 'ADMIN_INITIAL_NAME' | 'ADMIN_INITIAL_PASSWORD'>,
  log: FastifyBaseLogger,
): Promise<'created' | 'exists' | 'missing-password'> {
  const users = dataSource.getRepository(UserSchema);
  if (await users.existsBy({ role: 'ADMIN' })) return 'exists';

  if (!config.ADMIN_INITIAL_PASSWORD) {
    log.warn(
      'Kein Admin vorhanden und ADMIN_INITIAL_PASSWORD nicht gesetzt – bitte setzen und neu starten',
    );
    return 'missing-password';
  }
  await users.insert({
    name: config.ADMIN_INITIAL_NAME,
    passwordHash: await hashPassword(config.ADMIN_INITIAL_PASSWORD),
    role: 'ADMIN',
  });
  log.info({ name: config.ADMIN_INITIAL_NAME }, 'Erster Admin angelegt');
  return 'created';
}
