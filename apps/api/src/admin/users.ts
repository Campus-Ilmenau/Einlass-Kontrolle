import {
  type AdminUser,
  AdminUserSchema,
  CreateUserRequestSchema,
  UpdateUserRequestSchema,
  type UserStatus,
} from '@einlass/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { Not } from 'typeorm';
import { z } from 'zod';
import { accountProblem, isLocked } from '../auth/lockout.js';
import { hashPassword } from '../auth/password.js';
import { type UserEntity, UserSchema } from '../db/entities.js';
import { conflict, notFound } from '../http/errors.js';

export function userStatus(u: UserEntity, now: Date): UserStatus {
  const problem = accountProblem(u, now);
  if (problem) return problem;
  return isLocked(u, now) ? 'LOCKED' : 'ACTIVE';
}

export function toAdminUserDto(u: UserEntity, now: Date): AdminUser {
  return {
    id: u.id,
    name: u.name,
    role: u.role,
    validUntil: u.validUntil?.toISOString() ?? null,
    status: userStatus(u, now),
    disabled: u.disabled,
    lockedUntil: u.lockedUntil && u.lockedUntil > now ? u.lockedUntil.toISOString() : null,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

const IdParams = z.object({ id: z.uuid() });

export const adminUserRoutes: FastifyPluginAsyncZod = async (app) => {
  const repo = () => app.dataSource.getRepository(UserSchema);

  const load = async (id: string) => {
    const user = await repo().findOneBy({ id });
    if (!user) throw notFound('Benutzer');
    return user;
  };

  /** Gibt es außer `exceptId` noch einen nutzbaren Admin? */
  const otherActiveAdminExists = async (exceptId: string) => {
    const admins = await repo().findBy({ role: 'ADMIN', disabled: false, id: Not(exceptId) });
    const now = app.now();
    return admins.some((a) => !a.validUntil || a.validUntil > now);
  };

  app.get('/', { schema: { response: { 200: z.array(AdminUserSchema) } } }, async () => {
    const now = app.now();
    const users = await repo().find({ order: { role: 'ASC', name: 'ASC' } });
    return users.map((u) => toAdminUserDto(u, now));
  });

  app.post(
    '/',
    { schema: { body: CreateUserRequestSchema, response: { 201: AdminUserSchema } } },
    async (request, reply) => {
      const { name, password, role, validUntil } = request.body;
      const saved = await repo().save({
        name,
        role,
        passwordHash: await hashPassword(password),
        validUntil: validUntil ? new Date(validUntil) : null,
      });
      const user = await load(saved.id);
      request.log.info({ user: name, role, by: request.currentUser!.name }, 'Benutzer angelegt');
      return reply.code(201).send(toAdminUserDto(user, app.now()));
    },
  );

  app.patch(
    '/:id',
    {
      schema: {
        params: IdParams,
        body: UpdateUserRequestSchema,
        response: { 200: AdminUserSchema },
      },
    },
    async (request) => {
      const user = await load(request.params.id);
      const body = request.body;
      const self = request.currentUser!.id === user.id;

      if (self && (body.disabled === true || (body.role && body.role !== user.role))) {
        throw conflict('SELF', 'Das eigene Konto kann nicht gesperrt oder herabgestuft werden');
      }
      if (self && body.validUntil) {
        throw conflict('SELF', 'Für das eigene Konto kann kein Ablaufdatum gesetzt werden');
      }

      const losesAdmin =
        user.role === 'ADMIN' &&
        ((body.role !== undefined && body.role !== 'ADMIN') ||
          body.disabled === true ||
          (body.validUntil && new Date(body.validUntil) <= app.now()));
      if (losesAdmin && !(await otherActiveAdminExists(user.id))) {
        throw conflict('LAST_ADMIN', 'Es muss mindestens ein aktiver Admin bleiben');
      }

      const changes: Partial<UserEntity> = {};
      if (body.name !== undefined) changes.name = body.name;
      if (body.role !== undefined) changes.role = body.role;
      if (body.disabled !== undefined) changes.disabled = body.disabled;
      if (body.validUntil !== undefined) {
        changes.validUntil = body.validUntil ? new Date(body.validUntil) : null;
      }
      if (body.password !== undefined) {
        changes.passwordHash = await hashPassword(body.password);
        changes.failedLoginCount = 0;
        changes.lockedUntil = null;
      }
      if (body.unlock) {
        changes.failedLoginCount = 0;
        changes.lockedUntil = null;
      }
      await repo().update(user.id, changes);
      request.log.info(
        { user: user.name, fields: Object.keys(body), by: request.currentUser!.name },
        'Benutzer geändert',
      );
      return toAdminUserDto(await load(user.id), app.now());
    },
  );

  app.delete('/:id', { schema: { params: IdParams } }, async (request, reply) => {
    const user = await load(request.params.id);
    if (request.currentUser!.id === user.id) {
      throw conflict('SELF', 'Das eigene Konto kann nicht gelöscht werden');
    }
    if (user.role === 'ADMIN' && !(await otherActiveAdminExists(user.id))) {
      throw conflict('LAST_ADMIN', 'Es muss mindestens ein aktiver Admin bleiben');
    }
    await repo().delete(user.id);
    request.log.info({ user: user.name, by: request.currentUser!.name }, 'Benutzer gelöscht');
    return reply.code(204).send();
  });
};
