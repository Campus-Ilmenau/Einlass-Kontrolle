import {
  ageAt,
  calendarDateInTimeZone,
  CheckContextSchema,
  CheckRequestSchema,
  CheckResponseSchema,
  checkBirthDate,
  parseIsoDate,
} from '@einlass/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { authenticate, requireRole } from '../auth/session.js';
import { CheckLogSchema } from '../db/entities.js';
import { findActiveEvent, toActiveEventDto } from '../events/active-event.js';
import { badRequest, conflict } from '../http/errors.js';
import { matrikelHash } from './matrikel-hash.js';

const BIRTH_DATE_MESSAGES = {
  INVALID_DATE: 'Ungültiges Geburtsdatum',
  IN_FUTURE: 'Geburtsdatum liegt in der Zukunft',
  TOO_OLD: 'Geburtsdatum unplausibel',
} as const;

/** Kontrolle am Einlass – nur für Kontrolleur:innen (Admins scannen nicht). */
export const checkRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', authenticate(app));
  app.addHook('preHandler', requireRole('CONTROLLER'));

  app.get('/context', { schema: { response: { 200: CheckContextSchema } } }, async () => {
    const now = app.now();
    const event = await findActiveEvent(app.dataSource, now);
    return {
      event: event ? await toActiveEventDto(app.dataSource, event) : null,
      serverTime: now.toISOString(),
    };
  });

  app.post(
    '/',
    { schema: { body: CheckRequestSchema, response: { 200: CheckResponseSchema } } },
    async (request) => {
      const now = app.now();
      const { matrikelnummer, birthDate } = request.body;

      const event = await findActiveEvent(app.dataSource, now);
      if (!event) throw conflict('NO_ACTIVE_EVENT', 'Keine Veranstaltung aktiv');

      const birth = parseIsoDate(birthDate);
      const problem = birth
        ? checkBirthDate(birth, calendarDateInTimeZone(now))
        : ('INVALID_DATE' as const);
      if (!birth || problem) {
        throw badRequest('INVALID_BIRTH_DATE', BIRTH_DATE_MESSAGES[problem ?? 'INVALID_DATE']);
      }

      const matchedLists: { id: string; name: string }[] = await app.dataSource.query(
        `SELECT DISTINCT l.id, l.name
         FROM free_list_entries fle
         JOIN event_free_lists efl ON efl.list_id = fle.list_id AND efl.event_id = $1
         JOIN free_lists l ON l.id = fle.list_id
         WHERE fle.matrikelnummer = $2
         ORDER BY l.name`,
        [event.id, matrikelnummer],
      );

      const { age, ageGroup } = ageAt(birth, now);
      const hash = matrikelHash(event.hashSalt, matrikelnummer);

      const logs = app.dataSource.getRepository(CheckLogSchema);
      const first = await logs.findOne({
        where: { eventId: event.id, matrikelHash: hash },
        order: { createdAt: 'ASC' },
      });

      await logs.insert({
        eventId: event.id,
        userId: request.currentUser!.id,
        matrikelHash: hash,
        matchedListIds: matchedLists.map((l) => l.id),
        ageGroup,
        createdAt: now,
      });

      // Live auf dem Display am Pi zeigen (ohne Matrikelnummer und Geburtsdatum)
      app.displayBus.publish({
        at: now.toISOString(),
        isFree: matchedLists.length > 0,
        lists: matchedLists.map((l) => l.name),
        age,
        ageGroup,
        alreadySeen: first !== null,
      });

      return {
        isFree: matchedLists.length > 0,
        matchedLists,
        age,
        ageGroup,
        alreadySeenAt: first ? first.createdAt.toISOString() : null,
      };
    },
  );
};
