import type { Role, User } from '@einlass/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { UserSchema, type UserEntity } from '../db/entities.js';
import { accountProblem } from './lockout.js';

export const SESSION_COOKIE = 'einlass_session';
/** Toleranz bei der Token-Prüfung, falls die Uhr gerade korrigiert wurde */
export const CLOCK_TOLERANCE_MS = 5 * 60_000;

export interface SessionPayload {
  sub: string;
  role: Role;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: SessionPayload;
    user: SessionPayload;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    currentUser?: UserEntity;
  }
}

export function toUserDto(u: UserEntity): User {
  return {
    id: u.id,
    name: u.name,
    role: u.role,
    validUntil: u.validUntil ? u.validUntil.toISOString() : null,
  };
}

/** Sitzungsende: Session-Dauer, aber nie nach "gültig bis". */
export function sessionExpiry(user: UserEntity, now: Date, sessionHours: number): Date {
  const max = new Date(now.getTime() + sessionHours * 3600_000);
  return user.validUntil && user.validUntil < max ? user.validUntil : max;
}

export async function issueSession(
  app: FastifyInstance,
  reply: FastifyReply,
  user: UserEntity,
  now: Date,
): Promise<void> {
  const expiresAt = sessionExpiry(user, now, app.config.SESSION_HOURS);
  const token = await reply.jwtSign(
    { sub: user.id, role: user.role },
    { expiresIn: expiresAt.getTime() - now.getTime(), clockTimestamp: now.getTime() },
  );
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: app.config.COOKIE_SECURE,
    sameSite: 'strict',
    expires: expiresAt,
  });
}

export function clearSession(app: FastifyInstance, reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, {
    path: '/',
    httpOnly: true,
    secure: app.config.COOKIE_SECURE,
    sameSite: 'strict',
  });
}

/**
 * preHandler: gültiges Token + Benutzer existiert, ist nicht deaktiviert und nicht abgelaufen.
 * Wird bei jeder Anfrage geprüft, damit Sperren sofort wirken.
 */
export function authenticate(app: FastifyInstance) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const now = app.now();
    try {
      await request.jwtVerify({
        clockTimestamp: now.getTime(),
        clockTolerance: CLOCK_TOLERANCE_MS,
      });
    } catch {
      return reply.code(401).send({ error: 'UNAUTHENTICATED', message: 'Nicht angemeldet' });
    }
    const user = await app.dataSource.getRepository(UserSchema).findOneBy({ id: request.user.sub });
    const problem = user ? accountProblem(user, now) : 'DISABLED';
    if (!user || problem) {
      clearSession(app, reply);
      return reply
        .code(401)
        .send({ error: problem ?? 'UNAUTHENTICATED', message: 'Sitzung nicht mehr gültig' });
    }
    request.currentUser = user;
  };
}

/** preHandler nach `authenticate`: nur bestimmte Rollen (Admin und Kontrolle sind strikt getrennt). */
export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.currentUser || !roles.includes(request.currentUser.role)) {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Keine Berechtigung' });
    }
  };
}
