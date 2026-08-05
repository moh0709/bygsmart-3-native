import { describe, it, expect } from 'vitest';
import { evaluateSession, SESSION_GRACE_MS, type SessionState } from './session';

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_700_000_000_000;

describe('SESSION_GRACE_MS', () => {
  it('native grace is 14 days, web is 72 hours', () => {
    expect(SESSION_GRACE_MS.native).toBe(14 * DAY);
    expect(SESSION_GRACE_MS.web).toBe(72 * 60 * 60 * 1000);
    expect(SESSION_GRACE_MS.native).toBeGreaterThan(SESSION_GRACE_MS.web);
  });
});

describe('evaluateSession', () => {
  const base: SessionState = { runtime: 'native', lastAuthAt: T0, hasUnsyncedWork: false };

  it('is valid within the grace window and expired past it', () => {
    expect(evaluateSession(base, T0 + 13 * DAY).valid).toBe(true);
    const expired = evaluateSession(base, T0 + 15 * DAY);
    expect(expired.valid).toBe(false);
    expect(expired.reason).toBe('grace-expired');
  });

  it('web grace is shorter — at 4 days native is still valid, web has expired', () => {
    expect(evaluateSession({ ...base, runtime: 'native' }, T0 + 4 * DAY).valid).toBe(true);
    expect(evaluateSession({ ...base, runtime: 'web' }, T0 + 4 * DAY).valid).toBe(false);
  });

  it('requires biometric only on native with unsynced work', () => {
    expect(evaluateSession({ ...base, runtime: 'native', hasUnsyncedWork: true }, T0).requiresBiometric).toBe(true);
    expect(evaluateSession({ ...base, runtime: 'native', hasUnsyncedWork: false }, T0).requiresBiometric).toBe(false);
    expect(evaluateSession({ ...base, runtime: 'web', hasUnsyncedWork: true }, T0).requiresBiometric).toBe(false);
  });

  it('reports the correct expiry instant', () => {
    expect(evaluateSession(base, T0).expiresAt).toBe(T0 + 14 * DAY);
  });
});
