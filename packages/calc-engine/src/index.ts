// @bygsmart/calc-engine — calculator formulas as pure functions.
// P0.2 measured 34/89 divergent (11 partial + 23 own-maths); ~55 are near-mechanical
// harvests. Built in P4 (E5, off the critical path). Test layer 1: 100% golden fixtures,
// captured by running 2.1 across an input grid — where 2.1 is wrong, 3.0 is fixed.

export const PLACEHOLDER_CALC_ENGINE = 'bygsmart-calc-engine' as const;
