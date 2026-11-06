import { type EventStats, EventStatsSchema } from '@einlass/shared';
import type { DataSource, EntityManager } from 'typeorm';
import { EventStatsSnapshotSchema } from '../db/entities.js';

type Db = DataSource | EntityManager;
const n = (v: unknown) => Number(v ?? 0);

/** Statistik direkt aus den Scan-Protokollen berechnen. */
export async function computeEventStats(db: Db, eventId: string): Promise<EventStats> {
  const [totals] = await db.query(
    `SELECT count(*) AS scans,
            count(DISTINCT matrikel_hash) AS persons,
            count(DISTINCT matrikel_hash) FILTER (WHERE cardinality(matched_list_ids) > 0) AS free
     FROM check_logs WHERE event_id = $1`,
    [eventId],
  );

  const perList: { id: string; name: string; persons: string }[] = await db.query(
    `SELECT l.id, l.name, count(DISTINCT c.matrikel_hash) AS persons
     FROM event_free_lists efl
     JOIN free_lists l ON l.id = efl.list_id
     LEFT JOIN check_logs c ON c.event_id = efl.event_id AND efl.list_id = ANY (c.matched_list_ids)
     WHERE efl.event_id = $1
     GROUP BY l.id, l.name ORDER BY l.name`,
    [eventId],
  );

  const ages: { age_group: 'U16' | 'U18' | 'ADULT'; persons: string }[] = await db.query(
    `SELECT age_group, count(DISTINCT matrikel_hash) AS persons
     FROM check_logs WHERE event_id = $1 GROUP BY age_group`,
    [eventId],
  );

  const perUser: { name: string; scans: string }[] = await db.query(
    `SELECT coalesce(u.name, '(gelöscht)') AS name, count(*) AS scans
     FROM check_logs c LEFT JOIN users u ON u.id = c.user_id
     WHERE c.event_id = $1 GROUP BY 1 ORDER BY 2 DESC, 1`,
    [eventId],
  );

  const ageGroups = { U16: 0, U18: 0, ADULT: 0 };
  for (const a of ages) ageGroups[a.age_group] = n(a.persons);

  return {
    eventId,
    scans: n(totals.scans),
    persons: n(totals.persons),
    repeatedScans: n(totals.scans) - n(totals.persons),
    freePersons: n(totals.free),
    perList: perList.map((l) => ({ id: l.id, name: l.name, persons: n(l.persons) })),
    ageGroups,
    perUser: perUser.map((u) => ({ name: u.name, scans: n(u.scans) })),
    archived: false,
  };
}

/** Statistik: gespeicherte Zusammenfassung, falls die Protokolle schon gelöscht sind, sonst live. */
export async function getEventStats(ds: DataSource, eventId: string): Promise<EventStats> {
  const snapshot = await ds.getRepository(EventStatsSnapshotSchema).findOneBy({ eventId });
  if (snapshot) {
    const hasLogs = await ds.query(`SELECT 1 FROM check_logs WHERE event_id = $1 LIMIT 1`, [
      eventId,
    ]);
    if (hasLogs.length === 0) {
      return EventStatsSchema.parse({ ...(snapshot.stats as object), archived: true });
    }
  }
  return computeEventStats(ds, eventId);
}
