import { defineConfig } from 'vitest/config';

// TEST LAYER 2 — pure business rules. Node environment (no renderer): entitlements,
// requires-closure, task access, project-tab access, visibility, status transitions.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/registry/registry.ts', 'src/access/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      reporter: ['text-summary', 'text'],
    },
  },
});
