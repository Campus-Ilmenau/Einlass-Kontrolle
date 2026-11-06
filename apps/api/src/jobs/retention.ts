import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import type { DataSource } from 'typeorm';
import { readSettings } from '../admin/settings.js';
import { EventStatsSnapshotSchema } from '../db/entities.js';
import { computeEventStats } from '../stats/event-stats.js';

export interface RetentionResult {
  events: number;
  deletedLogs: number;
}

/**
 * Datenschutz: Scan-Protokolle beendeter Veranstaltungen nach der Aufbewahrungsfrist löschen.
 * Vorher wird die Statistik gesichert, damit die Zahlen erhalten bleiben.
 * Laufende Veranstaltungen werden nie angefasst.
 */
export async function runRetention(
  ds: DataSource,
  now: Date,
  log?: FastifyBaseLogger,
): Promise<RetentionResult> {
  const { checkLogRetentionDays } = await readSettings(ds);
  const cutoff = new Date(now.getTime() - checkLogRetentionDays * 24 * 3600_000);

  const events: { event_id: string }[] = await ds.query(
    `SELECT DISTINCT c.event_id FROM check_logs c JOIN events e ON e.id = c.event_id
     WHERE c.created_at < $1 AND e.ends_at <= $2`,
    [cutoff, now],
  );

  let deletedLogs = 0;
  for (const { event_id: eventId } of events) {
    await ds.transaction(async (em) => {
      const stats = await computeEventStats(em, eventId);
      await em
        .getRepository(EventStatsSnapshotSchema)
        .upsert({ eventId, stats: { ...stats, archived: true }, createdAt: now }, ['eventId']);
      const result = await em
        .createQueryBuilder()
        .delete()
        .from('check_logs')
        .where('event_id = :eventId', { eventId })
        .execute();
      deletedLogs += result.affected ?? 0;
    });
  }

  if (events.length) {
    log?.info(
      { events: events.length, deletedLogs, retentionDays: checkLogRetentionDays },
      'Alte Scan-Protokolle gelöscht (Statistik gesichert)',
    );
  }
  return { events: events.length, deletedLogs };
}

const INTERVAL_MS = 60 * 60_000;

/** Stündlich und einmal kurz nach dem Start. */
export function scheduleRetention(app: FastifyInstance): void {
  let timer: NodeJS.Timeout | undefined;
  const run = () =>
    runRetention(app.dataSource, app.now(), app.log).catch((err: unknown) =>
      app.log.error({ err }, 'Aufräum-Job fehlgeschlagen'),
    );
  app.addHook('onReady', async () => {
    setTimeout(run, 30_000).unref();
    timer = setInterval(run, INTERVAL_MS);
    timer.unref();
  });
  app.addHook('onClose', async () => clearInterval(timer));
}
