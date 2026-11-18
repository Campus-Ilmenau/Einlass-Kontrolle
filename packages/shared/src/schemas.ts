import { z } from 'zod';
import { AGE_GROUPS } from './age.js';
import { MATRIKEL_REGEX } from './matrikel.js';

/** Gemeinsame Schemas für Requests und Responses zwischen Web-App und API. */

export const RoleSchema = z.enum(['ADMIN', 'CONTROLLER']);
export type Role = z.infer<typeof RoleSchema>;

export const AgeGroupSchema = z.enum(AGE_GROUPS);

export const MatrikelSchema = z
  .string()
  .trim()
  .regex(MATRIKEL_REGEX, 'Matrikelnummer muss genau 5 Ziffern haben');

/** Kalenderdatum `YYYY-MM-DD` */
export const IsoDateSchema = z.iso.date();

/** Zeitpunkt mit Zeitzone, z. B. `2026-11-06T20:15:00.000Z` */
export const InstantSchema = z.iso.datetime({ offset: true });

// ─── Auth ──────────────────────────────────────────────────────────────────

export const UserNameSchema = z.string().trim().min(2).max(50);
export const PasswordSchema = z.string().min(8).max(200);

export const LoginRequestSchema = z.object({
  name: UserNameSchema,
  password: z.string().min(1).max(200),
  clientTime: InstantSchema,
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const TimeSyncResultSchema = z.object({
  action: z.enum(['none', 'adjusted', 'rejected', 'warning']),
  driftSeconds: z.number(),
  reason: z.string().optional(),
  serverTime: InstantSchema,
});
export type TimeSyncResult = z.infer<typeof TimeSyncResultSchema>;

export const UserSchema = z.object({
  id: z.uuid(),
  name: UserNameSchema,
  role: RoleSchema,
  validUntil: InstantSchema.nullable(),
});
export type User = z.infer<typeof UserSchema>;

export const LoginResponseSchema = z.object({
  user: UserSchema,
  timeSync: TimeSyncResultSchema,
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const LoginErrorCodeSchema = z.enum(['INVALID', 'LOCKED', 'DISABLED', 'EXPIRED']);
export type LoginErrorCode = z.infer<typeof LoginErrorCodeSchema>;

// ─── Kontrolle ─────────────────────────────────────────────────────────────

export const CheckRequestSchema = z.object({
  matrikelnummer: MatrikelSchema,
  birthDate: IsoDateSchema,
});
export type CheckRequest = z.infer<typeof CheckRequestSchema>;

export const CheckResponseSchema = z.object({
  isFree: z.boolean(),
  matchedLists: z.array(z.object({ id: z.uuid(), name: z.string() })),
  age: z.number().int(),
  ageGroup: AgeGroupSchema,
  alreadySeenAt: InstantSchema.nullable(),
});
export type CheckResponse = z.infer<typeof CheckResponseSchema>;

// ─── Admin ─────────────────────────────────────────────────────────────────

export const CreateUserRequestSchema = z.object({
  name: UserNameSchema,
  password: PasswordSchema,
  role: RoleSchema,
  validUntil: InstantSchema.nullable().optional(),
});
export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;

export const EventRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    startsAt: InstantSchema,
    endsAt: InstantSchema,
    listIds: z.array(z.uuid()).default([]),
  })
  .refine((e) => new Date(e.endsAt) > new Date(e.startsAt), {
    message: 'Ende muss nach dem Start liegen',
    path: ['endsAt'],
  });
export type EventRequest = z.infer<typeof EventRequestSchema>;

export const FreeListRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
});
export type FreeListRequest = z.infer<typeof FreeListRequestSchema>;

export const AddEntriesRequestSchema = z.object({
  matrikelnummern: z.array(MatrikelSchema).min(1).max(20000),
});
export type AddEntriesRequest = z.infer<typeof AddEntriesRequestSchema>;

// ─── Admin: Kontrolleur:innen ──────────────────────────────────────────────

export const UserStatusSchema = z.enum(['ACTIVE', 'LOCKED', 'DISABLED', 'EXPIRED']);
export type UserStatus = z.infer<typeof UserStatusSchema>;

export const AdminUserSchema = UserSchema.extend({
  status: UserStatusSchema,
  disabled: z.boolean(),
  lockedUntil: InstantSchema.nullable(),
  lastLoginAt: InstantSchema.nullable(),
  createdAt: InstantSchema,
});
export type AdminUser = z.infer<typeof AdminUserSchema>;

