// TEST LAYER 6b — Chaos suite, WEB arm. RED-PENDING until P3b (E4). THE HARD GATE (G3b).
// Storage eviction mid-outbox · quota exceeded · tab closed mid-upload · two tabs mutating
// one record · OPFS unavailable at startup · private-browsing session. 100 runs. Nightly.
// These failure modes do NOT exist on native — the browser is a different storage substrate.
import { describe, it, expect } from 'vitest';

describe('Layer 6b — chaos (web) (RED-PENDING)', () => {
  it('fails until 100 consecutive randomised web runs show zero data loss', () => {
    expect.fail('Layer 6b not implemented — see 03_BUILD_PLAN.md §5, gate G3b (E4/P3b)');
  });
});
