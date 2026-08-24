// Firebase Messaging Service Worker

// ==========================================
// Cache API-based pending navigation persistence
//
// [Bug Fix #2] self.pendingNotificationUrl (global variable) resets when the SW process restarts,
// causing navigation to be lost on cold starts. Cache API persists independently of the SW lifecycle.
// ==========================================
const PENDING_NAV_CACHE = 'scripture-habit-pending-nav';
const PENDING_NAV_KEY = '/pending-nav-url';

async function storePendingUrl(url) {
    try {
        const cache = await caches.open(PENDING_NAV_CACHE);
        await cache.put(PENDING_NAV_KEY, new Response(url));
    } catch (e) {
        console.warn('[sw.js] Failed to store pending URL in cache:', e);
    }
}

let isConsuming = false;
async function consumePendingUrl() {
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
        console.warn('[sw.js] Failed to consume pending URL from cache:', e);
    } finally {
        isConsuming = false;
    }
    return null;
}

// ==========================================
// Notification click handling
// (Registered before importScripts to avoid conflicts with Firebase SDK)
// ==========================================
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    let targetPath = '/dashboard';
    let urlToOpen;

    try {
        const rawData = event.notification.data;
        const data = (rawData && rawData.FCM_MSG && rawData.FCM_MSG.data)
            ? rawData.FCM_MSG.data
            : rawData;

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
        if (targetPath.startsWith('http://') || targetPath.startsWith('https://') || targetPath.startsWith('//')) {
            throw new Error('External redirect blocked: ' + targetPath);
        }

        urlToOpen = new URL(targetPath, self.location.origin).href;
    } catch (err) {
        console.error('[sw.js] Failed to parse notification data, falling back to default:', err);
        targetPath = '/dashboard';
        urlToOpen = new URL(targetPath, self.location.origin).href;
    }

    // Window interaction: Focus existing window or open a new window
    // [Optimization] Run storePendingUrl in parallel with clients.matchAll to minimize async boundary delay,
    // keeping the user interaction context alive to prevent Popup Blocker blocks.
    const storePromise = storePendingUrl(targetPath);

    const windowPromise = clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(async (windowClients) => {
            // Filter valid clients matching local origin and having focus ability
            const validClients = windowClients.filter(client => {
                try {
                    const clientUrl = new URL(client.url);
                    return clientUrl.origin === self.location.origin && 'focus' in client;
                } catch (e) {
                    return false;
                }
            });

            // Prioritize already focused clients to prevent random background tab hijacking
            validClients.sort((a, b) => (b.focused ? 1 : 0) - (a.focused ? 1 : 0));

            for (const client of validClients) {
                try {
                    // Focus the client (if it is a discarded tab, this will trigger a page reload)
                    const focusedClient = await client.focus();
                    if (focusedClient) {
                        // Fast-path: Send a direct NAVIGATE message.
                        // If the tab was discarded, it will reload and query PENDING_NAV_CACHE via CHECK_PENDING_NOTIFICATION,
                        // but if it's already active, this postMessage executes instantly.
                        focusedClient.postMessage({ type: 'NAVIGATE', url: targetPath });
                        return focusedClient;
                    }
                } catch (err) {
                    // Focus failed, log and try next client
                    console.warn('[sw.js] client.focus() failed, trying next client:', err);
                }
            }

            // If there are no existing windows or focus fails on all of them:
            if (clients.openWindow) {
                // clients.openWindow does not need to await storePromise, keeping the interaction path synchronous.
                return clients.openWindow(urlToOpen).catch((err) => {
                    console.error('[sw.js] clients.openWindow failed:', err);
                    throw err;
                });
            }
            console.error('[sw.js] clients.openWindow is not supported on this platform/browser.');
        });

    const windowActionPromise = Promise.all([storePromise, windowPromise]);

    // Close other notifications in the background (run in parallel with windowActionPromise)
    const closeNotificationsPromise = self.registration.getNotifications().then((notifications) => {
        notifications.forEach((notification) => {
            if (notification !== event.notification) {
                notification.close();
            }
        });
    }).catch((err) => {
        console.warn('[sw.js] Failed to close notifications:', err);
    });

    // [Bug Fix #3] Log any windowActionPromise errors using catch while allowing waitUntil to complete successfully.
    // The previous implementation caught errors on Promise.all, which made window action failures silent/untraceable.
    // Even if windowActionPromise rejects, make sure closeNotificationsPromise is still completed.
    event.waitUntil(
        Promise.all([
            windowActionPromise.catch((err) => {
                console.error('[sw.js] Window action failed during notificationclick:', err);
            }),
            closeNotificationsPromise,
        ])
    );
});

