// MFA (TOTP second factor) — the aal gating rule, adapted from 2.1. Pure so it is
// unit-tested without a live GoTrue. A session authenticated with a password is at
// currentLevel 'aal1'; if the account has a VERIFIED factor, GoTrue reports
// nextLevel 'aal2'. Only then must the app hold for the second factor — and only when
// the step-up hasn't already happened (currentLevel !== 'aal2'). A failed/absent AAL
// lookup must NOT gate (never lock out an account with no MFA), so callers pass the
// result through this and default to false on error.
// Accept any string the SDK might report (its AuthenticatorAssuranceLevels type), while
// keeping 'aal1'/'aal2' as autocomplete hints.
export type AalLevel = 'aal1' | 'aal2' | (string & {}) | null | undefined;

export function mfaRequiredFromAal(currentLevel: AalLevel, nextLevel: AalLevel): boolean {
  return nextLevel === 'aal2' && currentLevel !== 'aal2';
}
