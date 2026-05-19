// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../lib/firebase-admin.js';
import { ArchiveService } from './archive-service.js';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('ArchiveService Integration', () => {
    const GID_NO_ARCHIVE = 'ARCHIVE_GRP_NO';
    const GID_DO_ARCHIVE = 'ARCHIVE_GRP_YES';
    const GID_LARGE = 'ARCHIVE_GRP_LARGE';
    const GID_EDGE_CASE = 'ARCHIVE_GRP_EDGE';
    const GID_TYPE_NUM = 'ARCHIVE_GRP_NUM';
    const GID_TYPE_STR = 'ARCHIVE_GRP_STR';
    const GID_TYPE_OBJ = 'ARCHIVE_GRP_OBJ';
    const GID_TYPE_NULL = 'ARCHIVE_GRP_NULL';
    const GID_EXISTING = 'ARCHIVE_GRP_EXISTING';

    beforeAll(async () => {
        // Group that should NOT be archived (too few messages)
        await db.collection('groups').doc(GID_NO_ARCHIVE).set({
            name: 'No Archive',
            messageCount: 50 // <= 100
        });
        await db.collection('groups').doc(GID_NO_ARCHIVE).collection('messages').doc('msg1').set({
            text: 'Hello',
            createdAt: new Date()
        });

        // Group that should be archived (totalCount > 150)
        await db.collection('groups').doc(GID_DO_ARCHIVE).set({
            name: 'Do Archive',
            messageCount: 200 
        });
        // We add 3 messages
        await db.collection('groups').doc(GID_DO_ARCHIVE).collection('messages').doc('msg1').set({
            text: 'Old message',
            createdAt: new Date(Date.now() - 100000)
        });
        await db.collection('groups').doc(GID_DO_ARCHIVE).collection('messages').doc('msg2').set({
            text: 'Old message 2',
            createdAt: new Date(Date.now() - 90000)
        });
        await db.collection('groups').doc(GID_DO_ARCHIVE).collection('messages').doc('msg3').set({
            text: 'Old message 3',
            createdAt: new Date(Date.now() - 80000)
        });

        // Large group to test full buckets
        await db.collection('groups').doc(GID_LARGE).set({
            name: 'Large Group',
            messageCount: 500
        });
        
        // Add 55 messages to test bucket splitting
        const batch = db.batch();
        for (let i = 0; i < 55; i++) {
            // pad number so ordering is correct: msg_00, msg_01
            const id = `msg_${i.toString().padStart(2, '0')}`;
            const ref = db.collection('groups').doc(GID_LARGE).collection('messages').doc(id);
            batch.set(ref, {
                text: `Message ${i}`,
                createdAt: new Date(Date.now() - 1000000 + (i * 1000))
            });
        }
        await batch.commit();

        // Edge case (messageCount 120, docs 10 -> totalCount < 150 and docs < 50)
        await db.collection('groups').doc(GID_EDGE_CASE).set({ name: 'Edge Case', messageCount: 120 });
        for (let i=0; i<10; i++) {
            await db.collection('groups').doc(GID_EDGE_CASE).collection('messages').doc(`msg${i}`).set({ text: 'Edge', createdAt: new Date() });
        }

        // Different createdAt types
        await db.collection('groups').doc(GID_TYPE_NUM).set({ name: 'Num', messageCount: 200 });
        await db.collection('groups').doc(GID_TYPE_NUM).collection('messages').doc('msg1').set({ text: 'Num', createdAt: 1600000000000 });

        await db.collection('groups').doc(GID_TYPE_STR).set({ name: 'Str', messageCount: 200 });
        await db.collection('groups').doc(GID_TYPE_STR).collection('messages').doc('msg1').set({ text: 'Str', createdAt: '2023-01-01T00:00:00Z' });

        await db.collection('groups').doc(GID_TYPE_OBJ).set({ name: 'Obj', messageCount: 200 });
        await db.collection('groups').doc(GID_TYPE_OBJ).collection('messages').doc('msg1').set({ text: 'Obj', createdAt: { seconds: 1600000000, nanoseconds: 0 } });

        await db.collection('groups').doc(GID_TYPE_NULL).set({ name: 'Null', messageCount: 200 });
        await db.collection('groups').doc(GID_TYPE_NULL).collection('messages').doc('msg1').set({ text: 'Null', createdAt: null });

        await db.collection('groups').doc(GID_EXISTING).set({ name: 'Existing', messageCount: 200 });
        await db.collection('groups').doc(GID_EXISTING).collection('messages').doc('msg1').set({ text: 'Existing', createdAt: 1600000000000 });
        await db.collection('groups').doc(GID_EXISTING).collection('message_buckets').doc('bucket_1600000000000_msg1').set({ dummy: true });

    }, 30000);

    afterAll(async () => {
        try {
            await db.recursiveDelete(db.collection('groups').doc(GID_NO_ARCHIVE));
            await db.recursiveDelete(db.collection('groups').doc(GID_DO_ARCHIVE));
            await db.recursiveDelete(db.collection('groups').doc(GID_LARGE));
            await db.recursiveDelete(db.collection('groups').doc(GID_EDGE_CASE));
            await db.recursiveDelete(db.collection('groups').doc(GID_TYPE_NUM));
            await db.recursiveDelete(db.collection('groups').doc(GID_TYPE_STR));
            await db.recursiveDelete(db.collection('groups').doc(GID_TYPE_OBJ));
            await db.recursiveDelete(db.collection('groups').doc(GID_TYPE_NULL));
            await db.recursiveDelete(db.collection('groups').doc(GID_EXISTING));
        } catch (e) {
            console.error('Cleanup failed:', e);
        }
    }, 30000);

    it('should not archive if messageCount is below threshold', async () => {
        const archivedCount = await ArchiveService.archiveOldMessages(GID_NO_ARCHIVE);
        expect(archivedCount).toBe(0);

        // Check doc still exists
        const snap = await db.collection('groups').doc(GID_NO_ARCHIVE).collection('messages').doc('msg1').get();
        expect(snap.exists).toBe(true);
    });

    it('should archive messages if totalCount is high enough', async () => {
        const archivedCount = await ArchiveService.archiveOldMessages(GID_DO_ARCHIVE);
        expect(archivedCount).toBe(3);

        // Check source docs are deleted
        const msgsSnap = await db.collection('groups').doc(GID_DO_ARCHIVE).collection('messages').get();
        expect(msgsSnap.empty).toBe(true);

        // Check bucket is created
        const bucketsSnap = await db.collection('groups').doc(GID_DO_ARCHIVE).collection('message_buckets').get();
        expect(bucketsSnap.size).toBe(1);
        
        const bucketData = bucketsSnap.docs[0].data();
        expect(bucketData.count).toBe(3);
        expect(bucketData.messages).toHaveLength(3);
        expect(bucketData.groupId).toBe(GID_DO_ARCHIVE);
        expect(bucketData.messages[0].id).toBe('msg1');
        expect(bucketData.messages[0].text).toBe('Old message');
    });

    it('should split messages into multiple buckets of 50', async () => {
        const archivedCount = await ArchiveService.archiveOldMessages(GID_LARGE);
        // It fetches up to 100 messages, we added 55, so it should archive all 55
        expect(archivedCount).toBe(55);

        // Check buckets (55 messages = 1 bucket of 50, 1 bucket of 5)
        const bucketsSnap = await db.collection('groups').doc(GID_LARGE).collection('message_buckets').get();
        expect(bucketsSnap.size).toBe(2);

        const counts = bucketsSnap.docs.map(doc => doc.data().count);
        // We don't know the exact order of docs fetched by get(), but they should be 50 and 5
        expect(counts.includes(50)).toBe(true);
        expect(counts.includes(5)).toBe(true);

        // Check source messages are gone
        const msgsSnap = await db.collection('groups').doc(GID_LARGE).collection('messages').get();
        expect(msgsSnap.empty).toBe(true);
    });

    it('should not archive if messages < BUCKET_SIZE and totalCount < KEEP_INDIVIDUAL_COUNT + BUCKET_SIZE', async () => {
        const archivedCount = await ArchiveService.archiveOldMessages(GID_EDGE_CASE);
        expect(archivedCount).toBe(0);
    });

    it('should handle different createdAt data types', async () => {
        expect(await ArchiveService.archiveOldMessages(GID_TYPE_NUM)).toBe(1);
        expect(await ArchiveService.archiveOldMessages(GID_TYPE_STR)).toBe(1);
        expect(await ArchiveService.archiveOldMessages(GID_TYPE_OBJ)).toBe(1);
        expect(await ArchiveService.archiveOldMessages(GID_TYPE_NULL)).toBe(1);
    });

    it('should skip chunk if bucket already exists', async () => {
        const archivedCount = await ArchiveService.archiveOldMessages(GID_EXISTING);
        // It skips the chunk, so it doesn't add to archivedCount, returns 0
        expect(archivedCount).toBe(0);
        
        // Original message should still exist because it was skipped
        const snap = await db.collection('groups').doc(GID_EXISTING).collection('messages').doc('msg1').get();
        expect(snap.exists).toBe(true);
    });

    it('should return groups needing archive', async () => {
        const groups = await ArchiveService.getGroupsNeedingArchive(150);
        expect(groups).toContain(GID_DO_ARCHIVE);
        expect(groups).toContain(GID_LARGE);
        expect(groups).not.toContain(GID_NO_ARCHIVE);
    });

    it('should handle Date instance for createdAt and fallback object types', async () => {
        const { vi } = await import('vitest');
        const mockDocs = [
            {
                id: 'msg_date',
                ref: { delete: vi.fn() },
                data: () => ({
                    text: 'Date msg',
                    createdAt: new Date()
                })
            },
            {
                id: 'msg_fallback_obj',
                ref: { delete: vi.fn() },
                data: () => ({
                    text: 'Fallback Obj msg',
                    createdAt: { someField: 'not-a-timestamp' }
                })
            }
        ];

        // Mock db query
        const mockGet = vi.fn().mockResolvedValue({
            empty: false,
            size: mockDocs.length,
            docs: mockDocs
        });

        // We can mock the query chain:
        const queryChain = {
            limit: vi.fn().mockReturnThis(),
            get: mockGet
        };
        const orderChain = {
            orderBy: vi.fn().mockReturnValue(queryChain)
        };

        const collectionSpy = vi.spyOn(db, 'collection').mockImplementation((path: string) => {
            if (path === 'groups') {
                return {
                    doc: vi.fn().mockReturnValue({
                        get: vi.fn().mockResolvedValue({
                            exists: true,
                            data: () => ({ messageCount: 200 })
                        }),
                        collection: vi.fn().mockImplementation((name: string) => {
                            if (name === 'messages') {
                                return orderChain;
                            }
                            if (name === 'message_buckets') {
                                return {
                                    doc: vi.fn().mockImplementation((id: string) => ({
                                        id,
                                        parent: { id: 'message_buckets' }
                                    }))
                                };
                            }
                        })
                    })
                } as any;
            }
            return db.collection(path);
        });

        // We also need to mock db.runTransaction
        const runTransactionSpy = vi.spyOn(db, 'runTransaction').mockImplementation(async (cb) => {
            const transactionMock = {
                get: vi.fn().mockResolvedValue({ exists: false }),
                set: vi.fn(),
                delete: vi.fn()
            };
            return cb(transactionMock as any);
        });

        // Set BUCKET_SIZE to 1 to trigger archiving of both messages as separate buckets
        const originalBucketSize = (ArchiveService as any).BUCKET_SIZE;
        (ArchiveService as any).BUCKET_SIZE = 1;

        try {
            const archivedCount = await ArchiveService.archiveOldMessages('some-dummy-group');
            expect(archivedCount).toBe(2);
        } finally {
            (ArchiveService as any).BUCKET_SIZE = originalBucketSize;
            collectionSpy.mockRestore();
            runTransactionSpy.mockRestore();
        }
    });

    it('should handle missing messageCount fallback (covering line 25)', async () => {
        const { vi } = await import('vitest');
        const collectionSpy = vi.spyOn(db, 'collection').mockImplementation((path: string) => {
            if (path === 'groups') {
                return {
                    doc: vi.fn().mockReturnValue({
                        get: vi.fn().mockResolvedValue({
                            exists: true,
                            data: () => undefined // triggers || 0
                        }),
                        collection: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockReturnValue({
                                limit: vi.fn().mockReturnThis(),
                                get: vi.fn().mockResolvedValue({ empty: false, size: 1, docs: [] })
                            })
                        })
                    })
                } as any;
            }
            return db.collection(path);
        });

        const archivedCount = await ArchiveService.archiveOldMessages('dummy-grp-no-count');
        expect(archivedCount).toBe(0);
        collectionSpy.mockRestore();
    });

    it('should handle empty messagesData length edge case (covering line 53)', async () => {
        const { vi } = await import('vitest');
        const mockDocs = [];
        mockDocs.push({
            id: 'msg_dummy',
            ref: { delete: vi.fn() },
            data: () => ({
                text: 'Dummy msg',
                createdAt: new Date()
            })
        });

        // Mock slice to return empty array to trigger length === 0 check
        vi.spyOn(mockDocs, 'slice').mockReturnValue([]);

        const mockGet = vi.fn().mockResolvedValue({
            empty: false,
            size: mockDocs.length,
            docs: mockDocs
        });

        const queryChain = {
            limit: vi.fn().mockReturnThis(),
            get: mockGet
        };
        const orderChain = {
            orderBy: vi.fn().mockReturnValue(queryChain)
        };

        const collectionSpy = vi.spyOn(db, 'collection').mockImplementation((path: string) => {
            if (path === 'groups') {
                return {
                    doc: vi.fn().mockReturnValue({
                        get: vi.fn().mockResolvedValue({
                            exists: true,
                            data: () => ({ messageCount: 200 })
                        }),
                        collection: vi.fn().mockReturnValue(orderChain)
                    })
                } as any;
            }
            return db.collection(path);
        });

        // Mock BUCKET_SIZE to 1
        const originalBucketSize = (ArchiveService as any).BUCKET_SIZE;
        (ArchiveService as any).BUCKET_SIZE = 1;

        try {
            const archivedCount = await ArchiveService.archiveOldMessages('some-dummy-group');
            expect(archivedCount).toBe(0);
        } finally {
            (ArchiveService as any).BUCKET_SIZE = originalBucketSize;
            collectionSpy.mockRestore();
        }
    });
});


