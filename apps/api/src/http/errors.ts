/** Fachlicher Fehler mit HTTP-Status und maschinenlesbarem Code (z. B. `LAST_ADMIN`). */
export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const notFound = (what: string) => new ApiError(404, 'NOT_FOUND', `${what} nicht gefunden`);
export const badRequest = (code: string, message: string) => new ApiError(400, code, message);
export const conflict = (code: string, message: string) => new ApiError(409, code, message);

interface PgError {
  code?: string;
  constraint?: string;
}

/** Übersetzt bekannte PostgreSQL-Constraint-Verletzungen in fachliche Fehler. */
export function fromDatabaseError(err: unknown): ApiError | null {
  const driver = (err as { driverError?: PgError })?.driverError ?? (err as PgError);
  switch (driver?.code) {
    case '23505': // unique_violation
      if (driver.constraint === 'users_name_lower_uq') {
        return conflict('NAME_TAKEN', 'Dieser Name ist bereits vergeben');
      }
      return conflict('DUPLICATE', 'Eintrag existiert bereits');
    case '23P01': // exclusion_violation
      if (driver.constraint === 'events_no_overlap') {
        return conflict('EVENT_OVERLAP', 'Überschneidet sich mit einer anderen Veranstaltung');
      }
      return conflict('CONFLICT', 'Konflikt mit bestehenden Daten');
    case '23514': // check_violation
      return badRequest('CHECK_VIOLATION', 'Ungültige Werte');
    case '23503': // foreign_key_violation
      return badRequest('UNKNOWN_REFERENCE', 'Verweis auf nicht vorhandenen Datensatz');
    default:
      return null;
  }
}
