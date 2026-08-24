/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';
import { firebaseConfig, isEmulator } from './config/firebase-config';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// ==========================================
// 1. Workbox Precache & Route
// Pre-caches core application shell (JS, CSS, main HTML, en/ja, images)
// ==========================================
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

// ==========================================
// 2. Runtime Caching for Non-Precached Multilingual Assets & Fonts
// ==========================================

// Multilingual Localized HTML (e.g., /index-es.html, /index-pt.html, etc.)
registerRoute(
  ({ url }) => /\/index-[a-z]{2,3}\.html$/i.test(url.pathname),
  new StaleWhileRevalidate({
    cacheName: 'localized-html-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 Days
      }),
    ],
  })
);

// Multilingual JS Chunks (e.g., /assets/es-*.js, /assets/pt-*.js, etc.)
registerRoute(
  ({ url }) => /\/assets\/(?:es|pt|zho|vi|th|ko|tl|sw|it)-[a-zA-Z0-9_-]+\.js$/i.test(url.pathname),
  new StaleWhileRevalidate({
    cacheName: 'localized-chunks-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
      }),
    ],
  })
);

// Google Fonts Stylesheets (CSS)
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-stylesheets',
  })
);

// Google Fonts Webfonts (WOFF2)
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new ExpirationPlugin({
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
        maxEntries: 30,
      }),
    ],
  })
);

// Static Images (WebP, PNG, SVG, JPG)
registerRoute(
  ({ request, url }) =>
    request.destination === 'image' ||
    url.pathname.startsWith('/images/') ||
    /\.(?:png|gif|jpg|jpeg|svg|webp|ico)$/i.test(url.pathname),
  new StaleWhileRevalidate({
    cacheName: 'images-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
      }),
    ],
  })
);

// ==========================================
// 3. Workbox Background Sync
// Automatically retries failed offline POST/PUT/DELETE mutations
// even after the user closes the tab/PWA, as soon as connectivity returns.
// ==========================================
const bgSyncPlugin = new BackgroundSyncPlugin('offline-mutations-queue', {
  maxRetentionTime: 24 * 60, // Retry for up to 24 hours (specified in minutes)
});

const isMutationApi = ({ url, request }: { url: URL; request: Request }) =>
  url.pathname.startsWith('/api/') && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method);

registerRoute(isMutationApi, new NetworkOnly({ plugins: [bgSyncPlugin] }), 'POST');
registerRoute(isMutationApi, new NetworkOnly({ plugins: [bgSyncPlugin] }), 'PUT');
registerRoute(isMutationApi, new NetworkOnly({ plugins: [bgSyncPlugin] }), 'DELETE');
registerRoute(isMutationApi, new NetworkOnly({ plugins: [bgSyncPlugin] }), 'PATCH');

// ==========================================
// 4. Cache API-based Pending Navigation Persistence
// Handles cold-start navigation from notifications across SW restarts
// ==========================================
const PENDING_NAV_CACHE = 'scripture-habit-pending-nav';
const PENDING_NAV_KEY = '/pending-nav-url';

async function storePendingUrl(url: string): Promise<void> {
  try {
    const cache = await caches.open(PENDING_NAV_CACHE);
    await cache.put(PENDING_NAV_KEY, new Response(url));
  } catch (e) {
    console.warn('[sw.ts] Failed to store pending URL in cache:', e);
  }
}

let isConsuming = false;
async function consumePendingUrl(): Promise<string | null> {
  if (isConsuming) return null;
  isConsuming = true;
  try {
    const cache = await caches.open(PENDING_NAV_CACHE);
    const response = await cache.match(PENDING_NAV_KEY);
    if (response) {
      const url = await response.text();
      await cache.delete(PENDING_NAV_KEY);
      return url;
    }
  } catch (e) {
    console.warn('[sw.ts] Failed to consume pending URL from cache:', e);
  } finally {
    isConsuming = false;
  }
  return null;
}

