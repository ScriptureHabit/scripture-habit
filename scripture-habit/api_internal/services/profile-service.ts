import { db } from '../lib/firebase-admin.js';

export class ProfileService {
    /**
     * Propagates user profile changes (nickname, photoURL) to recent messages and reactions.
     * This ensures that when a user updates their look, it reflects in active chats without
     * needing to update thousands of historical records (saving costs!).
     */
    static async syncProfileToChats(uid: string, updates: { nickname?: string; photoURL?: string }) {
        if (!updates.nickname && !updates.photoURL) return;

        console.log(`[ProfileSync] Starting sync for user ${uid}...`);

        try {
            // 1. Get the user's active groups
            const userRef = db.collection('users').doc(uid);
            const userSnap = await userRef.get();
            if (!userSnap.exists) return;

            const userData = userSnap.data() || {};
            const groupIds: string[] = userData.groupIds || (userData.groupId ? [userData.groupId] : []);
            
            if (groupIds.length === 0) return;

            let currentBatch = db.batch();
            let totalOps = 0;
            let currentBatchSize = 0;

            // 2. For each group, update RECENT messages
            for (const gid of groupIds) {
                const recentMyMessages = await db.collection('groups').doc(gid).collection('messages')
                    .where('senderId', '==', uid)
                    .orderBy('createdAt', 'desc')
                    .limit(20)
                    .get();

                for (const mDoc of recentMyMessages.docs) {
                    const msgUpdate: any = {};
                    if (updates.nickname) msgUpdate.senderNickname = updates.nickname;
                    if (updates.photoURL) msgUpdate.senderPhotoURL = updates.photoURL;
                    
                    currentBatch.update(mDoc.ref, msgUpdate);
                    currentBatchSize++;
                    totalOps++;

                    if (currentBatchSize >= 450) {
                        await currentBatch.commit();
                        currentBatch = db.batch();
                        currentBatchSize = 0;
                    }
                }
            }

            if (currentBatchSize > 0) {
                await currentBatch.commit();
            }
            console.log(`[ProfileSync] Successfully completed sync for user ${uid}. Total updates: ${totalOps}`);
        } catch (error) {
            console.error(`[ProfileSync] Error syncing profile for ${uid}:`, error);
        }
    }
}
