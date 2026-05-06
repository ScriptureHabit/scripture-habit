// @vitest-environment node
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
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
});
