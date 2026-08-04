import path from 'path';
import { readFileSync } from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Single source of truth for the app version: package.json. Exposed to the
// client as the __APP_VERSION__ global (see vite-env.d.ts) so every display
// site (Sentry release tag, Settings "About" footer, etc.) reads the same value.
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const basePath = env.VITE_PUBLIC_BASE_PATH || '/';
  return {
    base: basePath,
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: {
        protocol: 'ws',
        host: '127.0.0.1',
        port: 3000,
        path: basePath,
      },
      proxy: {
        '/api': {
          target: 'http://localhost:3002',
          changeOrigin: true,
        },
      },
    },
    plugins: [react()],
    define: {
      // Supabase (kept for any legacy process.env access)
      'process.env.SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      // Production build optimizations
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalized = id.replace(/\\/g, '/');

            // Split large vendor libraries into stable chunks.
            if (normalized.includes('/node_modules/react/') ||
                normalized.includes('/node_modules/react-dom/') ||
                normalized.includes('/node_modules/react-router-dom/') ||
                normalized.includes('/node_modules/react-router/')) {
              return 'react-vendor';
            }

            if (normalized.includes('/node_modules/@supabase/')) {
              return 'supabase';
            }

            if (normalized.includes('/node_modules/html2canvas/') ||
                normalized.includes('/node_modules/html2canvas-pro/') ||
                normalized.includes('/node_modules/jspdf/')) {
              return 'pdf';
            }

            if (normalized.includes('/node_modules/three/') ||
                normalized.includes('/node_modules/@react-three/fiber/') ||
                normalized.includes('/node_modules/@react-three/drei/') ||
                normalized.includes('/node_modules/@react-three/xr/')) {
              return 'three';
            }

            // App-level chunking to avoid one oversized application bundle.
            if (normalized.includes('/modules/tools/pages/')) {
              return 'calculators-pages';
            }

            // gemini sits in the root static graph (App → Chatbot), so this
            // chunk is modulepreloaded at startup — keep it to gemini alone.
            if (normalized.includes('/modules/ai/services/gemini')) {
              return 'knowledge-domain';
            }

            // modules/knowledge and modules/reporting get NO manual chunk:
            // forcing them into one attracts Rollup's shared-module merging,
            // which put the chunk (incl. the ~1.3 MB regulation catalog) into
            // every page's static imports. Auto-chunking keeps the catalog in
            // a lazy chunk reachable only via the manifest's dynamic imports,
            // and keeps xlsx-only consumers (e.g. the Time tab) from fetching
            // the jsPDF side of reporting and vice versa.
            return undefined;
          },
        }
      }
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      exclude: ['tests/e2e/**', 'node_modules/**', '**/node_modules/**', 'dist/**'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        all: false,
        include: ['components/ErrorBoundary.tsx', 'config/subscriptionPlans.ts'],
        exclude: ['node_modules/', '*.config.*', 'dist/**', 'tests/**', 'server/**'],
        thresholds: {
          lines: 60,
          branches: 50,
          functions: 60,
        },
      },
    },
  };
});
