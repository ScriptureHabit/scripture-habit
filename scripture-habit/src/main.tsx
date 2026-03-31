import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, useLocation, useNavigationType, createRoutesFromChildren, matchRoutes } from 'react-router-dom';
import * as Sentry from "@sentry/react";
import './index.css'
import App from './App'
import VConsole from 'vconsole';

// Only initialize vConsole if ?vconsole=true is in the URL
if (window.location.search.includes('vconsole=true')) {
  new VConsole();
}

// Capture beforeinstallprompt event globally 
window.deferredPWAPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredPWAPrompt = e;
});

// SILENCE NON-CRITICAL ERRORS: 
// Especially 'AbortError' which often happens in Firebase Analytics/SW on mobile,
// and Firebase 'permission-denied' errors that can escape try/catch during state transitions
// (e.g. after group deletion, auth state change, etc.)
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  if (!reason) return;

  // Silence AbortErrors (mobile/SW related)
  if (reason.name === 'AbortError' || reason.message?.includes('user aborted')) {
    event.preventDefault();
    return;
  }

  // Silence Firebase permission-denied errors that escape try/catch via internal async queue
  if (
    reason.code === 'permission-denied' ||
    reason.message?.includes('Missing or insufficient permissions') ||
    reason.message?.includes('permission-denied')
  ) {
    event.preventDefault();
    return;
  }
});

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || "",
  integrations: [
    Sentry.reactRouterV6BrowserTracingIntegration({
      useEffect: React.useEffect,
      useLocation,
      useNavigationType,
      createRoutesFromChildren,
      matchRoutes,
    }),
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

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
}

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
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
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

