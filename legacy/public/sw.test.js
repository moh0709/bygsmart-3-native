import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const serviceWorker = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8');

describe('public service worker', () => {
  test('uses a new cache version and network-first navigation handling', () => {
    expect(serviceWorker).toContain("const CACHE_NAME = 'bygsmart-cache-v4'");
    expect(serviceWorker).toContain("event.request.mode === 'navigate'");
    expect(serviceWorker).toContain('fetch(event.request)');
  });

  test('never runtime-caches API or auth-bearing requests', () => {
    // /api responses bypass the cache entirely.
    expect(serviceWorker).toContain('if (isApiRequest(url)) return;');
    // Requests carrying credentials are excluded from the static-asset cache.
    expect(serviceWorker).toContain("request.headers.has('Authorization')");
    // Only static asset destinations are eligible for runtime caching.
    expect(serviceWorker).toContain("new Set(['style', 'script', 'image', 'font'])");
  });
});
