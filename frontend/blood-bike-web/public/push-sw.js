/**
 * Custom push event handler for Web Push notifications.
 * This file is served alongside the Angular ngsw-worker.js.
 * If ngsw handles the push, this won't fire (ngsw calls event.waitUntil).
 * If ngsw is NOT active, this handles showing the notification.
 */
self.addEventListener('push', function (event) {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { notification: { title: 'Blood Bike', body: event.data.text() } };
  }

  // Support Angular ngsw format: { notification: { title, body, ... } }
  const notif = payload.notification || payload;
  const title = notif.title || 'Blood Bike';
  const options = {
    body: notif.body || '',
    icon: notif.icon || '/icons/icon-192x192.png',
    badge: notif.badge || '/icons/icon-96x96.png',
    vibrate: notif.vibrate || [200, 100, 200],
    data: notif.data || {},
    actions: notif.actions || [],
    tag: 'blood-bike-job',
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
