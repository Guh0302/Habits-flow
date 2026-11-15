const CACHE_NAME = 'habitflow-mobile-v6';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

// Recebe comandos do app para disparar ou agendar Notificação Persistente na Tela de Bloqueio
self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type === 'SHOW_ALARM_NOTIFICATION' && data.item) {
    const item = data.item;
    const title = `⏰ ${item.time} — ${item.title}`;
    const options = {
      body: item.type === 'habit'
        ? '🔥 Hora de praticar seu hábito no HabitFlow!'
        : '📌 Compromisso agendado agora!',
      tag: `alarm_${item.id}_${item.time}`,
      renotify: true,
      requireInteraction: true,
      vibrate: [500, 200, 500, 200, 800, 200, 500],
      data: { itemId: item.id },
      actions: [
        { action: 'complete', title: '✓ Concluir' },
        { action: 'snooze', title: '💤 Soneca +5m' }
      ]
    };

    event.waitUntil(self.registration.showNotification(title, options));
  }
});

// Quando o usuário toca na notificação ou nos botões da tela de bloqueio (fora do app)
self.addEventListener('notificationclick', event => {
  const action = event.action;
  const itemId = event.notification.data ? event.notification.data.itemId : null;
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        client.postMessage({
          type: 'NOTIFICATION_ACTION',
          action: action || 'open',
          itemId
        });
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('./index.html');
      }
    })
  );
});
