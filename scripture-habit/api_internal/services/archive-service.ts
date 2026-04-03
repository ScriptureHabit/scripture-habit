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
        
        // 1. Fetch all messages ordered by time (newest first)
        const allMessages = await messagesRef.orderBy('createdAt', 'desc').get();
        
        // Only archive if we have more than the "keep" threshold
        if (allMessages.size <= this.KEEP_INDIVIDUAL_COUNT) {
            return 0;
        }

        // 2. Take only the messages older than the top 100
        const toArchive = allMessages.docs.slice(this.KEEP_INDIVIDUAL_COUNT).reverse(); // Oldest first for bundling
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
            // @ts-ignore - Handle private property access for different versions of Firestore Timestamp
            const timeMillis = startTime.toMillis ? startTime.toMillis() : (startTime._seconds ? startTime._seconds * 1000 : (startTime.seconds ? startTime.seconds * 1000 : Date.now()));

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
