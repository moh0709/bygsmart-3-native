
// This optional code is used to register a service worker.
// register() is not called by default.
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    // [::1] is the IPv6 localhost address.
    window.location.hostname === '[::1]' ||
    // 127.0.0.0/8 are considered localhost for IPv4.
    window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

type Config = {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
};

export function register(config?: Config) {
  if ('serviceWorker' in navigator) {
    const sendToAnalytics = (metric: {
      name: string;
      value: number;
      id: string;
    }) => {
      const gtag = (window as any).gtag;
      if (typeof gtag === 'function') {
        gtag('event', metric.name, { value: metric.value, metric_id: metric.id });
      }
    };
    onCLS(sendToAnalytics);
    onINP(sendToAnalytics);
    onLCP(sendToAnalytics);
    onFCP(sendToAnalytics);
    onTTFB(sendToAnalytics);

    // 1. Safety check for protocols where Service Workers aren't supported or useful in this context
    if (window.location.protocol === 'file:' || window.location.protocol === 'about:') {
      return;
    }

    // 2. Robust URL check
    try {
        // Handle environment where process might not be defined
        const publicUrlStr = (typeof process !== 'undefined' && process.env && process.env.PUBLIC_URL) || '';
        
        // If the variable is an unreplaced placeholder (common in some bundlers), treat as empty
        if (publicUrlStr.includes('%')) {
             // Skip origin check if env var is malformed
        } else {
             const publicUrl = new URL(publicUrlStr, window.location.href);
             if (publicUrl.origin !== window.location.origin) {
               // Our service worker won't work if PUBLIC_URL is on a different origin
               // from what our page is served on. This might happen if a CDN is used to
               // serve assets; see https://github.com/facebook/create-react-app/issues/2374
               return;
             }
        }
    } catch (e) {
        // If we can't construct the URL (e.g. invalid env var), simply skip registration to avoid crashing
        console.warn('Skipping service worker registration due to URL validation error:', e);
        return;
    }

    window.addEventListener('load', () => {
      // Construct absolute URL to avoid issues with <base> tags and subpath deploys.
      let swUrl = `${import.meta.env.BASE_URL}sw.js`;
      try {
         // We use window.location.origin as base to ensure it matches the current origin
         // Only if origin exists (not null/opaque)
         if (window.location.origin && window.location.origin !== 'null') {
             swUrl = new URL(`${import.meta.env.BASE_URL}sw.js`, window.location.origin).href;
         }
      } catch (e) {
         console.warn('Could not construct absolute SW URL, using relative path.');
      }

      if (isLocalhost) {
        // This is running on localhost. Let's check if a service worker still exists or not.
        checkValidServiceWorker(swUrl, config);

        // Add some additional logging to localhost, pointing developers to the
        // service worker/PWA documentation.
        navigator.serviceWorker.ready.then(() => {
          console.log(
            'This web app is being served cache-first by a service ' +
              'worker. To learn more, visit https://cra.link/PWA'
          );
        });
      } else {
        // Is not localhost. Just register service worker
        registerValidSW(swUrl, config);
      }
    });
  }
}

function registerValidSW(swUrl: string, config?: Config) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) {
          return;
        }
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // At this point, the updated precached content has been fetched,
              // but the previous service worker will still serve the older
              // content until all client tabs are closed.
              console.log(
                'New content is available and will be used when all ' +
                  'tabs for this page are closed. See https://cra.link/PWA.'
              );

              // Execute callback
              if (config && config.onUpdate) {
                config.onUpdate(registration);
              }
            } else {
              // At this point, everything has been precached.
              // It's the perfect time to display a
              // "Content is cached for offline use." message.
              console.log('Content is cached for offline use.');

              // Execute callback
              if (config && config.onSuccess) {
                config.onSuccess(registration);
              }
            }
          }
        };
      };
    })
    .catch((error) => {
      console.error('Error during service worker registration:', error);
    });
}

function checkValidServiceWorker(swUrl: string, config?: Config) {
  // Check if the service worker can be found. If it can't reload the page.
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' },
  })
    .then((response) => {
      // Ensure service worker exists, and that we really are getting a JS file.
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        // No service worker found. Probably a different app. Reload the page.
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        // Service worker found. Proceed as normal.
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      console.log('No internet connection found. App is running in offline mode.');
    });
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}