export const UpdateUserRequestSchema = z
  .object({
    name: UserNameSchema,
    password: PasswordSchema,
    role: RoleSchema,
    disabled: z.boolean(),
    validUntil: InstantSchema.nullable(),
    /** Sperre nach Fehlversuchen aufheben */
    unlock: z.literal(true),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Keine Änderung angegeben' });
export type UpdateUserRequest = z.infer<typeof UpdateUserRequestSchema>;

// ─── Admin: Freilisten ─────────────────────────────────────────────────────

export const FreeListSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  entryCount: z.number().int(),
  /** Laufende und geplante Veranstaltungen, die diese Liste verwenden (vergangene nicht) */
  events: z.array(
    z.object({ id: z.uuid(), name: z.string(), status: z.enum(['ACTIVE', 'PLANNED']) }),
  ),
  createdAt: InstantSchema,
  updatedAt: InstantSchema,
});
export type FreeList = z.infer<typeof FreeListSchema>;

export const UpdateFreeListRequestSchema = FreeListRequestSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: 'Keine Änderung angegeben' },
);
export type UpdateFreeListRequest = z.infer<typeof UpdateFreeListRequestSchema>;

export const FreeListEntrySchema = z.object({
  id: z.uuid(),
  matrikelnummer: MatrikelSchema,
  note: z.string().nullable(),
  createdAt: InstantSchema,
});
export type FreeListEntry = z.infer<typeof FreeListEntrySchema>;

export const EntriesQuerySchema = z.object({
  search: z.string().trim().max(5).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
});

