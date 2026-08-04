// BygSmart 3.0 Native — module discipline, carried into the monorepo on DAY ONE (AR-07).
//
// This file is the mechanism behind two load-bearing architectural properties:
//   • AR-05  No screen may import a sync-engine type directly. Screens talk to the
//            repository contract (`db`) only — this is why "swap the sync engine in a
//            week" is credible. Enforced below: `screens` allow-list omits `sync`.
//   • legacy/ is a vendored, read-only 2.1 snapshot (deleted at G5). No shipping code
//            may import it — no element allow-list contains `legacy`, so any such
//            import is reported.
//
// eslint is pinned to v8 (classic config) on purpose; the flat-config migration is a
// tracked follow-up, not a day-one blocker.
/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['@typescript-eslint', 'import', 'boundaries'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:boundaries/recommended',
  ],
  settings: {
    'import/resolver': {
      typescript: { alwaysTryTypes: true, project: ['tsconfig.base.json'] },
    },
    // Order matters: the FIRST matching pattern wins, so the specific app-internal
    // element types (sync / db / screens) precede the app-shell catch-all.
    'boundaries/elements': [
      { type: 'tokens', pattern: 'packages/tokens/**' },
      { type: 'core', pattern: 'packages/core/**' },
      { type: 'calc-engine', pattern: 'packages/calc-engine/**' },
      { type: 'api-client', pattern: 'packages/api-client/**' },
      { type: 'ui', pattern: 'packages/ui/**' },
      { type: 'sync', pattern: 'apps/app/src/sync/**' },
      { type: 'db', pattern: 'apps/app/src/db/**' },
      { type: 'screens', pattern: 'apps/app/src/screens/**' },
      { type: 'app-shell', pattern: 'apps/app/**' },
      { type: 'admin', pattern: 'apps/admin/**' },
      { type: 'server', pattern: 'server/**' },
      { type: 'legacy', pattern: 'legacy/**' },
    ],
  },
  rules: {
    'boundaries/no-unknown': 'off',
    'boundaries/no-unknown-files': 'off',
    'boundaries/element-types': [
      'error',
      {
        default: 'disallow',
        rules: [
          // Shared packages — strict, one-directional dependencies.
          { from: 'tokens', allow: [] },
          { from: 'core', allow: [] },
          { from: 'calc-engine', allow: ['core'] },
          { from: 'api-client', allow: ['core'] },
          { from: 'ui', allow: ['tokens', 'core'] },

          // App-internal layers.
          // sync = the engine adapter (outbox, cursor, conflict). Behind the contract.
          { from: 'sync', allow: ['core', 'api-client'] },
          // db = the repository contract; the ONLY place the sync engine is wired in.
          { from: 'db', allow: ['core', 'api-client', 'sync'] },
          // screens — NOTE: `sync` is intentionally ABSENT. This is AR-05.
          { from: 'screens', allow: ['ui', 'core', 'calc-engine', 'api-client', 'db'] },
          // The app shell is the composition root: it may wire the engine at startup.
          { from: 'app-shell', allow: ['screens', 'db', 'sync', 'ui', 'tokens', 'core', 'calc-engine', 'api-client'] },

          // Back-office is DOM-native and online: no RN `ui`, no local `sync`/`db`.
          { from: 'admin', allow: ['core', 'api-client', 'tokens'] },

          // Server shares domain types only.
          { from: 'server', allow: ['core'] },
        ],
      },
    ],
  },
  ignorePatterns: ['node_modules/', 'dist/', '.expo/', 'web-build/', 'legacy/', '*.config.js', '*.config.cjs'],
};
