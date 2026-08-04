import { defineConfig } from 'vitest/config';

// The RED-PENDING lane. These layers cannot be meaningfully written before the
// subsystems they test exist (P2/P3a/P3b), but an ABSENT layer can be forgotten and a
// FAILING one cannot. So each is a deliberately failing placeholder that CI surfaces as
// red-pending (a non-blocking job), separate from the green per-PR gate (layers 1/2/7).
export default defineConfig({
  test: {
    name: 'red-pending',
    include: ['test-harness/**/*.pending.test.ts'],
    passWithNoTests: false,
  },
});
