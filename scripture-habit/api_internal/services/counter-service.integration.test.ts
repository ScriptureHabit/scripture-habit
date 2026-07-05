// @vitest-environment node
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { db } from '../lib/firebase-admin.js';
import { CounterService } from './counter-service.js';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('CounterService Integration', () => {
    const RUN_ID = Math.random().toString(36).substring(2, 7);
    const BASE_DOC_ID = `COUNTER_TEST_DOC_${RUN_ID}`;
    const TEST_COLL_NAME = 'subcollection';

    // Document IDs for each test case to ensure absolute isolation.
    // By using different IDs, we completely eliminate the need for `recursiveDelete`
    // in `beforeEach`, which is highly expensive and often causes timeouts.
    const GID_INCREMENT = `${BASE_DOC_ID}_increment`;
    const GID_FALLBACK = `${BASE_DOC_ID}_fallback`;
    const GID_SYNC = `${BASE_DOC_ID}_sync`;
    const GID_RECOUNT = `${BASE_DOC_ID}_recount`;
    const GID_ARCHIVE = `${BASE_DOC_ID}_archive`;
    const GID_BYPASS = `${BASE_DOC_ID}_bypass`;

    beforeEach(async () => {
        // Initialize base metadata for all test groups
        const batch = db.batch();
        const docIds = [GID_INCREMENT, GID_FALLBACK, GID_SYNC, GID_RECOUNT, GID_ARCHIVE, GID_BYPASS];
        
        for (const id of docIds) {
            const ref = db.collection('groups').doc(id);
            batch.set(ref, {
                count: 0,
                messageCount: 0,
                membersCount: 200 // Large group by default to test sharding
            });
        }
        await batch.commit();
    });

    afterAll(async () => {
        // Cleanup all created documents at the end
        const docIds = [GID_INCREMENT, GID_FALLBACK, GID_SYNC, GID_RECOUNT, GID_ARCHIVE, GID_BYPASS];
        for (const id of docIds) {
            await db.recursiveDelete(db.collection('groups').doc(id)).catch(() => {});
        }
    });

    it('should increment and retrieve sharded count', async () => {
        const docRef = db.collection('groups').doc(GID_INCREMENT);

        // Perform increment inside a transaction with membersCount=200
        await db.runTransaction(async (transaction) => {
            CounterService.increment(transaction, docRef, 'count', 5, 200);
        });

        // Retrieve count in transaction
        const countTx = await db.runTransaction(async (transaction) => {
            return await CounterService.getCountInTransaction(transaction, docRef, 'count');
        });
        expect(countTx).toBe(5);

        // Retrieve count outside transaction
        const count = await CounterService.getCount(docRef, 'count');
        expect(count).toBe(5);
    });

    it('should fall ball to 0 if a shard does not have the field', async () => {
        const docRef = db.collection('groups').doc(GID_FALLBACK);

        // Explicitly set shard 0 with the count field
        await docRef.collection('shards').doc('0').set({ count: 5 });

        // Manually write a shard document without our target field
        await docRef.collection('shards').doc('1').set({ otherField: 10 });

        // Test getCount fallback
        const count = await CounterService.getCount(docRef, 'count');
        expect(count).toBe(5);

        // Test getCountInTransaction fallback
        const countTx = await db.runTransaction(async (transaction) => {
            return await CounterService.getCountInTransaction(transaction, docRef, 'count');
        });
        expect(countTx).toBe(5);
    });

    it('should get count from doc and sync shards to the main document', async () => {
        const docRef = db.collection('groups').doc(GID_SYNC);

        // Set up a shard explicitly with a known value
        await docRef.collection('shards').doc('0').set({ count: 5 });

        // Document count should still be 0 (not yet synced)
        const initialDocCount = await CounterService.getCountFromDoc(docRef, 'count');
        expect(initialDocCount).toBe(0);

        // Aggregate and sync
        const syncedCount = await CounterService.aggregateAndSync(docRef, 'count');
        expect(syncedCount).toBe(5);

        // Now document count should be updated
        const finalDocCount = await CounterService.getCountFromDoc(docRef, 'count');
        expect(finalDocCount).toBe(5);
    });

    it('should recount and sync based on actual collection count', async () => {
        const docRef = db.collection('groups').doc(GID_RECOUNT);

        // Add 3 documents to the subcollection
        await docRef.collection(TEST_COLL_NAME).doc('doc1').set({ val: 1 });
        await docRef.collection(TEST_COLL_NAME).doc('doc2').set({ val: 2 });
        await docRef.collection(TEST_COLL_NAME).doc('doc3').set({ val: 3 });

        // Recount and sync
        const actualCount = await CounterService.recountAndSync(docRef, TEST_COLL_NAME, 'count');
        expect(actualCount).toBe(3);

        // Verify shard 0 contains the total and others contain 0
        const shard0 = await docRef.collection('shards').doc('0').get();
        expect(shard0.data()?.count).toBe(3);

        const shard1 = await docRef.collection('shards').doc('1').get();
        expect(shard1.data()?.count).toBe(0);

        // Verify main doc is updated
        const docCount = await CounterService.getCountFromDoc(docRef, 'count');
        expect(docCount).toBe(3);
    });

    it('should recount message count including archive buckets', async () => {
        const docRef = db.collection('groups').doc(GID_ARCHIVE);

        // Set up 2 active messages
        await docRef.collection('messages').doc('msg1').set({ text: 'Active 1' });
        await docRef.collection('messages').doc('msg2').set({ text: 'Active 2' });

        // Set up 2 archived message buckets (+ one without count field to test fallback)
        await docRef.collection('message_buckets').doc('bucket1').set({ count: 10 });
        await docRef.collection('message_buckets').doc('bucket2').set({ count: 25 });
        await docRef.collection('message_buckets').doc('bucket_empty').set({ dummy: true });

        // Recount message count with archive
        const totalMessages = await CounterService.recountMessageCountWithArchive(docRef);
        // Should be: 2 active + 10 bucket1 + 25 bucket2 + 0 bucket_empty = 37
        expect(totalMessages).toBe(37);

        // Verify shards are reset with total on shard 0
        const shard0 = await docRef.collection('shards').doc('0').get();
        expect(shard0.data()?.messageCount).toBe(37);

        // Verify main doc updated
        const docCount = await CounterService.getCountFromDoc(docRef, 'messageCount');
        expect(docCount).toBe(37);
    });

    it('should bypass sharding and increment main doc directly for small groups', async () => {
        const docRef = db.collection('groups').doc(GID_BYPASS);

        // Override to small group (5 members)
        await docRef.update({ count: 0, membersCount: 5 });

        // Increment with membersCount=5
        await db.runTransaction(async (transaction) => {
            CounterService.increment(transaction, docRef, 'count', 3, 5);
        });

        // Verify shards subcollection is empty (bypassed)
        const shardsAfter = await docRef.collection('shards').get();
        expect(shardsAfter.empty).toBe(true);

        // Verify main doc is updated directly
        const mainCount = await CounterService.getCountFromDoc(docRef, 'count');
        expect(mainCount).toBe(3);

        // Verify aggregateAndSync bypasses shard summation
        const synced = await CounterService.aggregateAndSync(docRef, 'count');
        expect(synced).toBe(3);
    });
});
