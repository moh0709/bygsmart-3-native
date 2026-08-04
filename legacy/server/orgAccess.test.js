import { describe, it, expect } from 'vitest';
import { canManageOrg } from './orgAccess.js';

describe('canManageOrg', () => {
  it('allows active owner and admin', () => {
    expect(canManageOrg({ role: 'owner', status: 'active' })).toBe(true);
    expect(canManageOrg({ role: 'admin', status: 'active' })).toBe(true);
  });

  it('rejects members, pending/removed rows and missing membership', () => {
    expect(canManageOrg({ role: 'member', status: 'active' })).toBe(false);
    expect(canManageOrg({ role: 'owner', status: 'pending' })).toBe(false);
    expect(canManageOrg({ role: 'admin', status: 'removed' })).toBe(false);
    expect(canManageOrg(null)).toBe(false);
    expect(canManageOrg(undefined)).toBe(false);
  });
});
