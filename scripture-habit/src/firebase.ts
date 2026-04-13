import { initializeApp, FirebaseApp } from "firebase/app";
import { getAnalytics, Analytics } from "firebase/analytics";
import { getAuth, Auth, connectAuthEmulator } from "firebase/auth";
import { getMessaging, Messaging, isSupported } from "firebase/messaging";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, Firestore, getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, CustomProvider, AppCheck } from "firebase/app-check";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app: FirebaseApp = initializeApp(firebaseConfig);

let analytics: Analytics | null = null;
try {
  analytics = getAnalytics(app);
} catch {
  console.log("Firebase Analytics not supported in this environment");
}

let auth: Auth | null = null;
try {
  auth = getAuth(app);
} catch {
  console.log("Firebase Auth failed to initialize");
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
    connectAuthEmulator(auth, 'http://localhost:9099');
    console.log("Connected to Auth Emulator");
  }
  if (db) {
    connectFirestoreEmulator(db, 'localhost', 8080);
    console.log("Connected to Firestore Emulator");
  }
}

if (import.meta.env.DEV) {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

let appCheck: AppCheck | null = null;
try {
  appCheck = initializeAppCheck(app, {
      provider: import.meta.env.DEV ? new CustomProvider({
          getToken: () => {
              // This is a minimal implementation for local dev.
              // Firebase script handles the debug tokens when they are provided in globals.
              return Promise.resolve({
                  token: 'debug-token-placeholder',
                  expireTimeMillis: Date.now() + 3600000
              });
          }
      }) : new ReCaptchaEnterpriseProvider(import.meta.env.VITE_APPCHECK_SITE_KEY || ""),
      isTokenAutoRefreshEnabled: true
  });
} catch (e) {
  console.error("App Check failed to initialize:", e);
}

export { app, analytics, auth, db, messaging, storage, appCheck };

