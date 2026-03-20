import { initializeApp, FirebaseApp } from "firebase/app";
import { getAnalytics, Analytics } from "firebase/analytics";
import { getAuth, Auth } from "firebase/auth";
import { getMessaging, Messaging, isSupported } from "firebase/messaging";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, Firestore } from "firebase/firestore";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

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
        } catch (e: any) {
          console.log("getMessaging failed:", e.message);
        }
      }
    })
    .catch((err: any) => {
      console.log("Firebase Messaging check failed:", err.message);
    });
}

// Initialize Firestore with persistent cache (modern way)
const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

const storage: FirebaseStorage = getStorage(app);

if (process.env.NODE_ENV === 'development') {
  // @ts-ignore
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
};

const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_APPCHECK_SITE_KEY),
  isTokenAutoRefreshEnabled: true
});

export { app, analytics, auth, db, messaging, storage, appCheck };

