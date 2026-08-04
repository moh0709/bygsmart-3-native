// TEST LAYER 7 — Universal component tests. REAL in P0 (lane), full in P1.
// Every packages/ui component is executed TWICE — native renderer and React Native Web —
// or it is not a packages/ui test. This is the Liskov check on .web.tsx siblings: same
// props, same behaviour, different rendering. RNTL-on-both-renderers is wired when the
// first primitive lands in P1 (E1). This trivial test proves the lane exists now.
import { describe, it, expect } from 'vitest';
import { PLACEHOLDER_UI } from '../index';

describe('Layer 7 — universal component (harness live)', () => {
  it('wires the ui test lane', () => {
    expect(PLACEHOLDER_UI).toBe('bygsmart-ui');
  });
});
