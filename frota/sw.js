// Service worker mínimo: só existe para o celular conseguir mostrar as notificações
// de avisos dos motoristas. Não guarda nada em cache.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((janelas) => (janelas.length ? janelas[0].focus() : self.clients.openWindow('./')))
  );
});
