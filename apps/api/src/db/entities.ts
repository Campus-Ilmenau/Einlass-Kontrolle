import { EntitySchema } from 'typeorm';
import type { AgeGroup, Role } from '@einlass/shared';

/**
 * Entitäten als EntitySchema (ohne Decorators). Das Schema selbst wird ausschließlich über
 * Migrationen gepflegt (`synchronize: false`), die Definitionen hier müssen dazu passen.
 */

const timestamps = {
  createdAt: { type: 'timestamptz', name: 'created_at', createDate: true },
  updatedAt: { type: 'timestamptz', name: 'updated_at', updateDate: true },
} as const;

const uuidPk = { type: 'uuid', primary: true, generated: 'uuid' } as const;

// ─── Benutzer ──────────────────────────────────────────────────────────────

export interface UserEntity {
  id: string;
  name: string;
  passwordHash: string;
  role: Role;
  disabled: boolean;
  validUntil: Date | null;
  failedLoginCount: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = new EntitySchema<UserEntity>({
  name: 'User',
  tableName: 'users',
  columns: {
    id: uuidPk,
    name: { type: 'varchar', length: 50 },
    passwordHash: { type: 'text', name: 'password_hash' },
    role: { type: 'varchar', length: 16 },
    disabled: { type: 'boolean', default: false },
    validUntil: { type: 'timestamptz', name: 'valid_until', nullable: true },
    failedLoginCount: { type: 'integer', name: 'failed_login_count', default: 0 },
    lockedUntil: { type: 'timestamptz', name: 'locked_until', nullable: true },
    lastLoginAt: { type: 'timestamptz', name: 'last_login_at', nullable: true },
    ...timestamps,
  },
});

// ─── Freilisten ────────────────────────────────────────────────────────────

export interface FreeListEntity {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const FreeListSchema = new EntitySchema<FreeListEntity>({
  name: 'FreeList',
  tableName: 'free_lists',
  columns: {
    id: uuidPk,
    name: { type: 'varchar', length: 100 },
    description: { type: 'varchar', length: 500, nullable: true },
    ...timestamps,
  },
});

export interface FreeListEntryEntity {
  id: string;
  listId: string;
  matrikelnummer: string;
  note: string | null;
  createdAt: Date;
}

export const FreeListEntrySchema = new EntitySchema<FreeListEntryEntity>({
  name: 'FreeListEntry',
  tableName: 'free_list_entries',
  columns: {
    id: uuidPk,
    listId: { type: 'uuid', name: 'list_id' },
    matrikelnummer: { type: 'char', length: 5 },
    note: { type: 'varchar', length: 200, nullable: true },
    createdAt: timestamps.createdAt,
  },
});

// ─── Veranstaltungen ───────────────────────────────────────────────────────

export interface EventEntity {
  id: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  /** Geheimnis für HMAC der Matrikelnummern im Scan-Protokoll */
  hashSalt: string;
  createdAt: Date;
  updatedAt: Date;
}

export const EventSchema = new EntitySchema<EventEntity>({
  name: 'Event',
  tableName: 'events',
  columns: {
    id: uuidPk,
    name: { type: 'varchar', length: 100 },
    startsAt: { type: 'timestamptz', name: 'starts_at' },
    endsAt: { type: 'timestamptz', name: 'ends_at' },
    hashSalt: { type: 'varchar', length: 64, name: 'hash_salt', select: false },
    ...timestamps,
  },
});

export interface EventFreeListEntity {
  eventId: string;
  listId: string;
}

export const EventFreeListSchema = new EntitySchema<EventFreeListEntity>({
  name: 'EventFreeList',
  tableName: 'event_free_lists',
  columns: {
    eventId: { type: 'uuid', name: 'event_id', primary: true },
    listId: { type: 'uuid', name: 'list_id', primary: true },
  },
});

// ─── Scan-Protokoll ────────────────────────────────────────────────────────

export interface CheckLogEntity {
  id: string;
  eventId: string;
  userId: string | null;
  matrikelHash: string;
  matchedListIds: string[];
  ageGroup: AgeGroup;
  createdAt: Date;
}

export const CheckLogSchema = new EntitySchema<CheckLogEntity>({
  name: 'CheckLog',
  tableName: 'check_logs',
  columns: {
    id: uuidPk,
    eventId: { type: 'uuid', name: 'event_id' },
    userId: { type: 'uuid', name: 'user_id', nullable: true },
    matrikelHash: { type: 'varchar', length: 64, name: 'matrikel_hash' },
    matchedListIds: { type: 'uuid', array: true, name: 'matched_list_ids', default: () => "'{}'" },
    ageGroup: { type: 'varchar', length: 8, name: 'age_group' },
    createdAt: timestamps.createdAt,
  },
});

// ─── Einstellungen ─────────────────────────────────────────────────────────

export interface SettingEntity {
  key: string;
  value: unknown;
  updatedAt: Date;
}

export const SettingSchema = new EntitySchema<SettingEntity>({
  name: 'Setting',
  tableName: 'settings',
  columns: {
    key: { type: 'varchar', length: 100, primary: true },
    value: { type: 'jsonb' },
    updatedAt: timestamps.updatedAt,
  },
});

// ─── Zeitabgleich ──────────────────────────────────────────────────────────

export type TimeSyncSource = 'LOGIN' | 'ME' | 'ADMIN' | 'NTP';

export interface TimeSyncLogEntity {
  id: string;
  source: TimeSyncSource;
  userId: string | null;
  serverTimeBefore: Date;
  clientTime: Date;
  driftSeconds: number;
  action: 'adjusted' | 'rejected' | 'warning';
  reason: string | null;
  createdAt: Date;
}

export const TimeSyncLogSchema = new EntitySchema<TimeSyncLogEntity>({
  name: 'TimeSyncLog',
  tableName: 'time_sync_logs',
  columns: {
    id: uuidPk,
    source: { type: 'varchar', length: 8 },
    userId: { type: 'uuid', name: 'user_id', nullable: true },
    serverTimeBefore: { type: 'timestamptz', name: 'server_time_before' },
    clientTime: { type: 'timestamptz', name: 'client_time' },
    driftSeconds: { type: 'double precision', name: 'drift_seconds' },
    action: { type: 'varchar', length: 16 },
    reason: { type: 'varchar', length: 40, nullable: true },
    createdAt: timestamps.createdAt,
  },
});

// ─── Gespeicherte Statistik ────────────────────────────────────────────────

export interface EventStatsSnapshotEntity {
  eventId: string;
  stats: unknown;
  createdAt: Date;
}

export const EventStatsSnapshotSchema = new EntitySchema<EventStatsSnapshotEntity>({
  name: 'EventStatsSnapshot',
  tableName: 'event_stats',
  columns: {
    eventId: { type: 'uuid', name: 'event_id', primary: true },
    stats: { type: 'jsonb' },
    createdAt: timestamps.createdAt,
  },
});

export const ALL_ENTITIES = [
  UserSchema,
  FreeListSchema,
  FreeListEntrySchema,
  EventSchema,
  EventFreeListSchema,
  CheckLogSchema,
  SettingSchema,
  TimeSyncLogSchema,
  EventStatsSnapshotSchema,
];
