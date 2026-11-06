import type { ActiveEvent } from '@einlass/shared';
import type { DataSource } from 'typeorm';
import { type EventEntity, EventSchema } from '../db/entities.js';

/** Die Veranstaltung, die zum Zeitpunkt `at` läuft (es gibt höchstens eine). Inklusive hashSalt. */
export async function findActiveEvent(ds: DataSource, at: Date): Promise<EventEntity | null> {
  return ds
    .getRepository(EventSchema)
    .createQueryBuilder('e')
    .addSelect('e.hashSalt')
    .where('e.starts_at <= :at AND e.ends_at > :at', { at })
    .getOne();
}

export async function eventLists(
  ds: DataSource,
  eventId: string,
): Promise<{ id: string; name: string }[]> {
  return ds.query(
    `SELECT l.id, l.name FROM event_free_lists efl JOIN free_lists l ON l.id = efl.list_id
     WHERE efl.event_id = $1 ORDER BY l.name`,
    [eventId],
  );
}

export async function toActiveEventDto(ds: DataSource, e: EventEntity): Promise<ActiveEvent> {
  return {
    id: e.id,
    name: e.name,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt.toISOString(),
    lists: await eventLists(ds, e.id),
  };
}
