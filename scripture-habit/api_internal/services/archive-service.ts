import { admin, db } from '../lib/firebase-admin.js';
import { MessageDocument, FirestoreTimestamp } from '../../types/firestore.js';

/**
 * Archive Service for handling Bucket Pattern (Message Bundling)
 * This optimizes read costs and performance for large chat histories.
 */
export class ArchiveService {
    private static BUCKET_SIZE = 50; // Items per bucket
    private static KEEP_INDIVIDUAL_COUNT = 100; // Keep the latest N messages as individual docs for real-time responsiveness

    /**
     * Archive old individual messages into buckets and delete the source documents.
     */
    static async archiveOldMessages(groupId: string) {
        const messagesRef = db.collection('groups').doc(groupId).collection('messages');
        const bucketsRef = db.collection('groups').doc(groupId).collection('message_buckets');
        
        // 1. Fetch small chunk of old messages (Oldest first)
        const messagesToArchiveSnap = await messagesRef.orderBy('createdAt', 'asc').limit(100).get();
        
        // 2. Only archive if we have a reasonable amount to bundle, 
        // AND we are strictly above the threshold to keep latest real-time messages
        const groupSnap = await db.collection('groups').doc(groupId).get();
        const totalCount = groupSnap.data()?.messageCount || 0;

        if (totalCount <= this.KEEP_INDIVIDUAL_COUNT || messagesToArchiveSnap.empty) {
            return 0;
        }

        // To be safe, we only archive if we have at least BUCKET_SIZE messages to process
        // or if we are way above the limit.
        if (messagesToArchiveSnap.size < this.BUCKET_SIZE && totalCount < (this.KEEP_INDIVIDUAL_COUNT + this.BUCKET_SIZE)) {
            return 0;
        }

        const toArchive = messagesToArchiveSnap.docs;
        console.log(`[ArchiveService] Archiving ${toArchive.length} messages for group ${groupId}`);

        let archivedCount = 0;
        
        // 3. Process in chunks (each chunk becomes one bucket)
        for (let i = 0; i < toArchive.length; i += this.BUCKET_SIZE) {
            const chunk = toArchive.slice(i, i + this.BUCKET_SIZE);
            const messagesData = chunk.map(doc => {
                const data = doc.data() as MessageDocument;
                return { 
                    id: doc.id, 
                    ...data 
                };
            });
            
            if (messagesData.length === 0) continue;

            // Generate a bucket ID based on the start time (oldest message in chunk)
            const firstMsg = messagesData[0];
            const startTime = firstMsg.createdAt as FirestoreTimestamp;
            
            const getMillis = (ts: any) => {
                if (!ts) return Date.now();
                if (typeof ts.toMillis === 'function') return ts.toMillis();
                if (ts.seconds !== undefined) return ts.seconds * 1000;
                if (ts._seconds !== undefined) return ts._seconds * 1000;
                if (ts instanceof Date) return ts.getTime();
                return Date.now();
            };
            const timeMillis = getMillis(startTime);

            const bucketId = `bucket_${timeMillis}`;
            
            const bucketRef = bucketsRef.doc(bucketId);

            // 4. Atomic transaction to create bucket and delete individual docs
            // Limit to 500 ops per transaction (Firestore limit)
            await db.runTransaction(async (transaction) => {
                transaction.set(bucketRef, {
                    groupId,
                    messages: messagesData,
                    count: messagesData.length,
                    startTime,
                    endTime: messagesData[messagesData.length - 1].createdAt,
                    archivedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                // Delete source docs
                chunk.forEach(doc => transaction.delete(doc.ref));
            });

            archivedCount += chunk.length;
        }
        
        return archivedCount;
    }

    /**
     * Helper to list groups that might need archiving based on message counts
     * (Optional optimization to avoid checking every group)
     */
    static async getGroupsNeedingArchive(minCount = 150) {
        // Find groups where messageCount > threshold
        const snapshot = await db.collection('groups')
            .where('messageCount', '>', minCount)
            .get();
        return snapshot.docs.map(doc => doc.id);
    }
}
