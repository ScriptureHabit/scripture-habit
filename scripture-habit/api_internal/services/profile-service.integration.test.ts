// @vitest-environment node
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { admin, db } from '../lib/firebase-admin.js';
import { ProfileService } from './profile-service.js';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('ProfileService Integration', () => {
    const UID = 'PROFILE_USER';
    const G1 = 'PROFILE_GRP_1';
    const G2 = 'PROFILE_GRP_2';
    
    beforeEach(async () => {
        // 1. Setup User
        await db.collection('users').doc(UID).set({
            nickname: 'OldName',
            photoURL: 'old-url',
            groupIds: [G1, G2]
        });

        // 2. Setup Groups
        const setupGroup = async (gid: string) => {
            await db.collection('groups').doc(gid).set({
                name: `Group ${gid}`,
                members: [UID],
                memberPreviews: [{ uid: UID, nickname: 'OldName', photoURL: 'old-url' }],
                lastNoteByUid: UID,
                lastNoteByNickname: 'OldName',
                lastMessageByUid: UID,
                lastMessageByNickname: 'OldName',
                lastInactivityCheckedAt: admin.firestore.Timestamp.now()
            });
            await db.collection('groups').doc(gid).collection('members').doc(UID).set({
                nickname: 'OldName',
                photoURL: 'old-url'
            });
            
            // Add a message with a reaction preview
            const msgRef = db.collection('groups').doc(gid).collection('messages').doc('msg1');
            await msgRef.set({
                senderId: UID,
                senderNickname: 'OldName',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                reactionPreviews: {
                    '👍': [{ uid: UID, nickname: 'OldName', photoURL: 'old-url' }]
                }
            });
        };

        await setupGroup(G1);
        await setupGroup(G2);

        // 3. Setup Note to cover line 171
        await db.collection('users').doc(UID).collection('notes').doc('note1').set({
            speaker: 'OldName',
            scripture: 'Genesis 1:1',
            createdAt: admin.firestore.Timestamp.now()
        });
    });

    afterAll(async () => {
        await db.collection('users').doc(UID).delete();
        await db.recursiveDelete(db.collection('groups').doc(G1));
        await db.recursiveDelete(db.collection('groups').doc(G2));
    });

    it('should propagate nickname and photo updates across all denormalized fields', async () => {
        const updates = { nickname: 'NewName', photoURL: 'new-url' };
        
        await ProfileService.syncProfileToChats(UID, updates);

        // 1. Check Group Previews
        const g1Snap = await db.collection('groups').doc(G1).get();
        const g1Data = g1Snap.data()!;
        expect(g1Data.memberPreviews[0].nickname).toBe('NewName');
        expect(g1Data.lastNoteByNickname).toBe('NewName');

        // 2. Check Member Subcollection
        const mSnap = await db.collection('groups').doc(G1).collection('members').doc(UID).get();
        expect(mSnap.data()?.nickname).toBe('NewName');

        // 3. Check Messages & Reactions
        const msgSnap = await db.collection('groups').doc(G1).collection('messages').doc('msg1').get();
        const msgData = msgSnap.data()!;
        expect(msgData.senderNickname).toBe('NewName');
        expect(msgData.reactionPreviews['👍'][0].nickname).toBe('NewName');
        expect(msgData.reactionPreviews['👍'][0].photoURL).toBe('new-url');

        // 4. Check Note propagation (covers line 171)
        const noteSnap = await db.collection('users').doc(UID).collection('notes').doc('note1').get();
        expect(noteSnap.data()?.speaker).toBe('NewName');
    });

    it('should anonymize social identity upon purge', async () => {
        await ProfileService.purgeSocialIdentity(UID);

        const msgSnap = await db.collection('groups').doc(G1).collection('messages').doc('msg1').get();
        const msgData = msgSnap.data()!;
        
        // reactions should be anonymized
        expect(msgData.reactionPreviews['👍'][0].nickname).toBe('...');
        expect(msgData.reactionPreviews['👍'][0].photoURL).toBe('');
        
        // but the message senderNickname itself (historical truth) might remain OR be changed depending on requirement.
        // Current implementation only purges reaction previews.
        expect(msgData.senderNickname).toBe('OldName'); 
    });

    it('should handle large batches in purgeSocialIdentity (covering line 234)', async () => {
        // Create 451 bulk messages to trigger the batch limit of 450
        const bulkBatch = db.batch();
        for (let i = 0; i < 451; i++) {
            const msgRef = db.collection('groups').doc(G1).collection('messages').doc(`msg_bulk_${i}`);
            bulkBatch.set(msgRef, {
                senderId: 'SOME_OTHER_USER',
                createdAt: admin.firestore.Timestamp.now(),
                reactionPreviews: {
                    '👍': [{ uid: UID, nickname: 'OldName', photoURL: 'old-url' }]
                }
            });
        }
        await bulkBatch.commit();

        // Perform purge
        await ProfileService.purgeSocialIdentity(UID);

        // Verify the 450th bulk message was correctly anonymized
        const testMsgSnap = await db.collection('groups').doc(G1).collection('messages').doc('msg_bulk_450').get();
        expect(testMsgSnap.data()?.reactionPreviews['👍'][0].nickname).toBe('...');
    }, 45000);

    it('should handle large batches in syncProfileToChats (covering line 121 and 168)', async () => {
        // Create 451 notes to exceed the batch threshold of 450
        const noteBatch = db.batch();
        for (let i = 0; i < 451; i++) {
            const noteRef = db.collection('users').doc(UID).collection('notes').doc(`note_bulk_${i}`);
            noteBatch.set(noteRef, {
                speaker: 'OldName',
                scripture: 'Genesis 1:1',
                createdAt: admin.firestore.Timestamp.now()
            });
        }
        await noteBatch.commit();

        // Create 451 messages to exceed the batch threshold of 450
        const msgBatch = db.batch();
        for (let i = 0; i < 451; i++) {
            const msgRef = db.collection('groups').doc(G1).collection('messages').doc(`msg_bulk_sync_${i}`);
            msgBatch.set(msgRef, {
                senderId: UID,
                senderNickname: 'OldName',
                createdAt: admin.firestore.Timestamp.now()
            });
        }
        await msgBatch.commit();

        // Perform sync
        await ProfileService.syncProfileToChats(UID, { nickname: 'SuperNewName' });

        // Verify the last bulk note was updated
        const noteSnap = await db.collection('users').doc(UID).collection('notes').doc('note_bulk_450').get();
        expect(noteSnap.data()?.speaker).toBe('SuperNewName');

        // Verify the last bulk message was updated
        const msgSnap = await db.collection('groups').doc(G1).collection('messages').doc('msg_bulk_sync_450').get();
        expect(msgSnap.data()?.senderNickname).toBe('SuperNewName');
    }, 60000);

    it('should handle errors in syncProfileToChats (covering line 180)', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        // Pass undefined to cause a Firestore collection reference path error
        await ProfileService.syncProfileToChats(undefined as any, { nickname: 'ErrorName' });
        
        expect(consoleErrorSpy).toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
    });

    it('should handle errors in purgeSocialIdentity (covering line 244)', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        // Pass undefined to cause a Firestore collection reference path error
        await ProfileService.purgeSocialIdentity(undefined as any);
        
        expect(consoleErrorSpy).toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
    });
});
