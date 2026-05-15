import './load-env.js';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Force fail metadata server lookup to avoid long timeouts in emulator environment
if (process.env.FIRESTORE_EMULATOR_HOST) {
    process.env.GCP_METADATA_HOST = '127.0.0.1:9999';
    process.env.NO_GCE_CHECK = 'true';
}

if (!admin.apps.length) {
    if (process.env.FIRESTORE_EMULATOR_HOST) {
        // Initialize for Emulator with a dummy service account file to avoid ANY network lookup
        // but still satisfy the Firestore client's requirement for a valid credential type.
        try {
            const dummyKeyPath = path.join(__dirname, 'dummy-service-account.json');
            process.env.GOOGLE_APPLICATION_CREDENTIALS = dummyKeyPath;
            
            const projectId = process.env.FIREBASE_PROJECT_ID || 'scripture-habit-auth';
            admin.initializeApp({
                projectId: projectId,
                credential: admin.credential.applicationDefault()
            });
            console.log(`Firebase Admin initialized for Emulator mode (Project: ${projectId})`);
        } catch (error) {
            console.error('Firebase Admin Emulator initialization error:', error);
        }
    } else {
        let serviceAccount: admin.ServiceAccount | undefined;

        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            try {
                serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) as admin.ServiceAccount;
            } catch (err) {
                console.error('[FirebaseAdmin] Failed to parse FIREBASE_SERVICE_ACCOUNT:', (err as Error).message);
            }
        } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
            serviceAccount = {
                projectId: process.env.FIREBASE_PROJECT_ID,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            };
        } else {
            // Fallback for local development using a JSON file
            const jsonPath = path.join(__dirname, '../../backend/serviceAccountKey.json');
            if (fs.existsSync(jsonPath)) {
                serviceAccount = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as admin.ServiceAccount;
            }
        }

        if (serviceAccount) {
            try {
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount)
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

const db = (admin.apps.length ? admin.firestore() : null) as admin.firestore.Firestore;
if (db) {
    try {
        let emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
        if (emulatorHost) {
            // Ensure we use IPv4 to avoid localhost resolution issues on Windows
            emulatorHost = emulatorHost.replace('localhost', '127.0.0.1');
            console.log(`[Firebase Admin] Forcing Firestore Emulator host to: ${emulatorHost}`);
            db.settings({
                host: emulatorHost,
                ssl: false,
                ignoreUndefinedProperties: true
            });
        } else {
            db.settings({ ignoreUndefinedProperties: true });
        }
    } catch (e) {
        console.error('[Firebase Admin] Error setting Firestore settings:', e);
    }
}

export const messaging = (admin.apps.length ? admin.messaging() : null) as admin.messaging.Messaging;
export const auth = (admin.apps.length ? admin.auth() : null) as admin.auth.Auth;
export const appCheck = (admin.apps.length ? admin.appCheck() : null) as admin.appCheck.AppCheck;
export { admin, db };
export default admin;
