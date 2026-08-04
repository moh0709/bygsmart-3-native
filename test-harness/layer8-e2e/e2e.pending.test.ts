// TEST LAYER 8 — End-to-end journeys. RED-PENDING until P5.
// The same 12 journeys run by Maestro on device AND Playwright against the web build of
// the SAME app. This placeholder holds the lane; the real runners live outside vitest
// (Maestro flows + Playwright specs) and are invoked by the nightly CI job.
import { describe, it, expect } from 'vitest';

describe('Layer 8 — E2E journeys (RED-PENDING)', () => {
  it('fails until the 12 journeys pass on device (Maestro) and web (Playwright)', () => {
    expect.fail('Layer 8 not implemented — see 03_BUILD_PLAN.md §5, deliverable E10/P5-P6');
  });
});