export const EntriesPageSchema = z.object({
  items: z.array(FreeListEntrySchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type EntriesPage = z.infer<typeof EntriesPageSchema>;

export const AddEntriesResultSchema = z.object({
  added: z.number().int(),
  alreadyInList: z.number().int(),
});
export type AddEntriesResult = z.infer<typeof AddEntriesResultSchema>;

export const ImportModeSchema = z.enum(['append', 'replace']);
export type ImportMode = z.infer<typeof ImportModeSchema>;

export const ImportReportSchema = z.object({
  mode: ImportModeSchema,
  format: z.enum(['csv', 'xlsx']),
  /** Spalte, aus der gelesen wurde (Überschrift oder Nummer, 1-basiert) */
  column: z.string(),
  rows: z.number().int(),
  added: z.number().int(),
  alreadyInList: z.number().int(),
  removed: z.number().int(),
  duplicatesInFile: z.number().int(),
  invalid: z.array(z.object({ row: z.number().int(), value: z.string() })),
  invalidCount: z.number().int(),
});
export type ImportReport = z.infer<typeof ImportReportSchema>;

// ─── Admin: Veranstaltungen ────────────────────────────────────────────────

export const EventStatusSchema = z.enum(['PLANNED', 'ACTIVE', 'PAST']);
export type EventStatus = z.infer<typeof EventStatusSchema>;

export const EventSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  startsAt: InstantSchema,
  endsAt: InstantSchema,
  status: EventStatusSchema,
  lists: z.array(z.object({ id: z.uuid(), name: z.string() })),
  createdAt: InstantSchema,
});
export type Event = z.infer<typeof EventSchema>;

export const UpdateEventRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    startsAt: InstantSchema,
    endsAt: InstantSchema,
    listIds: z.array(z.uuid()),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Keine Änderung angegeben' });
export type UpdateEventRequest = z.infer<typeof UpdateEventRequestSchema>;

// ─── Admin: Einstellungen ──────────────────────────────────────────────────

export const SettingsSchema = z.object({
  /** Aufbewahrungsfrist für Scan-Protokolle in Tagen */
  checkLogRetentionDays: z.number().int().min(1).max(365),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const UpdateSettingsRequestSchema = SettingsSchema.partial();
export type UpdateSettingsRequest = z.infer<typeof UpdateSettingsRequestSchema>;

// ─── Fehler ────────────────────────────────────────────────────────────────

export const ApiErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

// ─── Kontrolle: Kontext ────────────────────────────────────────────────────

export const ActiveEventSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  startsAt: InstantSchema,
  endsAt: InstantSchema,
  lists: z.array(z.object({ id: z.uuid(), name: z.string() })),
});
export type ActiveEvent = z.infer<typeof ActiveEventSchema>;

export const CheckContextSchema = z.object({
  /** Aktive Veranstaltung; `null` → Scannen ist gesperrt */
  event: ActiveEventSchema.nullable(),
  serverTime: InstantSchema,
});
export type CheckContext = z.infer<typeof CheckContextSchema>;

// ─── Statistik ─────────────────────────────────────────────────────────────

export const EventStatsSchema = z.object({
  eventId: z.uuid(),
  /** Alle Scans inkl. Doppel-Scans */
  scans: z.number().int(),
  /** Verschiedene Personen (über den HMAC der Matrikelnummer) */
  persons: z.number().int(),
  /** Scans derselben Person nach dem ersten */
  repeatedScans: z.number().int(),
  /** Personen mit freiem Eintritt */
  freePersons: z.number().int(),
  perList: z.array(z.object({ id: z.uuid(), name: z.string(), persons: z.number().int() })),
  /** Personen je Altersstufe */
  ageGroups: z.object({ U16: z.number().int(), U18: z.number().int(), ADULT: z.number().int() }),
  perUser: z.array(z.object({ name: z.string(), scans: z.number().int() })),
  /** true: Scan-Protokolle sind bereits gelöscht, Werte stammen aus der gespeicherten Zusammenfassung */
  archived: z.boolean(),
});
export type EventStats = z.infer<typeof EventStatsSchema>;

// ─── System ────────────────────────────────────────────────────────────────

export const SystemTimeSchema = z.object({
  serverTime: InstantSchema,
  hostd: z.boolean(),
  ntpSynchronized: z.boolean().nullable(),
  rtcPresent: z.boolean().nullable(),
  rtcTime: z.string().nullable(),
  lastKnownTime: InstantSchema.nullable(),
});
export type SystemTime = z.infer<typeof SystemTimeSchema>;

export const SetTimeRequestSchema = z.object({ time: InstantSchema });
export type SetTimeRequest = z.infer<typeof SetTimeRequestSchema>;

export const TimeSyncLogEntrySchema = z.object({
  id: z.uuid(),
  source: z.enum(['LOGIN', 'ME', 'ADMIN', 'NTP']),
  userName: z.string().nullable(),
  serverTimeBefore: InstantSchema,
  clientTime: InstantSchema,
  driftSeconds: z.number(),
  action: z.enum(['adjusted', 'rejected', 'warning']),
  reason: z.string().nullable(),
  createdAt: InstantSchema,
});
export type TimeSyncLogEntry = z.infer<typeof TimeSyncLogEntrySchema>;

/** Öffentlicher Status für das Display am Pi (keine personenbezogenen Daten). */
export const DisplayStatusSchema = z.object({
  serverTime: InstantSchema,
  event: z.object({ name: z.string(), endsAt: InstantSchema }).nullable(),
  persons: z.number().int(),
});
export type DisplayStatus = z.infer<typeof DisplayStatusSchema>;

// ─── Display am Pi (Touch-Display, per Token geschützt) ────────────────────

export const DisplayEventSchema = z.object({
  name: z.string(),
  startsAt: InstantSchema,
  endsAt: InstantSchema,
});

export const DisplayInfoSchema = z.object({
  serverTime: InstantSchema,
  appUrl: z.string(),
  wifi: z.object({ ssid: z.string(), password: z.string() }).nullable(),
  event: DisplayEventSchema.nullable(),
});
export type DisplayInfo = z.infer<typeof DisplayInfoSchema>;

/** Länge eines Balkens im Zeitverlauf */
export const DISPLAY_TIMELINE_MINUTES = 15;

export const DisplayStatsSchema = z.object({
  event: DisplayEventSchema.nullable(),
  persons: z.number().int(),
  scans: z.number().int(),
  freePersons: z.number().int(),
  perList: z.array(z.object({ name: z.string(), persons: z.number().int() })),
  ageGroups: z.object({ U16: z.number().int(), U18: z.number().int(), ADULT: z.number().int() }),
  /** Scans je Zeitabschnitt seit Beginn der Veranstaltung (lückenlos) */
  timeline: z.array(z.object({ at: InstantSchema, scans: z.number().int() })),
});
export type DisplayStats = z.infer<typeof DisplayStatsSchema>;

/** Live-Ereignis für das Display nach einem Scan (ohne Matrikelnummer und Geburtsdatum). */
export const DisplayScanEventSchema = z.object({
  at: InstantSchema,
  isFree: z.boolean(),
  lists: z.array(z.string()),
  age: z.number().int(),
  ageGroup: AgeGroupSchema,
  alreadySeen: z.boolean(),
});
export type DisplayScanEvent = z.infer<typeof DisplayScanEventSchema>;

/** Live-Ereignis: Kontrolleur:in hat das Ergebnis weggetippt → Display zeigt "Nächster bitte". */
export const DisplayNextEventSchema = z.object({ at: InstantSchema });
export type DisplayNextEvent = z.infer<typeof DisplayNextEventSchema>;
