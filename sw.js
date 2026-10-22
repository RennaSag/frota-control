// Service Worker for Controle da Frota PWA
const CACHE_NAME = 'controle-frota-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/estilo.css',
  '/assets/app.js',
  '/assets/logo.png',
  '/assets/icone.svg',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Pass API requests and dynamic data directly to network
  if (event.request.url.includes('api.php') || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
