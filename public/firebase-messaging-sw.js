// Firebase Cloud Messaging Service Worker for SITENANG - KPU Kota Sungai Penuh
// Handles background push notifications when PWA is in background or closed

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Initialize Firebase in Service Worker using project configuration
firebase.initializeApp({
  apiKey: "AIzaSyCamCTPwf_AI4VT9Sg4Ys7FZunYHoXe0g0",
  authDomain: "compact-objective-xt8c4.firebaseapp.com",
  projectId: "compact-objective-xt8c4",
  storageBucket: "compact-objective-xt8c4.firebasestorage.app",
  messagingSenderId: "1055866076551",
  appId: "1:1055866076551:web:4750aae2a7b687c1656722"
});

const messaging = firebase.messaging();

// Handle background messages received via FCM
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message received:', payload);

  const title = payload.notification?.title || payload.data?.title || 'SITENANG - Pengingat Presensi';
  const body = payload.notification?.body || payload.data?.body || 'Jangan lupa melakukan presensi hari ini!';
  const icon = payload.notification?.icon || '/pwa-192x192.png';
  const tag = payload.data?.tag || 'sitenang-attendance-reminder';

  const notificationOptions = {
    body,
    icon,
    badge: '/pwa-192x192.png',
    tag,
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: {
      url: payload.data?.url || '/',
      timestamp: Date.now()
    },
    actions: [
      { action: 'open_app', title: '📲 Buka SITENANG' },
      { action: 'dismiss', title: 'Tutup' }
    ]
  };

  return self.registration.showNotification(title, notificationOptions);
});

// Universal Push Event fallback for custom Web Push payloads
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || data.notification?.title || 'SITENANG KPU Kota Sungai Penuh';
    const body = data.body || data.notification?.body || 'Pengingat presensi pegawai harian.';
    const icon = data.icon || data.notification?.icon || '/pwa-192x192.png';
    const tag = data.tag || 'sitenang-push';

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon,
        badge: '/pwa-192x192.png',
        tag,
        renotify: true,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: {
          url: data.url || data.data?.url || '/',
          timestamp: Date.now()
        },
        actions: [
          { action: 'open_app', title: '📲 Buka SITENANG' },
          { action: 'dismiss', title: 'Tutup' }
        ]
      })
    );
  } catch (err) {
    // If not JSON, handle as plain text
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('SITENANG Presensi', {
        body: text,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png'
      })
    );
  }
});

// Handle notification click to navigate to PWA
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it
      for (const client of windowClients) {
        if ('focus' in client) {
          if (client.url.includes(self.location.origin)) {
            return client.focus().then(() => {
              if (targetUrl && client.navigate) {
                return client.navigate(targetUrl);
              }
            });
          }
        }
      }
      // If no window is open, open a new window to the target URL
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
