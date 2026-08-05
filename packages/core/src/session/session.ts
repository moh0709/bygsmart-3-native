// @bygsmart/core — per-runtime offline session policy (P2 2.6, PRD §4.2). Pure.
//
// Native and web get DIFFERENT offline grace windows because their durability
// differs (native = durable secure storage; web = evictable). When unsynced work
// exists on native, re-entering the session requires a biometric unlock so an
// unattended device can't leak queued work. The secure-storage read and the actual
// biometric prompt are app/native concerns; THIS decides the policy.

export type Runtime = 'native' | 'web';

/** Offline grace before re-authentication is required. */
export const SESSION_GRACE_MS: Record<Runtime, number> = {
  native: 14 * 24 * 60 * 60 * 1000, // 14 days
  web: 72 * 60 * 60 * 1000, //         72 hours
};

export interface SessionState {
  runtime: Runtime;
  /** Epoch ms of the last successful online authentication / token refresh. */
  lastAuthAt: number;
  /** True while the outbox holds un-synced mutations. */
  hasUnsyncedWork: boolean;
}

export interface SessionDecision {
  /** Session is still within its offline grace. */
  valid: boolean;
  /** Epoch ms the grace expires. */
  expiresAt: number;
  /** Native + unsynced work ⇒ a biometric unlock is required to enter. */
  requiresBiometric: boolean;
  reason?: 'grace-expired';
}

/** Evaluate the offline session at `now` (epoch ms). */
export function evaluateSession(s: SessionState, now: number): SessionDecision {
  const expiresAt = s.lastAuthAt + SESSION_GRACE_MS[s.runtime];
  const valid = now < expiresAt;
  return {
    valid,
    expiresAt,
    requiresBiometric: s.runtime === 'native' && s.hasUnsyncedWork,
    reason: valid ? undefined : 'grace-expired',
  };
}
