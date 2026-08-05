import { defineConfig } from 'vitest/config';

// The i18next instance is renderer-agnostic — node env is enough to prove the
// da-DK catalog resolves, falls back, and has no empty strings.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
