import { admin } from '../lib/firebase-admin.js';

export class CounterService {
    private static NUM_SHARDS = 5;

    /**
     * Get the total count by summing all shards
     */
    static async getCount(ref: admin.firestore.DocumentReference): Promise<number> {
        const shards = await ref.collection('shards').get();
        let totalCount = 0;
        shards.forEach((doc) => {
            totalCount += doc.data().count || 0;
        });
        return totalCount;
    }

    /**
     * Increment a random shard within a transaction
     */
    static increment(transaction: admin.firestore.Transaction, ref: admin.firestore.DocumentReference, value: number = 1) {
        const shardId = Math.floor(Math.random() * this.NUM_SHARDS).toString();
        const shardRef = ref.collection('shards').doc(shardId);
        
        transaction.set(shardRef, {
            count: admin.firestore.FieldValue.increment(value)
        }, { merge: true });
    }

    /**
     * Sync the sharded count back to the main document field
     * This is intended to be called by a background cron job
     */
    static async aggregateAndSync(ref: admin.firestore.DocumentReference, fieldName: string) {
        const total = await this.getCount(ref);
        await ref.update({
            [fieldName]: total,
            [`${fieldName}_syncedAt`]: admin.firestore.FieldValue.serverTimestamp()
        });
        return total;
    }
}