// ==========================================
// Messages from the UI
// ==========================================
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    } else if (event.data && event.data.type === 'CHECK_PENDING_NOTIFICATION') {
        // [Bug Fix #2] Retrieve and consume the pending URL from Cache API.
        // Unlike in-memory variables, the URL survives SW restarts, ensuring cold start navigation completes.
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
// Load and initialize Firebase SDK (executed after event listeners are registered)
// ==========================================
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Production Firebase Configuration
firebase.initializeApp({
    apiKey: "AIzaSyCBgfSff0SJ6Rg1tGmU2z4MBccGMrA2jbM", // nosemgrep: generic.secrets.security.detected-generic-api-key.detected-generic-api-key
    authDomain: "scripture-habit-auth.firebaseapp.com",
    projectId: "scripture-habit-auth",
    storageBucket: "scripture-habit-auth.firebasestorage.app",
    messagingSenderId: "346318604907",
    appId: "1:346318604907:web:38afde63adfcdeaeb7bf2e"
});

const messaging = firebase.messaging();

// バックグラウンド通知のハンドラ
messaging.onBackgroundMessage((payload) => {
    console.log('[sw.js] Received background message ', payload);
});

// ==========================================
// Cache and fetch control logic
// ==========================================
const CACHE_NAME = 'scripture-habit-v8';
const OFFLINE_URL = '/offline.html';

const ASSETS_TO_CACHE = [
    '/',
    OFFLINE_URL,
    '/logo.svg',
    '/manifest.json',
    '/favicon-192.png'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE).catch(err => {
                console.warn('[sw.js] Pre-caching failed:', err);
            });
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Do not delete PENDING_NAV_CACHE as it stores pending navigation URLs
                    if (cacheName !== CACHE_NAME && cacheName !== PENDING_NAV_CACHE) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch events (request control)
self.addEventListener('fetch', (event) => {
    // 1. Ignore non-GET requests or requests with non-HTTP(S) schemes (e.g. chrome-extension)
    if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) return;

    const url = new URL(event.request.url);

    // 2. Do not cache APIs, Firebase Auth, or Vite HMR requests
    if (url.pathname.includes('/api/') ||
        url.hostname.includes('securetoken') ||
        url.pathname.includes('@vite') ||
        url.pathname.includes('__vite')) {
        return;
    }

    // 3. Navigation requests (page transitions)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).then((networkResponse) => {
                // Cache response on successful network fetch and return it
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put('/', responseToCache);
                });
                return networkResponse;
            }).catch(() => {
                // If network fails, serve from root cache or fall back to offline page
                return caches.match('/').then(cached => cached || caches.match(OFFLINE_URL));
            })
        );
        return;
    }

    // 4. Other static assets (images, JS, CSS, fonts, etc.)
    event.respondWith(
        caches.match(event.request).then((response) => {
            if (response) return response; // Return cached asset if available

            return fetch(event.request).then((networkResponse) => {
                // Dynamically cache successful static images or fonts
                if (networkResponse && networkResponse.status === 200) {
                    const isStaticAsset = event.request.destination === 'image' ||
                                         event.request.destination === 'font' ||
                                         url.hostname.includes('fonts.gstatic.com');

                    if (isStaticAsset) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                }
                return networkResponse;
            }).catch(() => {
                if (event.request.destination === 'image') {
                    return caches.match('/logo.svg');
                }
                return caches.match(OFFLINE_URL);
            });
        })
    );
});
