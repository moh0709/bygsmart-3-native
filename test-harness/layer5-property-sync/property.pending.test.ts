// TEST LAYER 5 — Property-based sync tests (fast-check). RED-PENDING until P3b (E4).
// Any sequence of offline mutations under any interleaving of syncs converges.
// 10,000 cases per run. Kills the outbox, cursor logic, conflict engine.
import { describe, it, expect } from 'vitest';

describe('Layer 5 — property-based sync convergence (RED-PENDING)', () => {
  it('fails until convergence holds under any mutation/sync interleaving', () => {
    expect.fail('Layer 5 not implemented — see 03_BUILD_PLAN.md §5, deliverable E4/P3b (3b.8)');
  });
});
