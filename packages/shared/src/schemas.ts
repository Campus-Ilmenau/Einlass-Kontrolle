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
