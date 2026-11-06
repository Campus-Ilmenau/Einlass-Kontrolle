/**
 * Regeln für den automatischen Zeitabgleich bei Login / Sitzungs-Wiederaufnahme
 * (siehe konzept/04-hardware-und-netzwerk.md).
 *
 * Reine Entscheidungsfunktion: Das Setzen der Uhr übernimmt die API über einen Host-Dienst.
 */

export const TIME_SYNC_RULES = {
  /** Abweichungen bis hierhin werden ignoriert */
  thresholdSeconds: 30,
  /** Ab dieser Abweichung wird der Admin auf eine große Korrektur hingewiesen */
  largeCorrectionSeconds: 5 * 60,
  /** Maximal erlaubter Sprung in die Zukunft */
  maxFutureJumpSeconds: 2 * 365 * 24 * 60 * 60,
  /** Nach einer Korrektur: so lange keine weitere automatische Korrektur durch andere Clients */
  cooldownSeconds: 10 * 60,
  /** Während einer aktiven Veranstaltung automatisch nur bis zu dieser Abweichung */
  maxDuringEventSeconds: 5 * 60,
  /** Toleranz gegenüber der "letzten bekannten Zeit" (wird nur minütlich gespeichert) */
  lastKnownToleranceSeconds: 90,
} as const;

export type TimeSyncAction = 'none' | 'adjusted' | 'rejected' | 'warning';

export type TimeSyncReason =
  | 'WITHIN_THRESHOLD'
  | 'BELOW_LAST_KNOWN_TIME'
  | 'TOO_FAR_IN_FUTURE'
  | 'RECENTLY_ADJUSTED'
  | 'EVENT_ACTIVE_LARGE_JUMP'
  | 'INVALID_CLIENT_TIME';

export interface TimeSyncInput {
  /** Aktuelle Systemzeit des Pi */
  serverNow: Date;
  /** Vom Client gemeldete Zeit */
  clientTime: Date;
  /** Letzte gespeicherte Zeit (Untergrenze), falls bekannt */
  lastKnownTime?: Date | null;
  /** Zeitpunkt (Serverzeit nach Korrektur) der letzten automatischen Korrektur */
  lastAdjustmentAt?: Date | null;
  /** Läuft gerade eine Veranstaltung? */
  eventActive: boolean;
}

export interface TimeSyncDecision {
  action: TimeSyncAction;
  /** clientTime − serverNow in Sekunden (positiv: Pi geht nach) */
  driftSeconds: number;
  reason?: TimeSyncReason;
  /** Zu setzende Zeit, nur bei action = 'adjusted' */
  targetTime?: Date;
  /** Große Korrektur → Hinweis an Admin (RTC-Batterie prüfen?) */
  largeCorrection?: boolean;
}

export function decideTimeSync(input: TimeSyncInput, rules = TIME_SYNC_RULES): TimeSyncDecision {
  const { serverNow, clientTime, lastKnownTime, lastAdjustmentAt, eventActive } = input;

  if (Number.isNaN(clientTime.getTime())) {
    return { action: 'rejected', driftSeconds: 0, reason: 'INVALID_CLIENT_TIME' };
  }

  const driftSeconds = Math.round((clientTime.getTime() - serverNow.getTime()) / 100) / 10;
  const absDrift = Math.abs(driftSeconds);

  if (absDrift <= rules.thresholdSeconds) {
    return { action: 'none', driftSeconds, reason: 'WITHIN_THRESHOLD' };
  }

  if (
    lastKnownTime &&
    clientTime.getTime() < lastKnownTime.getTime() - rules.lastKnownToleranceSeconds * 1000
  ) {
    return { action: 'rejected', driftSeconds, reason: 'BELOW_LAST_KNOWN_TIME' };
  }

  if (driftSeconds > rules.maxFutureJumpSeconds) {
    return { action: 'rejected', driftSeconds, reason: 'TOO_FAR_IN_FUTURE' };
  }

  if (
    lastAdjustmentAt &&
    serverNow.getTime() - lastAdjustmentAt.getTime() < rules.cooldownSeconds * 1000 &&
    serverNow.getTime() >= lastAdjustmentAt.getTime()
  ) {
    return { action: 'warning', driftSeconds, reason: 'RECENTLY_ADJUSTED' };
  }

  if (eventActive && absDrift > rules.maxDuringEventSeconds) {
    return { action: 'warning', driftSeconds, reason: 'EVENT_ACTIVE_LARGE_JUMP' };
  }

  return {
    action: 'adjusted',
    driftSeconds,
    targetTime: clientTime,
    largeCorrection: absDrift > rules.largeCorrectionSeconds,
  };
}
