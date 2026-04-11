// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { admin, db } from '../lib/firebase-admin.js';
import { NoteService } from './note-service.js';
import { GroupDocument, UserDocument } from '../../types/firestore.js';

describe('NoteService Multi-Group Integration Test', () => {
    const TEST_UID = 'cFg1i9IybmfV1la4OekO2jDWE9h1'; // test1
    // We'll use 4 group IDs. If they don't exist, the test will fail, 
    // but in this project we can usually find/create them.
    // For safety, let's use the one we know and some others or create dummy ones.
    const TEST_GROUP_IDS = [
        'OVtYdwOhB8uDor6MfDPG', // Existing test group
        'test_group_multi_2',
        'test_group_multi_3',
        'test_group_multi_4'
    ];

    beforeAll(async () => {
        const userRef = db.collection('users').doc(TEST_UID);
        
        // Ensure all groups exist and user is a member
        for (const gid of TEST_GROUP_IDS) {
            const groupRef = db.collection('groups').doc(gid);
            const gSnap = await groupRef.get();
            if (!gSnap.exists) {
                await groupRef.set({
                    name: `Multi Test Group ${gid}`,
                    members: [TEST_UID],
                    messageCount: 0,
                    noteCount: 0,
                    createdAt: admin.firestore.Timestamp.now()
                } as GroupDocument);
            } else {
                await groupRef.update({
                    members: admin.firestore.FieldValue.arrayUnion(TEST_UID)
                });
            }
        }

        // Ensure user has these groups in groupIds
        await userRef.update({
            groupIds: admin.firestore.FieldValue.arrayUnion(...TEST_GROUP_IDS)
        });
    });

    it('should post a note to 4 groups simultaneously and maintain consistency', async () => {
        const userRef = db.collection('users').doc(TEST_UID);
        
        // 1. Get initial states
        const uSnapInit = await userRef.get();
        const initialTotalNotes = Number((uSnapInit.data() as UserDocument).totalNotes || 0);

        const groupInits = await Promise.all(
            TEST_GROUP_IDS.map(gid => db.collection('groups').doc(gid).get())
        );
        const initialNoteCounts = groupInits.map(s => Number((s.data() as GroupDocument).noteCount || 0));

        // 2. Post the note
        const testScripture = 'Multi-Group Test 1';
        const testComment = 'Testing simultaneous sharing to 4 groups';
        
        const result = await NoteService.postNote({
            uid: TEST_UID,
            messageText: 'Multi-group test message',
            scripture: testScripture,
            comment: testComment,
            shareOption: 'specific',
            selectedShareGroups: TEST_GROUP_IDS,
            language: 'ja',
            timeZone: 'Asia/Tokyo'
        });

        expect(result.personalNoteId).toBeDefined();

        // 3. Verify User Doc
        const uSnapAfter = await userRef.get();
        expect(Number(uSnapAfter.data()?.totalNotes)).toBe(initialTotalNotes + 1);

        // 4. Verify Each Group
        for (let i = 0; i < TEST_GROUP_IDS.length; i++) {
            const gid = TEST_GROUP_IDS[i];
            const groupRef = db.collection('groups').doc(gid);
            const gSnap = await groupRef.get();
            const gData = gSnap.data() as GroupDocument;
            
            expect(Number(gData.noteCount)).toBe(initialNoteCounts[i] + 1);
            expect(gData.lastNoteByUid).toBe(TEST_UID);

            // Verify message exists in subcollection
            const msgId = result.sharedMessageIds?.[gid];
            expect(msgId).toBeDefined();
            const msgSnap = await groupRef.collection('messages').doc(msgId as string).get();
            expect(msgSnap.exists).toBe(true);
            expect(msgSnap.data()?.isNote).toBe(true);
        }

        // 5. Cleanup
        const batch = db.batch();
        batch.delete(userRef.collection('notes').doc(result.personalNoteId));
        batch.update(userRef, { 
            totalNotes: admin.firestore.FieldValue.increment(-1)
        });

        for (const gid of TEST_GROUP_IDS) {
            const groupRef = db.collection('groups').doc(gid);
            const msgId = result.sharedMessageIds?.[gid];
            if (msgId) batch.delete(groupRef.collection('messages').doc(msgId));
            batch.update(groupRef, {
                noteCount: admin.firestore.FieldValue.increment(-1),
                messageCount: admin.firestore.FieldValue.increment(-1)
            });
        }
        await batch.commit();
    }, 60000); // Higher timeout for multi-group transaction
});
