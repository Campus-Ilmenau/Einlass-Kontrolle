import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyBaseLogger, type FastifyError } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { DataSource } from 'typeorm';
import { adminRoutes } from './admin/index.js';
import { authRoutes } from './auth/routes.js';
import { checkRoutes } from './checks/routes.js';
import { SESSION_COOKIE } from './auth/session.js';
import type { Config } from './config.js';
import type { HostClient } from './host/hostd-client.js';
import { ApiError, fromDatabaseError } from './http/errors.js';
import { scheduleRetention } from './jobs/retention.js';
import { displayRoutes } from './routes/display.js';
import { TimeSyncService } from './time/time-sync-service.js';

export interface AppDeps {
  config: Config;
  dataSource: DataSource;
  host: HostClient;
  /** Uhr (in Tests ersetzbar) */
  now?: () => Date;
  /** Fertiger Logger (z. B. pino aus main.ts); sonst wird einer erzeugt */
  loggerInstance?: FastifyBaseLogger;
  /** Hintergrund-Jobs (Aufräumen) starten – in Tests aus */
  jobs?: boolean;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
    dataSource: DataSource;
    host: HostClient;
    now: () => Date;
    timeSync: TimeSyncService;
  }
}

export const API_VERSION = process.env.npm_package_version ?? '0.0.0';

export async function buildApp(deps: AppDeps) {
  const app = Fastify({
    ...(deps.loggerInstance
      ? { loggerInstance: deps.loggerInstance }
      : { logger: { level: deps.config.LOG_LEVEL } }),
    trustProxy: true,
    disableRequestLogging: deps.config.NODE_ENV === 'test',
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const now = deps.now ?? (() => new Date());
  app.decorate('config', deps.config);
  app.decorate('dataSource', deps.dataSource);
  app.decorate('host', deps.host);
  app.decorate('now', now);
  app.decorate(
    'timeSync',
    new TimeSyncService({ dataSource: deps.dataSource, host: deps.host, now, log: app.log }),
  );

  await app.register(cookie);
  await app.register(jwt, {
    secret: deps.config.JWT_SECRET,
    cookie: { cookieName: SESSION_COOKIE, signed: false },
  });
  await app.register(rateLimit, { global: false });

  app.setErrorHandler<FastifyError>((error, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.code(400).send({
        error: 'VALIDATION',
        message: 'Ungültige Anfrage',
        issues: error.validation.map((v) => ({ path: v.instancePath, message: v.message })),
      });
    }
    const known = error instanceof ApiError ? error : fromDatabaseError(error);
    if (known) {
      return reply.code(known.statusCode).send({ error: known.code, message: known.message });
    }
    const status = error.statusCode ?? 500;
    if (status >= 500) request.log.error({ err: error }, 'Unerwarteter Fehler');
    return reply.code(status).send({
      error: status === 429 ? 'RATE_LIMITED' : status >= 500 ? 'INTERNAL' : (error.code ?? 'ERROR'),
      message: status >= 500 ? 'Interner Fehler' : error.message,
    });
  });

  await app.register(
    async (api) => {
      api.get('/health', async () => ({
        ok: true,
        version: API_VERSION,
        time: app.now().toISOString(),
        hostd: app.host.available,
      }));
      await api.register(authRoutes, { prefix: '/auth' });
      await api.register(adminRoutes, { prefix: '/admin' });
      await api.register(checkRoutes, { prefix: '/checks' });
      await api.register(displayRoutes, { prefix: '/system' });
    },
    { prefix: '/api' },
  );

  if (deps.jobs !== false) scheduleRetention(app);

  return app;
}
