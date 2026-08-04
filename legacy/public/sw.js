/* eslint-disable no-restricted-globals */
// Single source of truth for the BygSmart service worker (F-09). The legacy
// root-level sw.js was removed; only this file (served from the build output)
// is ever registered.
//
// Caching policy:
//   - API requests (/api/...) are NEVER cached — always straight to network.
//   - Navigations / HTML documents use network-first and the fresh response is
//     NOT written back to the cache, so a deployed security fix can never be
//     shadowed by a stale app shell. Offline falls back to the precached shell.
//   - Only same-origin, in-scope STATIC assets (script/style/image/font) are
//     runtime-cached, and never when the request carries an Authorization header.
//   - Bump CACHE_NAME on every change that must invalidate old caches; the
//     activate handler deletes every cache that is not the current one.
const CACHE_NAME = 'bygsmart-cache-v4';
const scopeUrl = new URL(self.registration.scope);
const scopedPath = (path) => new URL(path, scopeUrl).toString();
const urlsToCache = [
  scopedPath('./'),
  scopedPath('./index.html'),
  scopedPath('./manifest.json'),
  scopedPath('./pwa-icon.svg'),
];

const STATIC_ASSET_DESTINATIONS = new Set(['style', 'script', 'image', 'font']);

const isApiRequest = (url) => url.pathname.includes('/api/');

const isCacheableStaticAsset = (request, url) => {
  if (url.origin !== scopeUrl.origin) return false;
  if (!url.pathname.startsWith(scopeUrl.pathname)) return false;
  if (isApiRequest(url)) return false;
  if (request.headers.has('Authorization')) return false;
  return STATIC_ASSET_DESTINATIONS.has(request.destination);
};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)));
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // API responses are never cached — let the network handle them directly.
  if (isApiRequest(url)) return;

  // Navigations / HTML documents: network-first, offline-fallback to the
  // precached shell. The fresh response is intentionally not re-cached.
  if (
    event.request.mode === 'navigate' ||
    event.request.destination === 'document' ||
    url.pathname.endsWith('/index.html')
  ) {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches
          .match(event.request)
          .then((response) => response || caches.match(scopedPath('./')))
      )
    );
    return;
  }

  // Static assets only: cache-first with runtime population.
  if (isCacheableStaticAsset(event.request, url)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((networkResponse) => {
          if (
            !networkResponse ||
            networkResponse.status !== 200 ||
            networkResponse.type !== 'basic'
          ) {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        });
      })
    );
    return;
  }

  // Everything else (cross-origin, non-static) goes straight to the network.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
          return undefined;
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = { title: 'BygSmart', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'BygSmart';
  const options = {
    body: payload.body || 'Du har en ny besked.',
    icon: scopedPath('./pwa-icon.svg'),
    badge: scopedPath('./pwa-icon.svg'),
    data: {
      url: payload.url || scopedPath('./#/home'),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || scopedPath('./#/home');

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
