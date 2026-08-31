import './utils/dom-polyfills';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

// Self-hosted fonts (eliminates external CDN latency)
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';

import './index.css'
import App from './app'
import { AuthProvider } from './context/auth-provider';
import { RootErrorBoundary } from './components/common/root-error-boundary';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
// Only initialize vConsole if ?vconsole=true is in the URL (lazy dynamic import)
if (typeof window !== 'undefined' && window.location.search.includes('vconsole=true')) {
  import(/* @vite-ignore */ 'vconsole').then(({ default: VConsole }) => {
    new VConsole();
  }).catch(() => {});
}

// Capture beforeinstallprompt event globally 
window.deferredPWAPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 76 and later from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later.
  window.deferredPWAPrompt = e as BeforeInstallPromptEvent;
});

// SILENCE NON-CRITICAL ERRORS: 
// Especially 'AbortError' which often happens in Firebase Analytics/SW on mobile,
// and Firebase 'permission-denied' errors that can escape try/catch during state transitions
// (e.g. after group deletion, auth state change, etc.)
window.addEventListener('unhandledrejection', (event) => {
  const reason = (event as PromiseRejectionEvent).reason;
  if (!reason) return;

  // Silence AbortErrors (mobile/SW related)
  if (reason.name === 'AbortError' || reason.message?.includes('user aborted')) {
    event.preventDefault();
    return;
  }

  // Silence Firebase permission-denied errors that escape try/catch via internal async queue
  // ONLY in production to ensure proper security rules debugging locally
  if (
    import.meta.env.PROD &&
    (reason.code === 'permission-denied' ||
    reason.message?.includes('Missing or insufficient permissions') ||
    reason.message?.includes('permission-denied'))
  ) {
    event.preventDefault();
    return;
  }
});

const isLocalhost = typeof window !== 'undefined' && 
  Boolean(
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' || 
    window.location.hostname.endsWith('.local')
  );

const shouldInitializeSentry = import.meta.env.PROD && 
  !isLocalhost && 
  !!import.meta.env.VITE_SENTRY_DSN && 
  !navigator.webdriver;

let sentryInitialized = false;
const initSentry = async () => {
  if (sentryInitialized || !shouldInitializeSentry) return;
  sentryInitialized = true;
  try {
    const Sentry = await import("@sentry/react");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Sentry = Sentry;
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      ignoreErrors: [
        'Database is closing/hidden',
        'Failed to get document because the client is offline.',
        /Failed to get document because the client is offline/i,
        /client is offline/i,
        /The database connection is closing/i,
        /Failed to execute 'transaction' on 'IDBDatabase'/i,
        /Unable to preload CSS/i,
        /Failed to fetch dynamically imported module/i,
        /Loading chunk .* failed/i,
        /Unexpected token '<'/i,
        /Failed to execute 'removeChild' on 'Node'/i,
        /Failed to execute 'insertBefore' on 'Node'/i,
        /The node to be removed is not a child of this node/i,
        /The node before which the new node is to be inserted is not a child of this node/i,
      ],
      environment: import.meta.env.MODE || 'development',
      integrations: [
        Sentry.replayIntegration({
          maskAllText: false,
          blockAllMedia: true,
        }),
      ],
      // Performance Monitoring
      tracesSampleRate: 0.1, // Only send 10% of performance traces to save bandwidth
      // Session Replay
      replaysSessionSampleRate: 0, // Disable full session recordings to prevent "Content Too Large"
      replaysOnErrorSampleRate: 1.0, // Only record when an error occurs
    });
  } catch (err) {
    console.warn("Failed to initialize Sentry deferred:", err);
  }
};

if (typeof window !== 'undefined' && shouldInitializeSentry) {
  // Initialize on error, user interaction, or long idle (15s)
  window.addEventListener('error', () => { void initSentry(); }, { once: true });
  window.addEventListener('unhandledrejection', () => { void initSentry(); }, { once: true });
  const triggerOnInteraction = () => { void initSentry(); };
  window.addEventListener('pointerdown', triggerOnInteraction, { once: true, passive: true });
  window.addEventListener('keydown', triggerOnInteraction, { once: true, passive: true });
  
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => { void initSentry(); }, { timeout: 15000 });
  } else {
    setTimeout(() => { void initSentry(); }, 15000);
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      retry: 1,
    },
  },
});

if (typeof window !== 'undefined' && window.localStorage) {
  const localStoragePersister = createSyncStoragePersister({
    storage: window.localStorage,
    key: 'SCRIPTURE_HABIT_QUERY_CACHE',
  });

  persistQueryClient({
    queryClient,
    persister: localStoragePersister,
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
  });
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <RootErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <App />
              <Analytics />
              <SpeedInsights />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </RootErrorBoundary>
    </StrictMode>,
  )
}

// Register Service Worker for PWA
if ('serviceWorker' in navigator && !navigator.webdriver) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {

        // 1. Check if there's already a waiting worker (e.g., from a previous session)
        if (registration.waiting) {
          window.dispatchEvent(new CustomEvent('pwa-update-available', { detail: registration }));
        }

        // 2. Listen for future updates
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // New content is available; please refresh.
                  window.dispatchEvent(new CustomEvent('pwa-update-available', { detail: registration }));
                }
              }
            };
          }
        };
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });

  // Handle SW controller change (reload the page when new SW takes over)
  let refreshing = false;
  const wasControlled = !!navigator.serviceWorker.controller;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Only reload if the page was already controlled (i.e., this is an update)
    // and we haven't already started a refresh.
    if (!wasControlled || refreshing) return;
    
    refreshing = true;
    window.location.reload();
  });
}

