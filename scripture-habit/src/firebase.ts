import { initializeApp, FirebaseApp } from "firebase/app";
import { getAnalytics, Analytics } from "firebase/analytics";
import { getAuth, Auth, connectAuthEmulator, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getMessaging, Messaging, isSupported } from "firebase/messaging";
import { getStorage, FirebaseStorage } from "firebase/storage";
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

let app: FirebaseApp;
try {
  app = initializeApp(firebaseConfig);
} catch (e) {
  console.error("Firebase initializeApp failed:", e);
  throw e;
}

let analytics: Analytics | null = null;
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch (e) {
    console.warn("Firebase Analytics not supported or failed:", e);
  }
}

declare global {
  interface Window {
    firebaseAuth?: Auth;
    auth?: Auth | null;
    db?: Firestore;
    debugAppCheck?: () => Promise<unknown>;
  }
}

let auth: Auth | null = null;
try {
  auth = getAuth(app);
  
  // E2E Test Optimization: Force LocalStorage persistence so Playwright can capture it
  if (typeof window !== 'undefined' && navigator.webdriver && auth) {
    window.firebaseAuth = auth;
    setPersistence(auth, browserLocalPersistence).catch(err => {
      console.error("Failed to set auth persistence:", err);
    });
  }
} catch (e) {
  console.error("Firebase Auth failed to initialize. Root cause:", e);
  // Do NOT silence this - it causes "Cannot read properties of null (reading 'app')" later
  throw e;
}

let messaging: Messaging | null = null;
if (typeof window !== 'undefined') {
  isSupported()
    .then((supported) => {
      if (supported) {
        try {
          messaging = getMessaging(app);
        } catch (e: unknown) {
          console.log("getMessaging failed:", e instanceof Error ? e.message : e);
        }
      }
    })
    .catch((err: unknown) => {
      console.log("Firebase Messaging check failed:", err instanceof Error ? err.message : err);
    });
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

const storage: FirebaseStorage = getStorage(app);

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

// Global exports for debugging
if (typeof window !== 'undefined') {
    window.auth = auth;
    window.db = db;
}

let appCheck: AppCheck | null = null;
if (!isEmulator) {
  const siteKey = import.meta.env.VITE_APPCHECK_SITE_KEY;
  if (!import.meta.env.DEV && !siteKey) {
    console.error("[AppCheck] CRITICAL: VITE_APPCHECK_SITE_KEY is missing in production! App Check will fail.");
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
                const result = {
                    token: token.token.slice(0, 10) + "...",
                };
                console.log("[AppCheck] Token Info:", result);
                return result;
            } catch (err) {
                console.error("[AppCheck] Failed to get token:", err);
                return err;
            }
        };
    }
  } catch (e) {
    console.error("App Check failed to initialize:", e);
  }
} else {
  console.log("[Firebase] App Check disabled in Emulator mode.");
}

export { app, analytics, auth, db, messaging, storage, appCheck };

