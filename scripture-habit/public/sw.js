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
    // FCM SDK automatically handles displaying the notification because the server-side payload
    // includes a 'notification' object. We do not need to call showNotification manually here,
    // as doing so triggers a second, duplicate notification.
});

// Helper to compare if two URLs are essentially pointing to the same page/group in our app
function isSameRoute(urlA, urlB) {
    try {
        const a = new URL(urlA);
        const b = new URL(urlB);
        
        // Remove trailing slashes and language prefixes for comparison
        const normalizePath = (p) => {
            let path = p.replace(/\/$/, '');
            const parts = path.split('/');
            if (parts.length > 1 && parts[1].length >= 2 && parts[1].length <= 3) {
                parts.splice(1, 1);
            }
            return parts.join('/') || '/';
        };

        if (normalizePath(a.pathname) !== normalizePath(b.pathname)) {
            return false;
        }

        // Compare critical query parameters (groupId)
        const getGroupId = (urlObj) => urlObj.searchParams.get('groupId');
        return getGroupId(a) === getGroupId(b);
    } catch (e) {
        return false;
    }
}

// 通知クリック時の動作
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const rawData = event.notification.data;
    const data = (rawData && rawData.FCM_MSG && rawData.FCM_MSG.data)
        ? rawData.FCM_MSG.data
        : rawData;

    const groupId = data?.groupId;
    const openNewNote = data?.openNewNote;
    const lang = data?.lang;
    
    let targetPath = groupId ? `/dashboard?groupId=${groupId}&view=2` : '/dashboard';
    
    // アナリティクス計測用パラメータを付与
    targetPath += (targetPath.includes('?') ? '&' : '?') + 'opened_from_push=1';
    
    if (openNewNote === 'true') {
        targetPath += '&openNewNote=true';
    }
    
    if (lang && lang.length >= 2 && lang.length <= 3) {
        targetPath = `/${lang}${targetPath}`;
    }
    
    const urlToOpen = new URL(targetPath, self.location.origin).href;

    event.waitUntil(
        Promise.all([
            // 1. Close other notifications in the background (does not block window activation)
            self.registration.getNotifications().then((notifications) => {
                notifications.forEach((notification) => {
                    notification.close();
                });
            }).catch((err) => {
                console.warn('[sw.js] Failed to close notifications:', err);
            }),
            
            // 2. Focus or open window immediately to keep user gesture active
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
                let focusPromise = Promise.resolve(null);
                let fallbackToOpenWindow = true;

                for (let i = 0; i < windowClients.length; i++) {
                    const client = windowClients[i];
                    if (client.url.startsWith(self.location.origin)) {
                        // We always focus the existing client and navigate internally via postMessage.
                        // This avoids hard reloads (which can abort focus on Android Chrome and lose state)
                        // and ensures the app comes to the foreground on all platforms (Android/iOS/Desktop).
                        if ('focus' in client) {
                            client.postMessage({
                                type: 'NAVIGATE',
                                url: targetPath
                            });
                            
                            focusPromise = client.focus().catch((err) => {
                                console.warn('[sw.js] client.focus failed:', err);
                                return null;
                            });
                            fallbackToOpenWindow = false;
                            break;
                        }
                    }
                }

                return focusPromise.then((focusedClient) => {
                    if (focusedClient) {
                        return focusedClient;
                    }
                    // If focus failed, or we skipped it (iOS Safari with different URL),
                    // we call clients.openWindow to force navigation/launch.
                    if (fallbackToOpenWindow && clients.openWindow) {
                        return clients.openWindow(urlToOpen);
                    }
                });
            })
        ])
    );
});

// UIからのメッセージ（アップデート用）
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

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
