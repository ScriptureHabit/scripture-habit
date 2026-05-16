// Firebase Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// 本番環境のFirebase設定
firebase.initializeApp({
    apiKey: "AIzaSyCBgfSff0SJ6Rg1tGmU2z4MBccGMrA2jbM",
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

    const notificationTitle = payload.data?.title || payload.notification?.title || 'Scripture Habit';
    const notificationBody = payload.data?.body || payload.notification?.body || '';
    
    const notificationOptions = {
        body: notificationBody,
        icon: '/favicon-192.png',
        badge: '/favicon-192.png', 
        data: payload.data || payload.notification,
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// 通知クリック時の動作
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

// UIからのメッセージ（アップデート用）
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

const CACHE_NAME = 'scripture-habit-v5'; // バージョンを上げて更新を促す
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
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetchイベント（リクエスト制御）
self.addEventListener('fetch', (event) => {
    // 1. GET以外のリクエスト、またはHTTP(S)以外のリクエスト（chrome-extension等）は無視
    if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) return;

    const url = new URL(event.request.url);

    // 2. API、Firebase Auth、Viteのホットリロード(HMR)はキャッシュしない
    if (url.pathname.includes('/api/') || 
        url.hostname.includes('securetoken') || 
        url.pathname.includes('@vite') || 
        url.pathname.includes('__vite')) {
        return;
    }

    // 3. ナビゲーションリクエスト（ページ遷移）
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).then((networkResponse) => {
                // 通信成功時はキャッシュを更新して返す
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put('/', responseToCache);
                });
                return networkResponse;
            }).catch(() => {
                // ネットワーク失敗時はキャッシュのTOPか、最悪オフラインページ
                return caches.match('/').then(cached => cached || caches.match(OFFLINE_URL));
            })
        );
        return;
    }

    // 4. その他のアセット（画像、JS、CSS、フォントなど）
    event.respondWith(
        caches.match(event.request).then((response) => {
            if (response) return response; // キャッシュがあればそれを返す
            
            return fetch(event.request).then((networkResponse) => {
                // 成功した画像やフォントなどの静的ファイルのみ動的にキャッシュ
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
