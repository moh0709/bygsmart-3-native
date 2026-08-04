// TEST LAYER 3 — RLS policy tests (SQL). RED-PENDING until P2 (E2).
// Every syncable table × every role, positive AND negative. Extends 2.1's
// rls_profiles_overexposure_test.sql precedent. Runs against the baseline schema.
import { describe, it, expect } from 'vitest';

describe('Layer 3 — RLS policy suite (RED-PENDING)', () => {
  it('fails until the RLS suite runs every table × every role against the baseline schema', () => {
    // Intentionally failing. A failing placeholder cannot be forgotten; an absent layer can.
    expect.fail('Layer 3 not implemented — see 03_BUILD_PLAN.md §5, deliverable E2/P2 (2.8)');
  });
});
