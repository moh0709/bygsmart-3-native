import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import boundaries from 'eslint-plugin-boundaries';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'server/**',
      'supabase/functions/**',
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        localStorage: 'readonly',
        fetch: 'readonly',
        FileReader: 'readonly',
        alert: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-empty': 'off',
      'no-unreachable': 'off',
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'jsx-a11y/alt-text': 'off',
    },
  },
  // ── Module boundaries (BYG 3.0 modular monolith) ────────────────────────────
  // core = Kernel (registry, entitlements, shell). modules/<id> = feature
  // modules whose ONLY public surface is index.ts (+ manifest.ts, which only
  // core/registry/manifests.ts may import). Existing code is 'legacy' and
  // unrestricted among itself during the strangler migration.
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'import/resolver': {
        node: { extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'] },
      },
      'boundaries/include': ['**/*.{ts,tsx}'],
      'boundaries/elements': [
        // Order matters — first match wins. Root-anchored full-path patterns
        // everywhere except 'module' (folder mode so the whole modules/<id>
        // subtree is ONE element — nested folder names like modules/tools/pages
        // must never leak into the root-level 'legacy' element).
        { type: 'core-manifests', pattern: 'core/registry/manifests.ts', mode: 'full' },
        { type: 'module', pattern: 'modules/*', mode: 'folder', capture: ['moduleId'] },
        { type: 'core', pattern: 'core/**/*', mode: 'full' },
        { type: 'shared', pattern: 'shared/**/*', mode: 'full' },
        {
          type: 'legacy',
          pattern: '{pages,components,services,contexts,hooks,stores,utils,config}/**/*',
          mode: 'full',
        },
      ],
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'allow',
          rules: [
            {
              from: ['core'],
              disallow: ['module'],
              message:
                'core må ikke importere fra modules/ — kun core/registry/manifests.ts samler manifester.',
            },
          ],
        },
      ],
      'boundaries/entry-point': [
        'error',
        {
          default: 'disallow',
          rules: [
            { target: ['core', 'core-manifests', 'shared', 'legacy'], allow: '**' },
            // A module's public surface: index.ts. manifest.ts is reserved for
            // core/registry/manifests.ts (the single assembly point).
            { target: ['module'], allow: ['index.ts', 'index.tsx', 'manifest.ts'] },
          ],
        },
      ],
    },
  },
];