import express, { Request, Response, NextFunction } from 'express';
import { admin, db } from '../lib/firebase-admin.js';
import { DecodedIdToken } from 'firebase-admin/auth';

const router = express.Router();

export interface AdminRequest extends Request {
    adminUser?: DecodedIdToken;
}

/**
 * Middleware to verify admin status using Firebase Custom Claims.
 * Requires an ID Token in the Authorization header.
 * 
 * To set the admin claim for a user, use the Firebase Admin SDK:
 * admin.auth().setCustomUserClaims(uid, { admin: true });
 */
const verifyAdmin = async (req: AdminRequest, res: Response, next: NextFunction) => {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // Fallback to legacy secret check for automation if needed, but warn
        if (process.env.ADMIN_SECRET && authHeader === `Bearer ${process.env.ADMIN_SECRET}`) {
            console.warn('Admin access granted via legacy ADMIN_SECRET');
            return next();
        }
        return res.status(401).send('Unauthorized: No token provided');
    }

    const token = authHeader.split('Bearer ')[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        if (decodedToken.admin === true) {
            req.adminUser = decodedToken;
            return next();
        } else {
            console.warn(`Unauthorized admin attempt by user ${decodedToken.uid}`);
            return res.status(403).send('Forbidden: Admin privileges required');
        }
    } catch (error) {
        console.error('Error verifying admin token:', error);
        return res.status(401).send('Unauthorized: Invalid token');
    }
};

const SCRIPTURE_CATEGORIES = [
    'Old Testament',
    'New Testament',
    'Book of Mormon',
    'Doctrine and Covenants',
    'Pearl of Great Price',
    'Ordinances and Proclamations',
    'General Conference',
    'BYU Speeches',
    'Other'
] as const;

const normalizeScriptureCategory = (value: unknown): string => {
    return typeof value === 'string' && (SCRIPTURE_CATEGORIES as readonly string[]).includes(value)
        ? value
        : 'Other';
};

const normalizeSearchText = (text: string): string => {
    return text
        .trim()
        .toLowerCase()
        .replace(/[\p{P}\p{S}]+/gu, ' ')
        .replace(/\s+/g, ' ');
};

const createSearchTokens = (text: string): string[] => {
    const normalized = normalizeSearchText(text);
    return Array.from(new Set(normalized.split(' ').filter(Boolean)));
};

const buildNoteSearchTokens = (note: {
    scripture?: unknown;
    chapter?: unknown;
    comment?: unknown;
    title?: unknown;
    speaker?: unknown;
}) => {
    const scripture = normalizeScriptureCategory(note.scripture);
    const chapter = typeof note.chapter === 'string' ? note.chapter : '';
    const comment = typeof note.comment === 'string' ? note.comment : '';
    const title = typeof note.title === 'string' ? note.title : '';
    const speaker = typeof note.speaker === 'string' ? note.speaker : '';
    const parts = [scripture, chapter, comment, title, speaker];
    return createSearchTokens(parts.join(' '));
};

// Migration: v1 to v2 (example)
router.post('/migrate-data', verifyAdmin, async (_req: AdminRequest, res: Response) => {

    console.log('Starting data migration...');
    try {
        const BATCH_SIZE = 100;
        let messagesMigrated = 0;

        let groupsQuery = db.collection('groups').limit(BATCH_SIZE);
        let groupsSnapshot = await groupsQuery.get();

        while (!groupsSnapshot.empty) {
            for (const groupDoc of groupsSnapshot.docs) {
                const messagesRef = groupDoc.ref.collection('messages');
                
                let messagesQuery = messagesRef.where('isEntry', '==', true).limit(BATCH_SIZE);
                let messagesSnapshot = await messagesQuery.get();

                while (!messagesSnapshot.empty) {
                    const batch = db.batch();
                    let batchCount = 0;

                    messagesSnapshot.forEach(doc => {
                        const data = doc.data();
                        if (data.isNote === undefined) {
                            batch.update(doc.ref, { isNote: true });
                            batchCount++;
                            messagesMigrated++;
                        }
                    });

                    if (batchCount > 0) {
                        await batch.commit();
                        console.log(`Migrated ${batchCount} messages in group ${groupDoc.id}`);
                    }

                    const lastMsgDoc = messagesSnapshot.docs[messagesSnapshot.docs.length - 1];
                    messagesQuery = messagesRef.where('isEntry', '==', true).startAfter(lastMsgDoc).limit(BATCH_SIZE);
                    messagesSnapshot = await messagesQuery.get();
                }
            }
            
            const lastGroupDoc = groupsSnapshot.docs[groupsSnapshot.docs.length - 1];
            groupsQuery = db.collection('groups').startAfter(lastGroupDoc).limit(BATCH_SIZE);
            groupsSnapshot = await groupsQuery.get();
        }

        let notesMigrated = 0;
        let usersMigrated = 0;
        let usersQuery = db.collection('users').limit(BATCH_SIZE);
        let usersSnapshot = await usersQuery.get();

        while (!usersSnapshot.empty) {
            const userBatch = db.batch();
            let userBatchCount = 0;

            for (const userDoc of usersSnapshot.docs) {
                const data = userDoc.data();
                if (data.totalEntries !== undefined && data.totalNotes === undefined) {
                    userBatch.update(userDoc.ref, { totalNotes: data.totalEntries });
                    userBatchCount++;
                    usersMigrated++;
                }

                const notesRef = userDoc.ref.collection('notes').limit(BATCH_SIZE);
                let notesSnapshot = await notesRef.get();
                while (!notesSnapshot.empty) {
                    const noteBatch = db.batch();
                    let noteBatchCount = 0;

                    notesSnapshot.forEach(noteDoc => {
                        const noteData = noteDoc.data();
                        const scripture = normalizeScriptureCategory(noteData.scripture);
                        const title = typeof noteData.title === 'string' ? noteData.title : null;
                        const speaker = typeof noteData.speaker === 'string' ? noteData.speaker : null;
                        const comment = typeof noteData.comment === 'string' ? noteData.comment : '';
                        const chapter = typeof noteData.chapter === 'string' ? noteData.chapter : '';
                        const normalizedTokens = buildNoteSearchTokens({ scripture, chapter, comment, title, speaker });

                        const updatePayload: Record<string, unknown> = {};
                        if (scripture !== noteData.scripture) updatePayload.scripture = scripture;
                        if (!Array.isArray(noteData.searchTokens) || noteData.searchTokens.some((token) => typeof token !== 'string') || noteData.searchTokens.length === 0) {
                            updatePayload.searchTokens = normalizedTokens;
                        }

                        if (Object.keys(updatePayload).length > 0) {
                            noteBatch.update(noteDoc.ref, updatePayload);
                            noteBatchCount++;
                            notesMigrated++;
                        }
                    });

                    if (noteBatchCount > 0) {
                        await noteBatch.commit();
                    }

                    const lastNoteDoc = notesSnapshot.docs[notesSnapshot.docs.length - 1];
                    notesSnapshot = await notesRef.startAfter(lastNoteDoc).get();
                }
            }

            if (userBatchCount > 0) {
                await userBatch.commit();
            }

            const lastUserDoc = usersSnapshot.docs[usersSnapshot.docs.length - 1];
            usersQuery = db.collection('users').startAfter(lastUserDoc).limit(BATCH_SIZE);
            usersSnapshot = await usersQuery.get();
        }

        res.json({ message: 'Migration complete', stats: { messagesMigrated, usersMigrated, notesMigrated } });
    } catch (err: unknown) {
        const error = err as Error;
        res.status(500).send('Migration failed: ' + error.message);
    }
});

export default router;
