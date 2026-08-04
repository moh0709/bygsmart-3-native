// TEST LAYER 4 — Repository / sync contract tests. RED-PENDING until P3a (E3).
// The local-DB repository layer against a fake server, run against ALL THREE storage
// runtimes (native SQLite ×2, wasm SQLite over OPFS on web). Engine-agnostic BY DESIGN —
// this is what makes "swap the sync engine in a week" credible.
import { describe, it, expect } from 'vitest';

describe('Layer 4 — repository/sync contract ×3 runtimes (RED-PENDING)', () => {
  it('fails until one repository contract is satisfied on native SQLite ×2 and wasm/OPFS', () => {
    expect.fail('Layer 4 not implemented — see 03_BUILD_PLAN.md §5, deliverable E3/P3a (3a.5)');
  });
});
