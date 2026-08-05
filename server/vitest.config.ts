import { defineConfig } from 'vitest/config';

// Server tests: pure unit tests (cursor, entity registry) always run; the
// *.integration.test.ts suites self-skip unless the local Supabase env vars are
// present (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_JWT_SECRET), so CI — which
// has no database — stays green while local runs exercise real Postgres + RLS.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
