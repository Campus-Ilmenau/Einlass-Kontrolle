import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from './entities.js';
import { InitialSchema1762459200000 } from './migrations/1762459200000-InitialSchema.js';
import { EventStatsSnapshots1762545600000 } from './migrations/1762545600000-EventStatsSnapshots.js';

export const MIGRATIONS = [InitialSchema1762459200000, EventStatsSnapshots1762545600000];

export function createDataSource(url: string): DataSource {
  return new DataSource({
    type: 'postgres',
    url,
    entities: ALL_ENTITIES,
    migrations: MIGRATIONS,
    migrationsTableName: 'migrations',
    migrationsTransactionMode: 'each',
    synchronize: false,
    logging: ['error', 'warn', 'migration'],
    // Zeitpunkte immer in UTC übertragen, Umrechnung nach Europe/Berlin macht die Fachlogik
    extra: { options: '-c timezone=UTC' },
  });
}

/** Verbindet und spielt ausstehende Migrationen ein. */
export async function initDatabase(dataSource: DataSource): Promise<string[]> {
  if (!dataSource.isInitialized) await dataSource.initialize();
  const ran = await dataSource.runMigrations({ transaction: 'each' });
  return ran.map((m) => m.name);
}
