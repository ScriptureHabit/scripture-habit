import './load-env.ts';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!admin.apps.length) {
    let serviceAccount: admin.ServiceAccount | undefined;


    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) as admin.ServiceAccount;
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
    } else {
        console.warn('Firebase Admin NOT initialized: Missing credentials. API routes requiring Auth or Firestore will fail.');
    }
}

const db = (admin.apps.length ? admin.firestore() : null) as admin.firestore.Firestore;
if (db) {
    try {
        db.settings({ ignoreUndefinedProperties: true });
    } catch (e) {
        // Settings already applied or failed
    }
}

export const messaging = (admin.apps.length ? admin.messaging() : null) as admin.messaging.Messaging;
export const auth = (admin.apps.length ? admin.auth() : null) as admin.auth.Auth;
export const appCheck = (admin.apps.length ? admin.appCheck() : null) as admin.appCheck.AppCheck;
export { admin, db };
export default admin;
