import type { LoginErrorCode } from '@einlass/shared';

/** 5 Fehlversuche → 15 Minuten Sperre, danach automatisch wieder frei. */
export const LOCKOUT = {
  maxAttempts: 5,
  lockMinutes: 15,
} as const;

export interface LockState {
  failedLoginCount: number;
  lockedUntil: Date | null;
}

export function isLocked(state: LockState, now: Date): boolean {
  return state.lockedUntil !== null && state.lockedUntil.getTime() > now.getTime();
}

export interface FailureResult extends LockState {
  /** Verbleibende Versuche bis zur Sperre (0 = jetzt gesperrt) */
  remainingAttempts: number;
  lockedNow: boolean;
}

/** Neuer Zustand nach einem falschen Passwort. */
export function registerFailure(state: LockState, now: Date, rules = LOCKOUT): FailureResult {
  // Eine abgelaufene Sperre zählt nicht mehr – neuer Zyklus
  const base = state.lockedUntil && state.lockedUntil <= now ? 0 : state.failedLoginCount;
  const count = base + 1;
  if (count >= rules.maxAttempts) {
    return {
      failedLoginCount: 0,
      lockedUntil: new Date(now.getTime() + rules.lockMinutes * 60_000),
      remainingAttempts: 0,
      lockedNow: true,
    };
  }
  return {
    failedLoginCount: count,
    lockedUntil: null,
    remainingAttempts: rules.maxAttempts - count,
    lockedNow: false,
  };
}

/** Zustand nach erfolgreichem Login. */
export function registerSuccess(): LockState {
  return { failedLoginCount: 0, lockedUntil: null };
}

export interface AccountState {
  disabled: boolean;
  validUntil: Date | null;
}

/** Ist das Konto grundsätzlich nutzbar (unabhängig vom Passwort)? */
export function accountProblem(
  account: AccountState,
  now: Date,
): Extract<LoginErrorCode, 'DISABLED' | 'EXPIRED'> | null {
  if (account.disabled) return 'DISABLED';
  if (account.validUntil && account.validUntil.getTime() <= now.getTime()) return 'EXPIRED';
  return null;
}
