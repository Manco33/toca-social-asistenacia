/**
 * Service Worker para Aktiva Marcaje PWA
 * Maneja caching, sincronización en background y funcionamiento offline
 */

const CACHE_NAME = 'boco-marcaje-v2';

// Install event
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

// Activate event - clean up old caches so Server Actions never use stale hashes
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys
          .filter(function(key) {
            return key !== CACHE_NAME;
          })
          .map(function(key) {
            return caches.delete(key);
          })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch event - Only cache static assets (icons/images/models), never HTML pages or Next.js routes
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  if (url.origin !== location.origin) {
    return;
  }

  if (event.request.method !== 'GET') {
    return;
  }

  // Never cache navigation HTML, Next.js chunks, or API routes
  if (
    event.request.mode === 'navigate' ||
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        if (response.status === 200) {
          var responseToCache = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(function() {
        return caches.match(event.request).then(function(response) {
          return (
            response ||
            new Response('Offline - not in cache', {
              status: 503,
              statusText: 'Service Unavailable',
            })
          );
        });
      })
  );
});