// ==========================================
// 4. Notification Click Handling
// ==========================================
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  let targetPath = '/dashboard';
  let urlToOpen: string;

  try {
    const rawData = event.notification.data;
    const data = rawData?.FCM_MSG?.data ? rawData.FCM_MSG.data : rawData;

    const groupId = data?.groupId;
    const openNewNote = data?.openNewNote;
    const lang = data?.lang;

    targetPath = groupId ? `/dashboard?groupId=${groupId}&view=2` : '/dashboard';

    // Append analytics parameters
    targetPath += (targetPath.includes('?') ? '&' : '?') + 'opened_from_push=1';

    if (openNewNote === 'true') {
      targetPath += '&openNewNote=true';
    }

    if (lang && lang.length >= 2 && lang.length <= 3) {
      targetPath = `/${lang}${targetPath}`;
    }

    // Prevent Open Redirect: Target path must not attempt to redirect to external URLs
    if (
      targetPath.startsWith('http://') ||
      targetPath.startsWith('https://') ||
      targetPath.startsWith('//')
    ) {
      throw new Error('External redirect blocked: ' + targetPath);
    }

    urlToOpen = new URL(targetPath, self.location.origin).href;
  } catch (err) {
    console.error('[sw.ts] Failed to parse notification data, falling back to default:', err);
    targetPath = '/dashboard';
    urlToOpen = new URL(targetPath, self.location.origin).href;
  }

  const storePromise = storePendingUrl(targetPath);

  const windowPromise = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then(async (windowClients) => {
      const validClients = windowClients.filter((client) => {
        try {
          const clientUrl = new URL(client.url);
          return clientUrl.origin === self.location.origin && 'focus' in client;
        } catch {
          return false;
        }
      });

      // Prioritize already focused clients
      validClients.sort((a, b) => (b.focused ? 1 : 0) - (a.focused ? 1 : 0));

      for (const client of validClients) {
        try {
          const focusedClient = await client.focus();
          if (focusedClient) {
            focusedClient.postMessage({ type: 'NAVIGATE', url: targetPath });
            return focusedClient;
          }
        } catch (err) {
          console.warn('[sw.ts] client.focus() failed, trying next client:', err);
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen).catch((err) => {
          console.error('[sw.ts] self.clients.openWindow failed:', err);
          throw err;
        });
      }
      console.error('[sw.ts] self.clients.openWindow is not supported on this platform/browser.');
    });

  const windowActionPromise = Promise.all([storePromise, windowPromise]);

  const closeNotificationsPromise = self.registration
    .getNotifications()
    .then((notifications) => {
      notifications.forEach((notification) => {
        if (notification !== event.notification) {
          notification.close();
        }
      });
    })
    .catch((err) => {
      console.warn('[sw.ts] Failed to close notifications:', err);
    });

  event.waitUntil(
    Promise.all([
      windowActionPromise.catch((err) => {
        console.error('[sw.ts] Window action failed during notificationclick:', err);
      }),
      closeNotificationsPromise,
    ])
  );
});

// ==========================================
// 5. Messages from the UI (Skip Waiting & Pending Notification Check)
// ==========================================
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'CHECK_PENDING_NOTIFICATION') {
    event.waitUntil(
      consumePendingUrl().then((url) => {
        if (url && event.ports && event.ports[0]) {
          event.ports[0].postMessage({ type: 'NAVIGATE', url });
        }
      })
    );
  }
});

// ==========================================
// 6. Bundled Firebase SDK Background Messaging (Self-Contained)
// ==========================================
if (!isEmulator && firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('demo')) {
  try {
    const firebaseApp = initializeApp(firebaseConfig);
    const messaging = getMessaging(firebaseApp);
    onBackgroundMessage(messaging, (payload) => {
      console.log('[sw.ts] Received background message:', payload);
    });
  } catch (e) {
    console.warn('[sw.ts] Firebase Messaging initialization deferred or unavailable:', e);
  }
}
