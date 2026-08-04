import { describe, it, expect } from 'vitest';
import type { OrgMemberStatus, OrgMembership, Organization } from './org';
import { resolveActiveOrgId, selectActiveOrg } from './org';

const org = (id: string): Organization => ({
  id,
  name: `Org ${id}`,
  cvr: null,
  logoUrl: null,
  grandfathered: false,
  storageAllowanceGb: 5,
  sourceTeamId: null,
  createdBy: 'u1',
});

const member = (id: string, status: OrgMemberStatus): OrgMembership => ({
  role: 'member',
  status,
  org: org(id),
});

describe('resolveActiveOrgId', () => {
  it('keeps a requested id that maps to an active membership', () => {
    const ms = [member('a', 'active'), member('b', 'active')];
    expect(resolveActiveOrgId(ms, 'b')).toBe('b');
  });

  it('falls back to the first active membership when the requested id is pending', () => {
    const ms = [member('a', 'pending'), member('b', 'active')];
    expect(resolveActiveOrgId(ms, 'a')).toBe('b');
  });

  it('falls back when the requested id is unknown', () => {
    const ms = [member('a', 'active')];
    expect(resolveActiveOrgId(ms, 'zzz')).toBe('a');
  });

  it('returns null when there are no active memberships', () => {
    expect(resolveActiveOrgId([member('a', 'pending')], 'a')).toBeNull();
    expect(resolveActiveOrgId([], null)).toBeNull();
  });
});

describe('selectActiveOrg', () => {
  it('returns the resolved active org', () => {
    const ms = [member('a', 'active'), member('b', 'active')];
    expect(selectActiveOrg(ms, 'b')?.id).toBe('b');
  });

  it('never returns a pending membership org', () => {
    const ms = [member('a', 'pending')];
    expect(selectActiveOrg(ms, 'a')).toBeNull();
  });

  it('follows the fallback when the request is invalid', () => {
    const ms = [member('a', 'pending'), member('b', 'active')];
    expect(selectActiveOrg(ms, 'a')?.id).toBe('b');
  });
});
