import { describe, it, expect } from 'vitest';
import type { ModuleId } from '../registry/types';
import {
  ENTITLEMENT_CACHE_TTL_MS,
  isEntitlementCacheValid,
  adjudicateReplay,
  FOUNDATION_MODULES,
} from './offlineAuth';

const T0 = 1_700_000_000_000;

describe('entitlement cache TTL', () => {
  it('is 72 hours and valid only within it', () => {
    expect(ENTITLEMENT_CACHE_TTL_MS).toBe(72 * 60 * 60 * 1000);
    expect(isEntitlementCacheValid(T0, T0 + 71 * 60 * 60 * 1000)).toBe(true);
    expect(isEntitlementCacheValid(T0, T0 + 73 * 60 * 60 * 1000)).toBe(false);
  });
});

describe('adjudicateReplay', () => {
  const enabled = new Set<ModuleId>(['field']); // purchasing NOT enabled

  it('always allows foundation + unmapped (identity/project/task) entities', () => {
    expect(adjudicateReplay('projects', enabled).allowed).toBe(true);
    expect(adjudicateReplay('tasks', enabled).allowed).toBe(true);
    expect(adjudicateReplay('profiles', enabled).allowed).toBe(true); // unmapped ⇒ kernel
    for (const m of FOUNDATION_MODULES) expect(m).toBeTruthy();
  });

  it('allows a feature entity whose module is entitled', () => {
    expect(adjudicateReplay('task_documentation', enabled).allowed).toBe(true); // field enabled
  });

  it('rejects a feature entity whose module was revoked', () => {
    const v = adjudicateReplay('purchases', enabled); // purchasing not in enabled
    expect(v.allowed).toBe(false);
    expect(v.reason).toMatch(/purchasing/);
  });

  it('fails open when entitlement data is unavailable (null)', () => {
    expect(adjudicateReplay('purchases', null).allowed).toBe(true);
  });
});
