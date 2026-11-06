import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gespeicherte Statistik je Veranstaltung. Der Aufräum-Job schreibt sie, bevor er die
 * Scan-Protokolle einer Veranstaltung löscht – so bleiben die Zahlen erhalten.
 */
export class EventStatsSnapshots1762545600000 implements MigrationInterface {
  name = 'EventStatsSnapshots1762545600000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE event_stats (
        event_id   uuid PRIMARY KEY REFERENCES events (id) ON DELETE CASCADE,
        stats      jsonb       NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS event_stats`);
  }
}
