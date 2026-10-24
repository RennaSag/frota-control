// Service worker: guarda a "casca" do app para abrir mais rápido e mostra as
// notificações de avisos. Os dados (api.php) sempre vêm da rede, nunca do cache.
const CACHE = 'controle-frota-v3';
const ESTATICOS = ['./', 'assets/estilo.css', 'assets/app.js', 'assets/logo.png', 'assets/icone.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ESTATICOS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || e.request.url.includes('api.php')) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request, { ignoreSearch: true })));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((janelas) => (janelas.length ? janelas[0].focus() : self.clients.openWindow('./')))
  );
});
