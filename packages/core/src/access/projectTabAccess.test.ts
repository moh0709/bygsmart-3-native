// TEST LAYER 2 — project-tab branch precedence (pure). Covers resolveProjectTabBranch +
// allowedIn directly (the ALL_MANIFESTS integration matrix belongs in the app layer where
// the manifests live).
import { describe, it, expect } from 'vitest';
import { resolveProjectTabBranch, allowedIn } from './projectTabAccess';
import type { ProjectTabContext } from '../registry/types';

const ctx = (
  userRole: ProjectTabContext['userRole'],
  visibility: ProjectTabContext['visibility'] = null,
  isPartnerResource = false,
): ProjectTabContext => ({ userRole, visibility, isPartnerResource });

describe('resolveProjectTabBranch — precedence order', () => {
  it('CLIENT wins over any visibility', () => {
    expect(resolveProjectTabBranch(ctx('CLIENT'))).toBe('client');
    expect(resolveProjectTabBranch(ctx('CLIENT', 'all'))).toBe('client');
  });

  it('OWNER / MANAGER win over visibility', () => {
    expect(resolveProjectTabBranch(ctx('OWNER'))).toBe('owner-manager');
    expect(resolveProjectTabBranch(ctx('MANAGER', 'none'))).toBe('owner-manager');
  });

  it('each visibility maps to its branch', () => {
    expect(resolveProjectTabBranch(ctx('EMPLOYEE', 'all'))).toBe('vis-all');
    expect(resolveProjectTabBranch(ctx('EMPLOYEE', 'some'))).toBe('vis-some');
    expect(resolveProjectTabBranch(ctx('EMPLOYEE', 'standard'))).toBe('vis-standard');
    expect(resolveProjectTabBranch(ctx('EMPLOYEE', 'none'))).toBe('vis-none');
  });

  it('EXTERNAL WITH explicit visibility resolves through visibility, not external (the if-chain subtlety)', () => {
    expect(resolveProjectTabBranch(ctx('EXTERNAL', 'standard'))).toBe('vis-standard');
  });

  it('EXTERNAL or partner-resource without visibility → external', () => {
    expect(resolveProjectTabBranch(ctx('EXTERNAL'))).toBe('external');
    expect(resolveProjectTabBranch(ctx('EMPLOYEE', null, true))).toBe('external');
  });

  it('internal role, no visibility → fallback', () => {
    expect(resolveProjectTabBranch(ctx('EMPLOYEE'))).toBe('fallback');
  });
});

describe('allowedIn', () => {
  it('is true only for the listed branches', () => {
    const pred = allowedIn('owner-manager', 'vis-all');
    expect(pred(ctx('OWNER'))).toBe(true);
    expect(pred(ctx('EMPLOYEE', 'all'))).toBe(true);
    expect(pred(ctx('EMPLOYEE', 'none'))).toBe(false);
    expect(pred(ctx('CLIENT'))).toBe(false);
  });
});
