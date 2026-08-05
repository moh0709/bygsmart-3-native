import { defineConfig } from 'vitest/config';

// App unit tests — the db layer (repository contract, in-memory runtime, delta
// puller) is pure TS and runs in node. Native-runtime (SQLite) and web-runtime
// (wasm-SQLite/OPFS) suites are added with those implementations and run on their
// own targets; they will reuse contractSuite.ts.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
