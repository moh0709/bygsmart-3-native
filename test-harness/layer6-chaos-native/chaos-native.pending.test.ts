// TEST LAYER 6 — Chaos suite, NATIVE arm. RED-PENDING until P3b (E4). THE HARD GATE (G3b).
// Kill mid-upload · reboot with full outbox · disk full · airplane flapping · clock skew ·
// session expiry offline · two-device conflict. 100 randomised runs, ZERO loss. Nightly.
import { describe, it, expect } from 'vitest';

describe('Layer 6 — chaos (native) (RED-PENDING)', () => {
  it('fails until 100 consecutive randomised native runs show zero data loss', () => {
    expect.fail('Layer 6 not implemented — see 03_BUILD_PLAN.md §5, gate G3b (E4/P3b)');
  });
});
