import pino from 'pino';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDataSource, initDatabase } from './db/data-source.js';
import { createHostClient } from './host/hostd-client.js';
import { ensureInitialAdmin } from './seed.js';

const config = loadConfig();
const log = pino({ level: config.LOG_LEVEL });

const dataSource = createDataSource(config.DATABASE_URL);
const migrations = await initDatabase(dataSource);
if (migrations.length) log.info({ migrations }, 'Migrationen ausgeführt');
await ensureInitialAdmin(dataSource, config, log);

const app = await buildApp({
  config,
  dataSource,
  host: createHostClient(config.HOSTD_SOCKET, log),
  loggerInstance: log,
});

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'Beende …');
  await app.close();
  await dataSource.destroy();
  process.exit(0);
};
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

await app.listen({ host: config.HOST, port: config.PORT });
