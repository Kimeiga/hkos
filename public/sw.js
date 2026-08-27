const CACHE_NAME = 'hkos-mahjong-v3';
const OFFLINE_SHELL = '/index.html';
const PRECACHE_URLS = [
  OFFLINE_SHELL,
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((error) => console.log('Cache install failed:', error))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames
        .filter((cacheName) => cacheName !== CACHE_NAME)
        .map((cacheName) => caches.delete(cacheName))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith('http')) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // App navigations must prefer the network. A cache-first index.html can pin
  // users to an old Vite asset graph indefinitely after a new deployment.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response?.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(OFFLINE_SHELL, response.clone());
        }
        return response;
      } catch {
        return (await caches.match(OFFLINE_SHELL)) || Response.error();
      }
    })());
    return;
  }

  // Hashed Vite assets, tile SVGs, icons, and other static files are safe to
  // serve cache-first. New deployments reference new hashed asset URLs.
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response?.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});
