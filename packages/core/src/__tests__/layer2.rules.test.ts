// TEST LAYER 2 — Pure business rules. REAL in P0.
// entitlement resolution, requires-closure, task access, project-tab access, visibility,
// status transitions. Target: >=90% lines, 100% of decision branches.
// This trivial test proves the lane is wired; real rules are harvested into @bygsmart/core in P1.
import { describe, it, expect } from 'vitest';
import { PLACEHOLDER_CORE } from '../index';

describe('Layer 2 — core business rules (harness live)', () => {
  it('wires the core test lane', () => {
    expect(PLACEHOLDER_CORE).toBe('bygsmart-core');
  });
});
