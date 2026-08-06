import { describe, it, expect } from 'vitest';
import { mfaRequiredFromAal } from './mfa';

describe('mfaRequiredFromAal', () => {
  it('requires the second factor when a verified factor exists and the session is still aal1', () => {
    expect(mfaRequiredFromAal('aal1', 'aal2')).toBe(true);
  });
  it('does not gate once the session has stepped up to aal2', () => {
    expect(mfaRequiredFromAal('aal2', 'aal2')).toBe(false);
  });
  it('does not gate an account with no MFA (nextLevel aal1)', () => {
    expect(mfaRequiredFromAal('aal1', 'aal1')).toBe(false);
  });
  it('does not gate on a failed/absent AAL lookup (null levels)', () => {
    expect(mfaRequiredFromAal(null, null)).toBe(false);
    expect(mfaRequiredFromAal(undefined, undefined)).toBe(false);
  });
});
