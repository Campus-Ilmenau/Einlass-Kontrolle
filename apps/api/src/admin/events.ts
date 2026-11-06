import { randomBytes } from 'node:crypto';
import {
  type Event,
  EventRequestSchema,
  EventStatsSchema,
  EventSchema as EventDtoSchema,
  type EventStatus,
  UpdateEventRequestSchema,
} from '@einlass/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { type EntityManager, In } from 'typeorm';
import { z } from 'zod';
import {
  type EventEntity,
  EventFreeListSchema,
  EventSchema,
  FreeListSchema,
} from '../db/entities.js';
import { badRequest, conflict, notFound } from '../http/errors.js';
import { getEventStats } from '../stats/event-stats.js';

const IdParams = z.object({ id: z.uuid() });

export function eventStatus(e: Pick<EventEntity, 'startsAt' | 'endsAt'>, now: Date): EventStatus {
  if (now < e.startsAt) return 'PLANNED';
  if (now < e.endsAt) return 'ACTIVE';
  return 'PAST';
}

async function setLists(em: EntityManager, eventId: string, listIds: string[]): Promise<void> {
  const unique = [...new Set(listIds)];
  if (unique.length) {
    const found = await em.getRepository(FreeListSchema).countBy({ id: In(unique) });
    if (found !== unique.length) throw badRequest('UNKNOWN_LIST', 'Unbekannte Freiliste');
  }
  await em.getRepository(EventFreeListSchema).delete({ eventId });
  if (unique.length) {
    await em
      .getRepository(EventFreeListSchema)
      .insert(unique.map((listId) => ({ eventId, listId })));
  }
}

export const adminEventRoutes: FastifyPluginAsyncZod = async (app) => {
  const ds = () => app.dataSource;

  const toDtos = async (events: EventEntity[]): Promise<Event[]> => {
    if (events.length === 0) return [];
    const rows: { event_id: string; id: string; name: string }[] = await ds().query(
      `SELECT efl.event_id, l.id, l.name
       FROM event_free_lists efl JOIN free_lists l ON l.id = efl.list_id
       WHERE efl.event_id = ANY($1::uuid[]) ORDER BY l.name`,
      [events.map((e) => e.id)],
    );
    const now = app.now();
    return events.map((e) => ({
      id: e.id,
      name: e.name,
      startsAt: e.startsAt.toISOString(),
      endsAt: e.endsAt.toISOString(),
      status: eventStatus(e, now),
      lists: rows.filter((r) => r.event_id === e.id).map((r) => ({ id: r.id, name: r.name })),
      createdAt: e.createdAt.toISOString(),
    }));
  };

  const load = async (id: string) => {
    const event = await ds().getRepository(EventSchema).findOneBy({ id });
    if (!event) throw notFound('Veranstaltung');
    return event;
  };

  const loadDto = async (id: string) => (await toDtos([await load(id)]))[0]!;

  app.get('/', { schema: { response: { 200: z.array(EventDtoSchema) } } }, async () => {
    const events = await ds()
      .getRepository(EventSchema)
      .find({ order: { startsAt: 'DESC' } });
    return toDtos(events);
  });

  app.get('/:id', { schema: { params: IdParams, response: { 200: EventDtoSchema } } }, async (r) =>
    loadDto(r.params.id),
  );

  app.post(
    '/',
    { schema: { body: EventRequestSchema, response: { 201: EventDtoSchema } } },
    async (request, reply) => {
      const { name, startsAt, endsAt, listIds } = request.body;
      const id = await ds().transaction(async (em) => {
        const saved = await em.getRepository(EventSchema).save({
          name,
          startsAt: new Date(startsAt),
          endsAt: new Date(endsAt),
          hashSalt: randomBytes(32).toString('hex'),
        });
        await setLists(em, saved.id, listIds);
        return saved.id;
      });
      request.log.info({ event: name, startsAt, endsAt }, 'Veranstaltung angelegt');
      return reply.code(201).send(await loadDto(id));
    },
  );

  app.patch(
    '/:id',
    {
      schema: {
        params: IdParams,
        body: UpdateEventRequestSchema,
        response: { 200: EventDtoSchema },
      },
    },
    async (request) => {
      const event = await load(request.params.id);
      const { name, startsAt, endsAt, listIds } = request.body;
      const next = {
        name: name ?? event.name,
        startsAt: startsAt ? new Date(startsAt) : event.startsAt,
        endsAt: endsAt ? new Date(endsAt) : event.endsAt,
      };
      if (next.endsAt <= next.startsAt) {
        throw badRequest('INVALID_RANGE', 'Ende muss nach dem Start liegen');
      }
      await ds().transaction(async (em) => {
        await em.getRepository(EventSchema).update(event.id, next);
        if (listIds) await setLists(em, event.id, listIds);
      });
      return loadDto(event.id);
    },
  );

  /** Laufende Veranstaltung sofort beenden. */
  app.post(
    '/:id/end',
    { schema: { params: IdParams, response: { 200: EventDtoSchema } } },
    async (request) => {
      const event = await load(request.params.id);
      const now = app.now();
      if (eventStatus(event, now) !== 'ACTIVE') {
        throw conflict('NOT_ACTIVE', 'Die Veranstaltung läuft gerade nicht');
      }
      await ds().getRepository(EventSchema).update(event.id, { endsAt: now });
      request.log.info({ event: event.name }, 'Veranstaltung vorzeitig beendet');
      return loadDto(event.id);
    },
  );

  app.get(
    '/:id/stats',
    { schema: { params: IdParams, response: { 200: EventStatsSchema } } },
    async (request) => {
      await load(request.params.id);
      return getEventStats(ds(), request.params.id);
    },
  );

  app.delete('/:id', { schema: { params: IdParams } }, async (request, reply) => {
    const result = await ds().getRepository(EventSchema).delete(request.params.id);
    if (!result.affected) throw notFound('Veranstaltung');
    return reply.code(204).send();
  });
};
