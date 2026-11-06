import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Erstes Datenbankschema (siehe konzept/05-datenmodell.md).
 * Fachliche Regeln, die die Datenbank selbst absichern kann, stehen hier als Constraints:
 * - Benutzernamen eindeutig ohne Groß-/Kleinschreibung
 * - Matrikelnummer genau 5 Ziffern
 * - Veranstaltungen überschneiden sich nicht (Exclusion-Constraint auf dem Zeitraum)
 */
export class InitialSchema1762459200000 implements MigrationInterface {
  name = 'InitialSchema1762459200000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE users (
        id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name               varchar(50)  NOT NULL,
        password_hash      text         NOT NULL,
        role               varchar(16)  NOT NULL CHECK (role IN ('ADMIN', 'CONTROLLER')),
        disabled           boolean      NOT NULL DEFAULT false,
        valid_until        timestamptz,
        failed_login_count integer      NOT NULL DEFAULT 0,
        locked_until       timestamptz,
        last_login_at      timestamptz,
        created_at         timestamptz  NOT NULL DEFAULT now(),
        updated_at         timestamptz  NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE UNIQUE INDEX users_name_lower_uq ON users (lower(name))`);

    await q.query(`
      CREATE TABLE free_lists (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name        varchar(100) NOT NULL,
        description varchar(500),
        created_at  timestamptz  NOT NULL DEFAULT now(),
        updated_at  timestamptz  NOT NULL DEFAULT now()
      )`);

    await q.query(`
      CREATE TABLE free_list_entries (
        id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        list_id        uuid        NOT NULL REFERENCES free_lists (id) ON DELETE CASCADE,
        matrikelnummer char(5)     NOT NULL CHECK (matrikelnummer ~ '^[0-9]{5}$'),
        note           varchar(200),
        created_at     timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT free_list_entries_list_matrikel_uq UNIQUE (list_id, matrikelnummer)
      )`);
    await q.query(
      `CREATE INDEX free_list_entries_matrikel_idx ON free_list_entries (matrikelnummer)`,
    );

    await q.query(`
      CREATE TABLE events (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name       varchar(100) NOT NULL,
        starts_at  timestamptz  NOT NULL,
        ends_at    timestamptz  NOT NULL,
        hash_salt  varchar(64)  NOT NULL,
        created_at timestamptz  NOT NULL DEFAULT now(),
        updated_at timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT events_time_order_chk CHECK (ends_at > starts_at),
        CONSTRAINT events_no_overlap EXCLUDE USING gist (tstzrange(starts_at, ends_at, '[)') WITH &&)
      )`);

    await q.query(`
      CREATE TABLE event_free_lists (
        event_id uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
        list_id  uuid NOT NULL REFERENCES free_lists (id) ON DELETE CASCADE,
        PRIMARY KEY (event_id, list_id)
      )`);

    await q.query(`
      CREATE TABLE check_logs (
        id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id         uuid        NOT NULL REFERENCES events (id) ON DELETE CASCADE,
        user_id          uuid        REFERENCES users (id) ON DELETE SET NULL,
        matrikel_hash    varchar(64) NOT NULL,
        matched_list_ids uuid[]      NOT NULL DEFAULT '{}',
        age_group        varchar(8)  NOT NULL CHECK (age_group IN ('U16', 'U18', 'ADULT')),
        created_at       timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX check_logs_event_hash_idx ON check_logs (event_id, matrikel_hash)`);
    await q.query(`CREATE INDEX check_logs_created_idx ON check_logs (created_at)`);

    await q.query(`
      CREATE TABLE settings (
        key        varchar(100) PRIMARY KEY,
        value      jsonb        NOT NULL,
        updated_at timestamptz  NOT NULL DEFAULT now()
      )`);
    await q.query(`INSERT INTO settings (key, value) VALUES ('checkLogRetentionDays', '7')`);

    await q.query(`
      CREATE TABLE time_sync_logs (
        id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        source             varchar(8)       NOT NULL,
        user_id            uuid             REFERENCES users (id) ON DELETE SET NULL,
        server_time_before timestamptz      NOT NULL,
        client_time        timestamptz      NOT NULL,
        drift_seconds      double precision NOT NULL,
        action             varchar(16)      NOT NULL,
        reason             varchar(40),
        created_at         timestamptz      NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX time_sync_logs_created_idx ON time_sync_logs (created_at DESC)`);
  }

  async down(q: QueryRunner): Promise<void> {
    for (const table of [
      'time_sync_logs',
      'settings',
      'check_logs',
      'event_free_lists',
      'events',
      'free_list_entries',
      'free_lists',
      'users',
    ]) {
      await q.query(`DROP TABLE IF EXISTS ${table}`);
    }
  }
}
