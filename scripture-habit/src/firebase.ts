import { initializeApp, FirebaseApp } from "firebase/app";
import type { Analytics } from "firebase/analytics";
import { getAuth, Auth, connectAuthEmulator, signInWithEmailAndPassword, signInWithCustomToken, signOut } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, Firestore, getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, CustomProvider, AppCheck, getToken } from "firebase/app-check";

const isEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || (isEmulator ? "demo-api-key" : undefined),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (isEmulator ? "demo-project.firebaseapp.com" : undefined),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || (isEmulator ? "scripture-habit-auth" : undefined),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || (isEmulator ? "demo-project.firebasestorage.app" : undefined),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || (isEmulator ? "123456789" : undefined),
  appId: import.meta.env.VITE_FIREBASE_APP_ID || (isEmulator ? "1:123456789:web:abcdef" : undefined),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || (isEmulator ? "G-DEMO" : undefined)
};

// Check for required environment variables
const requiredVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID'
];

requiredVars.forEach(v => {
  if (!import.meta.env[v]) {
    if (isEmulator) {
      console.log(`[Firebase] Using fallback for missing variable in emulator mode: ${v}`);
    } else {
      console.warn(`[Firebase] Missing environment variable: ${v}`);
    }
  }
});

if (isEmulator) {
  console.log("[Firebase] Initializing in Emulator mode with fallbacks enabled.");
}

// Initialize Firebase App with fallback options for emulator mode
let app: FirebaseApp;
try {
  app = initializeApp(firebaseConfig);
} catch (e) {
  console.error("Firebase initializeApp failed:", e);
  throw e;
}

let analytics: Analytics | null = null;

export const logFirebaseEvent = async (eventName: string, params: Record<string, string>) => {
  if (isEmulator || typeof window === 'undefined') return;

  try {
    const { getAnalytics, logEvent } = await import('firebase/analytics');
    analytics ??= getAnalytics(app);
    logEvent(analytics, eventName, params);
  } catch (e) {
    console.warn("Firebase Analytics not supported or failed:", e);
  }
};

// Add Firebase Auth and App Check to global window object for Playwright tests
declare global {
  interface Window {
    firebaseAuth?: Auth;
    firebaseAuthHelpers?: {
      signInWithEmailAndPassword: typeof signInWithEmailAndPassword;
      signInWithCustomToken: typeof signInWithCustomToken;
      signOut: typeof signOut;
    };
    debugAppCheck?: () => Promise<unknown>;
  }
}

// Initialize Firebase Auth with browserLocalPersistence
let auth: Auth | null = null;
try {
  auth = getAuth(app);

  if (typeof window !== 'undefined' && auth) {
    window.firebaseAuth = auth;

    // In emulator mode, expose browser-side auth helpers for Playwright tests.
    if (isEmulator) {
      window.firebaseAuthHelpers = {
        signInWithEmailAndPassword,
        signInWithCustomToken,
        signOut
      };
    }
  }
} catch (e) {
  console.error("Firebase Auth failed to initialize. Root cause:", e);
  // Do NOT silence this - it causes "Cannot read properties of null (reading 'app')" later
  throw e;
}

// Initialize Firestore with persistent cache (modern way)
// Wrap in try-catch to avoid app crash if IndexedDB is blocked (e.g. private mode)
let db: Firestore;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (e) {
  console.error("Firestore initialization with persistence failed, falling back to default:", e);
  db = getFirestore(app);
}

// Connect to emulators if requested
if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  if (auth) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099');
    console.log("Connected to Auth Emulator");
  }
  if (db) {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    console.log("Connected to Firestore Emulator");
  }
}

if (import.meta.env.DEV) {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

// App Check initialization logic (Lazy & Deferred to prevent blocking FCP/LCP)
let appCheck: AppCheck | null = null;

export const initAppCheck = (): AppCheck | null => {
  if (appCheck || isEmulator || typeof window === 'undefined') return appCheck;
  const siteKey = import.meta.env.VITE_APPCHECK_SITE_KEY;
  if (!import.meta.env.DEV && !siteKey) {
    console.error("[AppCheck] CRITICAL: VITE_APPCHECK_SITE_KEY is missing in production! App Check will fail.");
    return null;
  }

  try {
    appCheck = initializeAppCheck(app, {
        provider: import.meta.env.DEV ? new CustomProvider({
            getToken: () => {
                return Promise.resolve({
                    token: 'debug-token-placeholder',
                    expireTimeMillis: Date.now() + 3600000
                });
            }
        }) : new ReCaptchaEnterpriseProvider(siteKey || ""),
        isTokenAutoRefreshEnabled: true
    });

    // Diagnostic helper for debugging App Check issues in production/mobile
    if (typeof window !== 'undefined') {
        window.debugAppCheck = async () => {
            if (!appCheck) return "App Check not initialized";
            try {
                const token = await getToken(appCheck);
                return {
                    token: token.token.slice(0, 10) + "...",
                };
            } catch (err) {
                console.error("[AppCheck] Failed to get token:", err);
                return err;
            }
        };
    }
    return appCheck;
  } catch (e) {
    console.error("App Check failed to initialize:", e);
    return null;
  }
};

// Lazy getters for non-critical modules to avoid blocking initial render
export const getFirebaseMessaging = async () => {
  if (typeof window === 'undefined') return null;
  try {
    const { getMessaging, isSupported } = await import("firebase/messaging");
    const supported = await isSupported().catch(() => false);
    if (!supported) return null;
    return getMessaging(app);
  } catch (err) {
    console.log("Firebase Messaging init failed:", err);
    return null;
  }
};

export const getFirebaseStorage = async () => {
  const { getStorage } = await import("firebase/storage");
  return getStorage(app);
};

export { app, analytics, auth, db, appCheck };

