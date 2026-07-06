import './load-env.js';
// Dynamic Firebase Project ID Isolation for Vitest Concurrent Workers
import process from 'node:process';
if (process.env.VITEST === 'true') {
    if (!process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID === 'scripture-habit-auth') {
        const randomId = `sh-test-${Math.random().toString(36).substring(2, 9)}`;
        process.env.FIREBASE_PROJECT_ID = randomId;
        process.env.GCLOUD_PROJECT = randomId;
        process.env.VITE_FIREBASE_PROJECT_ID = randomId;
    }
}
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AsyncLocalStorage } from 'node:async_hooks';
import {
    initializeApp,
    getApps,
    applicationDefault,
    cert,
    type ServiceAccount
} from 'firebase-admin';
import type { App } from 'firebase-admin/app';
import {
    getAuth,
    type Auth
} from 'firebase-admin/auth';
import { getAppCheck, type AppCheck } from 'firebase-admin/app-check';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import {
    getFirestore,
    Timestamp,
    FieldValue,
    FieldPath,
    DocumentReference,
    DocumentSnapshot,
    Transaction,
    WriteBatch,
    Firestore,
    CollectionReference,
    Query,
    QuerySnapshot,
    QueryDocumentSnapshot,
    CollectionGroup,
    AggregateQuery,
    AggregateQuerySnapshot
} from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Force fail metadata server lookup to avoid long timeouts in emulator environment
if (process.env.FIRESTORE_EMULATOR_HOST) {
    process.env.GCP_METADATA_HOST = '127.0.0.1:9999';
    process.env.NO_GCE_CHECK = 'true';
}

const hasFirebaseApp = () => getApps().length > 0;

const firestoreCompat = Object.assign(
    (app?: App) => (app ? getFirestore(app) : getFirestore()),
    {
        Firestore,
        Query,
        QuerySnapshot,
        QueryDocumentSnapshot,
        CollectionGroup,
        AggregateQuery,
        AggregateQuerySnapshot,
        Timestamp,
        FieldValue,
        FieldPath,
        DocumentReference,
        DocumentSnapshot,
        Transaction,
        WriteBatch,
        CollectionReference,
    }
) as any;

const compatAdmin = {
    initializeApp,
    credential: {
        applicationDefault,
        cert
    },
    get apps() {
        return getApps();
    },
    auth: (app?: App) => getAuth(app),
    firestore: firestoreCompat,
    messaging: (app?: App) => getMessaging(app),
    appCheck: (app?: App) => getAppCheck(app),
} as any;

export function resolveServiceAccount(
    env: NodeJS.ProcessEnv,
    fileExistsFn: (p: string) => boolean,
    readFileFn: (p: string, enc: BufferEncoding) => string,
    serviceAccountJsonDir: string
): ServiceAccount | undefined {
    if (env.FIREBASE_SERVICE_ACCOUNT) {
        try {
            return JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as ServiceAccount;
        } catch (err) {
            console.error('[FirebaseAdmin] Failed to parse FIREBASE_SERVICE_ACCOUNT:', (err as Error).message);
            return undefined;
        }
    } else if (env.FIREBASE_PROJECT_ID && env.FIREBASE_PRIVATE_KEY) {
        return {
            projectId: env.FIREBASE_PROJECT_ID,
            privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\n/g, '\n'),
            clientEmail: env.FIREBASE_CLIENT_EMAIL,
        };
    } else {
        const jsonPath = path.join(serviceAccountJsonDir, '../../backend/serviceAccountKey.json');
        if (fileExistsFn(jsonPath)) {
            return JSON.parse(readFileFn(jsonPath, 'utf8')) as ServiceAccount;
        }
    }
    return undefined;
}

if (!hasFirebaseApp()) {
    if (process.env.FIRESTORE_EMULATOR_HOST) {
        // Initialize for Emulator with a dummy service account file to avoid ANY network lookup
        // but still satisfy the Firestore client's requirement for a valid credential type.
        try {
            const dummyKeyPath = path.join(__dirname, 'dummy-service-account.json');
            process.env.GOOGLE_APPLICATION_CREDENTIALS = dummyKeyPath;

            const projectId = process.env.FIREBASE_PROJECT_ID || 'scripture-habit-auth';
            initializeApp({
                projectId,
                credential: applicationDefault()
            });
            console.log(`Firebase Admin initialized for Emulator mode (Project: ${projectId})`);
        } catch (error) {
            console.error('Firebase Admin Emulator initialization error:', error);
        }
    } else {
        const serviceAccount = resolveServiceAccount(process.env, fs.existsSync, fs.readFileSync, __dirname);

        if (serviceAccount) {
            try {
                initializeApp({
                    credential: cert(serviceAccount)
                });
                console.log('Firebase Admin initialized successfully');
            } catch (error) {
                console.error('Firebase Admin initialization error:', error);
            }
        } else if (process.env.NODE_ENV === 'test') {
            console.warn('Firebase Admin: Running in test mode without FIRESTORE_EMULATOR_HOST. Firestore operations will be skipped.');
        } else {
            console.warn('Firebase Admin NOT initialized: Missing credentials. API routes requiring Auth or Firestore will fail.');
        }
    }
}

export const dbStorage = new AsyncLocalStorage<Firestore>();
export const dbRegistry = new Map<number, Firestore>();

export const rawDb = (hasFirebaseApp() ? getFirestore() : null) as Firestore;
if (rawDb) {
    try {
        let emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
        if (emulatorHost) {
            // Ensure we use IPv4 to avoid localhost resolution issues on Windows
            emulatorHost = emulatorHost.replace('localhost', '127.0.0.1');
            console.log(`[Firebase Admin] Forcing Firestore Emulator host to: ${emulatorHost}`);
            rawDb.settings({
                host: emulatorHost,
                ssl: false,
                ignoreUndefinedProperties: true
            });
        } else {
            rawDb.settings({ ignoreUndefinedProperties: true });
        }
    } catch (e) {
        console.error('[Firebase Admin] Error setting Firestore settings:', e);
    }
}

export const db = rawDb ? new Proxy(rawDb as Firestore, {
    get(_target, prop) {
        const activeDb = dbStorage.getStore() || rawDb;
        if (!activeDb) {
            return undefined;
        }
        const val = Reflect.get(activeDb, prop);
        if (typeof val === 'function') {
            if ('_isMockFunction' in val || 'mock' in val) {
                return val;
            }
            return val.bind(activeDb);
        }
        return val;
    },
    set(_target, prop, value) {
        const activeDb = dbStorage.getStore() || rawDb;
        if (!activeDb) {
            return false;
        }
        return Reflect.set(activeDb, prop, value);
    }
}) : null as unknown as Firestore;

export function setDbInstance() {
    console.warn('[Firebase Admin] Warning: setDbInstance is deprecated. Use dbStorage.run() instead.');
}

export const messaging = (hasFirebaseApp() ? getMessaging() : null) as Messaging;
export const auth = (hasFirebaseApp() ? getAuth() : null) as Auth;
export const appCheck = (hasFirebaseApp() ? getAppCheck() : null) as AppCheck;

export const admin = compatAdmin;
export default admin;
