import { db } from '../api_internal/lib/firebase-admin.js';
import { fileURLToPath } from 'url';

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

export async function runMigration() {
    console.log('🔄 Starting data migration via CLI...');
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
                    const comment = noteData.comment;
                    const chapter = noteData.chapter;
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

    console.log('✅ Data migration complete.');
    return { messagesMigrated, usersMigrated, notesMigrated };
}

// Execute directly if run as main CLI process
const isMain = () => {
    if (!process.argv[1]) return false;
    try {
        const mainPath = fileURLToPath(import.meta.url);
        return process.argv[1] === mainPath || process.argv[1].endsWith('migrate-data.ts') || process.argv[1].endsWith('migrate-data.js');
    } catch {
        return false;
    }
};

if (isMain()) {
    runMigration()
        .then((stats) => {
            console.log('Migration completed successfully:', stats);
            process.exit(0);
        })
        .catch((err) => {
            console.error('Migration failed:', err);
            process.exit(1);
        });
}
