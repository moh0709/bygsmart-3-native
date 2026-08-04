import { defineConfig } from 'vitest/config';

// D-11 spike unit tests — the engine-agnostic, hardware-independent parts (tier logic,
// scenario-matrix integrity). Run: `pnpm test:spike`. Not part of the mandatory green
// gate (spikes/ is throwaway, deleted once D-11 is signed).
export default defineConfig({
  test: { name: 'spike', include: ['spikes/**/*.test.ts'] },
});
