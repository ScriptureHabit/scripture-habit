/**
 * Shared Firebase Configuration & Environment Detection (SSOT)
 * Used across the Main Application and Service Worker.
 */

export const isEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || (isEmulator ? "demo-api-key" : undefined),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (isEmulator ? "demo-project.firebaseapp.com" : undefined),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || (isEmulator ? "scripture-habit-auth" : undefined),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || (isEmulator ? "demo-project.firebasestorage.app" : undefined),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || (isEmulator ? "123456789" : undefined),
  appId: import.meta.env.VITE_FIREBASE_APP_ID || (isEmulator ? "1:123456789:web:abcdef" : undefined),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || (isEmulator ? "G-DEMO" : undefined)
};

export type FirebaseConfig = typeof firebaseConfig;
