import {
  InstantSchema,
  LoginRequestSchema,
  LoginResponseSchema,
  TimeSyncResultSchema,
  UserSchema as UserDtoSchema,
} from '@einlass/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { UserSchema } from '../db/entities.js';
import { accountProblem, isLocked, registerFailure, registerSuccess } from './lockout.js';
import { verifyDummy, verifyPassword } from './password.js';
import { authenticate, clearSession, issueSession, toUserDto } from './session.js';

const ErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  remainingAttempts: z.number().optional(),
  lockedUntil: z.string().optional(),
});

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  const users = () => app.dataSource.getRepository(UserSchema);

  app.post(
    '/login',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        body: LoginRequestSchema,
        response: {
          200: LoginResponseSchema,
          401: ErrorSchema,
          403: ErrorSchema,
          423: ErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const { name, password, clientTime } = request.body;
      const now = app.now();

      const user = await users()
        .createQueryBuilder('u')
        .where('lower(u.name) = lower(:name)', { name })
        .getOne();

      if (!user) {
        await verifyDummy(password);
        return reply.code(401).send({ error: 'INVALID', message: 'Name oder Passwort falsch' });
      }

      if (isLocked(user, now)) {
        return reply.code(423).send({
          error: 'LOCKED',
          message: 'Zu viele Fehlversuche – Konto vorübergehend gesperrt',
          lockedUntil: user.lockedUntil!.toISOString(),
        });
      }

      if (!(await verifyPassword(user.passwordHash, password))) {
        const result = registerFailure(user, now);
        await users().update(user.id, {
          failedLoginCount: result.failedLoginCount,
          lockedUntil: result.lockedUntil,
        });
        if (result.lockedNow) {
          request.log.warn({ user: user.name }, 'Konto nach Fehlversuchen gesperrt');
          return reply.code(423).send({
            error: 'LOCKED',
            message: 'Zu viele Fehlversuche – Konto vorübergehend gesperrt',
            lockedUntil: result.lockedUntil!.toISOString(),
          });
        }
        return reply.code(401).send({
          error: 'INVALID',
          message: 'Name oder Passwort falsch',
          remainingAttempts: result.remainingAttempts,
        });
      }

      // Erst die Uhr abgleichen, dann Ablauf prüfen und Token signieren (siehe konzept/09)
      const timeSync = await app.timeSync.sync({
        clientTime: new Date(clientTime),
        source: 'LOGIN',
        userId: user.id,
      });
      const afterSync = app.now();

      const problem = accountProblem(user, afterSync);
      if (problem) {
        await users().update(user.id, registerSuccess());
        return reply.code(403).send({
          error: problem,
          message: problem === 'DISABLED' ? 'Konto deaktiviert' : 'Konto abgelaufen',
        });
      }

      await users().update(user.id, { ...registerSuccess(), lastLoginAt: afterSync });
      await issueSession(app, reply, user, afterSync);
      request.log.info({ user: user.name, role: user.role }, 'Anmeldung');
      return { user: toUserDto(user), timeSync };
    },
  );

  app.post('/logout', async (_request, reply) => {
    clearSession(app, reply);
    return reply.code(204).send();
  });

  app.get(
    '/me',
    {
      preHandler: authenticate(app),
      schema: {
        headers: z.object({ 'x-client-time': InstantSchema.optional() }).loose(),
        response: {
          200: z.object({ user: UserDtoSchema, timeSync: TimeSyncResultSchema.optional() }),
        },
      },
    },
    async (request) => {
      const user = request.currentUser!;
      const clientTime = request.headers['x-client-time'];
      const timeSync = clientTime
        ? await app.timeSync.sync({
            clientTime: new Date(clientTime),
            source: 'ME',
            userId: user.id,
          })
        : undefined;
      return { user: toUserDto(user), ...(timeSync ? { timeSync } : {}) };
    },
  );
};
