import { admin, db } from '../lib/firebase-admin.js';

export class CounterService {
    private static NUM_SHARDS = 10;

    /**
     * Get the total count by summing all shards for a specific field
     */
    static async getCount(ref: admin.firestore.DocumentReference, fieldName: string = 'count'): Promise<number> {
        const shards = await ref.collection('shards').get();
        let totalCount = 0;
        shards.forEach((doc) => {
            totalCount += doc.data()[fieldName] || 0;
        });
        return totalCount;
    }

    /**
     * Increment a random shard for a specific field within a transaction
     */
    static increment(transaction: admin.firestore.Transaction, ref: admin.firestore.DocumentReference, fieldName: string = 'count', value: number = 1) {
        const shardId = Math.floor(Math.random() * this.NUM_SHARDS).toString();
        const shardRef = ref.collection('shards').doc(shardId);
        
        transaction.set(shardRef, {
            [fieldName]: admin.firestore.FieldValue.increment(value)
        }, { merge: true });
    }

    /**
     * Get the total count for a specific field within a transaction
     */
    static async getCountInTransaction(transaction: admin.firestore.Transaction, ref: admin.firestore.DocumentReference, fieldName: string = 'count'): Promise<number> {
        const shardRefs = [];
        for (let i = 0; i < this.NUM_SHARDS; i++) {
            shardRefs.push(ref.collection('shards').doc(i.toString()));
        }
        
        const snaps = await transaction.getAll(...shardRefs);
        let totalCount = 0;
        snaps.forEach((doc) => {
            if (doc.exists) {
                totalCount += doc.data()?.[fieldName] || 0;
            }
        });
        return totalCount;
    }

    /**
     * Sync the sharded count back to the main document field
     */
    static async aggregateAndSync(ref: admin.firestore.DocumentReference, fieldName: string) {
        const total = await this.getCount(ref, fieldName);
        await ref.update({
            [fieldName]: total,
            [`${fieldName}_syncedAt`]: admin.firestore.FieldValue.serverTimestamp()
        });
        return total;
    }

    /**
     * SUPREME TRUTH: Recount the actual documents in a collection and sync the counter.
     */
    static async recountAndSync(docRef: admin.firestore.DocumentReference, collectionName: string, fieldName: string) {
        // High-performance count() aggregation query
        const snapshot = await docRef.collection(collectionName).count().get();
        const actualTotal = snapshot.data().count;

        // Reset shards to match actual total (Consolidate into shard 0 for simplicity)
        const batch = db.batch();
        for (let i = 0; i < this.NUM_SHARDS; i++) {
            batch.set(docRef.collection('shards').doc(i.toString()), {
                [fieldName]: i === 0 ? actualTotal : 0
            }, { merge: true });
        }
        
        batch.update(docRef, {
            [fieldName]: actualTotal,
            [`${fieldName}_syncedAt`]: admin.firestore.FieldValue.serverTimestamp(),
            [`${fieldName}_recountedAt`]: admin.firestore.FieldValue.serverTimestamp()
        });
        
        await batch.commit();
        return actualTotal;
    }
}
