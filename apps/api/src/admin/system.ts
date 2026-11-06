import {
  SetTimeRequestSchema,
  type SystemTime,
  SystemTimeSchema,
  TimeSyncLogEntrySchema,
} from '@einlass/shared';
import type { FastifyInstance } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { TimeSyncLogSchema } from '../db/entities.js';
import { ApiError } from '../http/errors.js';

const hostUnavailable = () =>
  new ApiError(503, 'HOST_UNAVAILABLE', 'Host-Dienst nicht erreichbar (läuft die API auf dem Pi?)');

async function systemTime(app: FastifyInstance): Promise<SystemTime> {
  const host = await app.host.getTime().catch(() => null);
  return {
    serverTime: app.now().toISOString(),
    hostd: app.host.available && host !== null,
    ntpSynchronized: host?.ntpSynchronized ?? null,
    rtcPresent: host?.rtcPresent ?? null,
    rtcTime: host?.rtcTime ?? null,
    lastKnownTime: host?.lastKnownTime ?? null,
  };
}

export const adminSystemRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/time', { schema: { response: { 200: SystemTimeSchema } } }, async () =>
    systemTime(app),
  );

  /** Zeit manuell setzen (z. B. "Zeit von diesem Gerät übernehmen"), ohne Schutzregeln. */
  app.post(
    '/time',
    { schema: { body: SetTimeRequestSchema, response: { 200: SystemTimeSchema } } },
    async (request) => {
      if (!app.host.available) throw hostUnavailable();
      const target = new Date(request.body.time);
      const before = app.now();
      try {
        await app.host.setTime(target, 'admin');
      } catch {
        throw hostUnavailable();
      }
      await app.dataSource.getRepository(TimeSyncLogSchema).insert({
        source: 'ADMIN',
        userId: request.currentUser!.id,
        serverTimeBefore: before,
        clientTime: target,
        driftSeconds: Math.round((target.getTime() - before.getTime()) / 100) / 10,
        action: 'adjusted',
        reason: 'MANUAL',
        createdAt: app.now(),
      });
      request.log.warn(
        { from: before.toISOString(), to: target.toISOString(), by: request.currentUser!.name },
        'Systemzeit manuell gesetzt',
      );
      return systemTime(app);
    },
  );

  app.get(
    '/time-log',
    { schema: { response: { 200: z.array(TimeSyncLogEntrySchema) } } },
    async () => {
      const rows = await app.dataSource
        .getRepository(TimeSyncLogSchema)
        .createQueryBuilder('t')
        .leftJoin('users', 'u', 'u.id = t.user_id')
        .addSelect('u.name', 'user_name')
        .orderBy('t.created_at', 'DESC')
        .limit(100)
        .getRawAndEntities();
      return rows.entities.map((t, i) => ({
        id: t.id,
        source: t.source,
        userName: (rows.raw[i] as { user_name: string | null }).user_name,
        serverTimeBefore: t.serverTimeBefore.toISOString(),
        clientTime: t.clientTime.toISOString(),
        driftSeconds: t.driftSeconds,
        action: t.action,
        reason: t.reason,
        createdAt: t.createdAt.toISOString(),
      }));
    },
  );

  for (const action of ['shutdown', 'reboot'] as const) {
    app.post(`/${action}`, async (request, reply) => {
      if (!app.host.available) throw hostUnavailable();
      request.log.warn({ by: request.currentUser!.name }, `Pi: ${action} angefordert`);
      try {
        await (action === 'shutdown' ? app.host.shutdown() : app.host.reboot());
      } catch {
        throw hostUnavailable();
      }
      return reply.code(202).send({ ok: true, action });
    });
  }
};
