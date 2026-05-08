// Firebase Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyCBgfSff0SJ6Rg1tGmU2z4MBccGMrA2jbM",
    authDomain: "scripture-habit-auth.firebaseapp.com",
    projectId: "scripture-habit-auth",
    storageBucket: "scripture-habit-auth.firebasestorage.app",
    messagingSenderId: "346318604907",
    appId: "1:346318604907:web:38afde63adfcdeaeb7bf2e"
});

const messaging = firebase.messaging();

// Background message handler
messaging.onBackgroundMessage((payload) => {
    console.log('[sw.js] Received background message ', payload);

    // Prefer data block but fallback to notification if sent by other tools
    const notificationTitle = payload.data?.title || payload.notification?.title || 'Scripture Habit';
    const notificationBody = payload.data?.body || payload.notification?.body || '';
    
    const notificationOptions = {
        body: notificationBody,
        icon: '/favicon-192.png',
        badge: '/favicon-192.png', 
        data: payload.data || payload.notification,
    };

    // self.registration.showNotification(notificationTitle, notificationOptions);
    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const data = event.notification.data;
    const groupId = data?.groupId;
    const openNewNote = data?.openNewNote;
    const lang = data?.lang;
    
    let targetPath = groupId ? `/dashboard?groupId=${groupId}&view=2` : '/dashboard';
    
    if (openNewNote === 'true') {
        targetPath += (targetPath.includes('?') ? '&' : '?') + 'openNewNote=true';
    }
    
    // Prefix with language if provided
    if (lang && lang.length >= 2 && lang.length <= 3) {
        targetPath = `/${lang}${targetPath}`;
    }
    
    const urlToOpen = new URL(targetPath, self.location.origin).href;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                for (let i = 0; i < windowClients.length; i++) {
                    const client = windowClients[i];
                    if (client.url.startsWith(self.location.origin)) {
                        if ('focus' in client) {
                            client.navigate(urlToOpen);
                            return client.focus();
                        }
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// Handle messages from the UI
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

const CACHE_NAME = 'scripture-habit-v3'; // Bumped version
const OFFLINE_URL = '/offline.html';

const ASSETS_TO_CACHE = [
    '/',
    OFFLINE_URL,
    '/logo.svg',
    '/manifest.json',
    '/favicon-192.png'
];

// Install Event
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE).catch(err => {
                console.warn('[sw.js] Pre-caching semi-failed, but proceeding:', err);
            });
        })
    );
});

// Activate Event
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    // Bypass cache for API calls
    if (event.request.url.includes('/api/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Navigation requests (Stale-While-Revalidate for App Shell)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            caches.match('/').then((cachedResponse) => {
                const fetchPromise = fetch('/').then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        // "Clean" the response if it was redirected
                        let cleanResponse = networkResponse;
                        if (networkResponse.redirected) {
                            cleanResponse = new Response(networkResponse.body, {
                                status: networkResponse.status,
                                statusText: networkResponse.statusText,
                                headers: networkResponse.headers
                            });
                        }

                        const responseToCache = cleanResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put('/', responseToCache);
                        });
                        return cleanResponse;
                    }
                    return networkResponse;
                }).catch(() => caches.match(OFFLINE_URL));

                // Ensure cached response is also "clean" if it was somehow cached with redirected: true
                if (cachedResponse && cachedResponse.redirected) {
                    return new Response(cachedResponse.body, {
                        status: cachedResponse.status,
                        statusText: cachedResponse.statusText,
                        headers: cachedResponse.headers
                    });
                }

                return cachedResponse || fetchPromise;
            })
        );
        return;
    }

    // Custom strategies for assets
    event.respondWith(
        caches.match(event.request).then((response) => {
            if (response) return response;
            
            return fetch(event.request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }

                // Cache fonts, images, and other static assets on the fly
                const isStaticAsset = event.request.destination === 'image' || 
                                     event.request.destination === 'script' || 
                                     event.request.destination === 'style' ||
                                     event.request.destination === 'font' ||
                                     event.request.url.startsWith('https://fonts.');

                if (isStaticAsset && event.request.url.startsWith('http')) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    }).catch(err => {
                        console.warn('[sw.js] Cache put failed:', err);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // If network fails and it's an image, return logo
                if (event.request.destination === 'image') {
                    return caches.match('/logo.svg');
                }
                return caches.match(OFFLINE_URL);
            });
        })
    );
});
