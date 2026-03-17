import express from 'express';
import { admin, db } from '../lib/firebase-admin.js';

const router = express.Router();

// Migration: v1 to v2 (example)
router.post('/migrate-data', async (req, res) => {
    // Only allow if authorized (e.g., via simple secret or specific admin UID)
    const authHeader = req.headers.authorization;
    if (process.env.ADMIN_SECRET && authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
        return res.status(401).send('Unauthorized');
    }

    console.log('Starting data migration...');
    try {
        const groupsSnapshot = await db.collection('groups').get();
        let messagesMigrated = 0;

        for (const groupDoc of groupsSnapshot.docs) {
            const messagesRef = groupDoc.ref.collection('messages');
            const messagesSnapshot = await messagesRef.where('isEntry', '==', true).get();

            if (messagesSnapshot.empty) continue;

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
        }

        const usersSnapshot = await db.collection('users').get();
        let usersMigrated = 0;
        const userBatch = db.batch();
        let userBatchCount = 0;

        usersSnapshot.forEach(userDoc => {
            const data = userDoc.data();
            if (data.totalEntries !== undefined && data.totalNotes === undefined) {
                userBatch.update(userDoc.ref, { totalNotes: data.totalEntries });
                userBatchCount++;
                usersMigrated++;
            }
        });

        if (userBatchCount > 0) {
            await userBatch.commit();
        }

        res.json({ message: 'Migration complete', stats: { messagesMigrated, usersMigrated } });
    } catch (error) {
        res.status(500).send('Migration failed: ' + error.message);
    }
});

export default router;
