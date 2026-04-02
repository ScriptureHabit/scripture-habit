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
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('Firebase Admin initialized successfully');
    } else {
        console.warn('Firebase Admin NOT initialized: Missing credentials');
    }
}

const db = admin.firestore();
try {
    // This can only be called once, so we wrap it just in case
    db.settings({ ignoreUndefinedProperties: true });
} catch {
    // If settings were already applied, ignore the error
}

export const messaging = admin.messaging();
export const auth = admin.auth();
export const appCheck = admin.appCheck();
export { admin, db };
export default admin;
