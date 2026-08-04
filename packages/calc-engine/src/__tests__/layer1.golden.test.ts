// TEST LAYER 1 — Formula golden fixtures. REAL in P0.
// Every `computable` calculator gets typical/boundary/invalid/unit-edge fixtures,
// captured by running the 2.1 implementation across an input grid (never hand-written),
// with a human review of the cases where 2.1 is wrong. Target: 100% coverage.
// This trivial test proves the lane is wired; real fixtures land with @bygsmart/calc-engine in P4.
import { describe, it, expect } from 'vitest';
import { PLACEHOLDER_CALC_ENGINE } from '../index';

describe('Layer 1 — calc-engine golden fixtures (harness live)', () => {
  it('wires the calc-engine test lane', () => {
    expect(PLACEHOLDER_CALC_ENGINE).toBe('bygsmart-calc-engine');
  });
});
