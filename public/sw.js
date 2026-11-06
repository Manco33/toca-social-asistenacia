/**
 * Service Worker para Aktiva Marcaje PWA
 * Maneja caching, sincronización en background y funcionamiento offline
 */

const CACHE_NAME = 'aktiva-marcaje-v1';

// Install event
self.addEventListener('install', function(event) {
  console.log('[SW] Installing');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', function(event) {
  console.log('[SW] Activating');
  self.clients.claim();
});

// Fetch event - Network first strategy
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);
  
  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Skip POST/PUT/DELETE requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        // Cache successful responses
        if (response.status === 200) {
          var responseToCache = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(function(error) {
        console.warn('[SW] Fetch failed, falling back to cache:', error);
        // Fallback to cache
        return caches.match(event.request)
          .then(function(response) {
            return response || new Response('Offline - not in cache', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

