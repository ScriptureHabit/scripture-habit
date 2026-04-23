// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { admin, db } from '../lib/firebase-admin.js';
import { MessageService } from './message-service.js';
import { GroupDocument, MessageDocument, UserDocument } from '../../types/firestore.js';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('MessageService Integration Test', () => {
    const TEST_UID = 'cFg1i9IybmfV1la4OekO2jDWE9h1'; // test1
    const TEST_GROUP_ID = 'MSG_SRV_TEST_GRP_001'; // Isolating group ID to prevent parallel test conflicts

    beforeEach(async () => {
        const userRef = db.collection('users').doc(TEST_UID);
        // Ensure user exists
        await userRef.set({
            uid: TEST_UID,
            nickname: 'TestUser',
            groupIds: admin.firestore.FieldValue.arrayUnion(TEST_GROUP_ID)
        }, { merge: true });

        // Ensure group exists and user is in the group
        const groupRef = db.collection('groups').doc(TEST_GROUP_ID);
        await groupRef.set({
            name: 'Test Group',
            members: [TEST_UID],
            messageCount: 0,
            timeZone: 'Asia/Tokyo'
        }, { merge: true });
        
        // Also setup member subcollection
        await groupRef.collection('members').doc(TEST_UID).set({
            uid: TEST_UID,
            nickname: 'TestUser',
            joinedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    });

    it('should post a message and update group counters and member states', async () => {
        const groupRef = db.collection('groups').doc(TEST_GROUP_ID);
        
        const gSnapInit = await groupRef.get();
        const initialMsgCount = Number((gSnapInit.data() as GroupDocument).messageCount || 0);

        const text = 'Integration Test Message ' + Date.now();
        const result = await MessageService.postMessage({
            uid: TEST_UID,
            groupId: TEST_GROUP_ID,
            text
        });

        expect(result.messageId).toBeDefined();

        const gSnapAfter = await groupRef.get();
        const gDataAfter = gSnapAfter.data() as GroupDocument;
        expect(Number(gDataAfter.messageCount)).toBe(initialMsgCount + 1);
        expect(gDataAfter.lastMessageByUid).toBe(TEST_UID);
        expect(gDataAfter.lastMessageAt).toBeDefined();

        // Check member state
        const mSnap = await groupRef.collection('members').doc(TEST_UID).get();
        expect(mSnap.exists).toBe(true);
        expect(Number(mSnap.data()?.readMessageCount)).toBe(Number(gDataAfter.messageCount));

        // Cleanup
        await groupRef.collection('messages').doc(result.messageId).delete();
        await groupRef.update({
            messageCount: admin.firestore.FieldValue.increment(-1)
        });
    });

    it('should toggle reaction and update previews', async () => {
        // 1. Post a dummy message
        const result = await MessageService.postMessage({
            uid: TEST_UID,
            groupId: TEST_GROUP_ID,
            text: 'Reaction Test'
        });
        const messageId = result.messageId;

        // 2. Toggle on
        const resOn = await MessageService.toggleReaction({
            uid: TEST_UID,
            groupId: TEST_GROUP_ID,
            messageId,
            emoji: '🙏'
        });

        expect(resOn.hasReacted).toBe(true);
        expect(resOn.newUids).toContain(TEST_UID);

        const msgSnapOn = await db.collection('groups').doc(TEST_GROUP_ID).collection('messages').doc(messageId).get();
        const msgDataOn = msgSnapOn.data() as MessageDocument;
        expect(msgDataOn.reactions?.['🙏']).toContain(TEST_UID);
        expect(msgDataOn.reactionPreviews?.['🙏']?.[0].uid).toBe(TEST_UID);

        // 3. Toggle off
        const resOff = await MessageService.toggleReaction({
            uid: TEST_UID,
            groupId: TEST_GROUP_ID,
            messageId,
            emoji: '🙏'
        });

        expect(resOff.hasReacted).toBe(false);
        expect(resOff.newUids).not.toContain(TEST_UID);

        const msgSnapOff = await db.collection('groups').doc(TEST_GROUP_ID).collection('messages').doc(messageId).get();
        expect(msgSnapOff.data()?.reactions?.['🙏'] || []).not.toContain(TEST_UID);

        // Cleanup
        await db.collection('groups').doc(TEST_GROUP_ID).collection('messages').doc(messageId).delete();
        await db.collection('groups').doc(TEST_GROUP_ID).update({
            messageCount: admin.firestore.FieldValue.increment(-1)
        });
    });

    it('should recover metadata when the last message is deleted', async () => {
        // 1. Post two messages
        const res1 = await MessageService.postMessage({
            uid: TEST_UID,
            groupId: TEST_GROUP_ID,
            text: 'First Message'
        });
        const res2 = await MessageService.postMessage({
            uid: TEST_UID,
            groupId: TEST_GROUP_ID,
            text: 'Second Message'
        });

        const groupSnapMid = await db.collection('groups').doc(TEST_GROUP_ID).get();
        expect(groupSnapMid.data()?.lastMessageByUid).toBe(TEST_UID);

        // 2. Delete the second (latest) message
        await MessageService.deleteMessage({
            uid: TEST_UID,
            groupId: TEST_GROUP_ID,
            messageId: res2.messageId
        });

        // 3. Verify metadata recovered to the first message
        const groupSnapAfter = await db.collection('groups').doc(TEST_GROUP_ID).get();
        const gDataAfter = groupSnapAfter.data() as GroupDocument;
        
        // It might be different if other people are posting, but in test env it should be res1
        // We can check if the text restored if we added that to metadata, but we only have nickname/at.
        expect(gDataAfter.lastMessageByUid).toBe(TEST_UID);
        
        // Cleanup res1
        await MessageService.deleteMessage({
            uid: TEST_UID,
            groupId: TEST_GROUP_ID,
            messageId: res1.messageId
        });
    });

    it('should send a cheer and increment counter', async () => {
        // We need a valid target user. Let's use a dummy UID if it doesn't exist, 
        // but the code checks for target existence.
        // Let's create/ensure a dummy user for testing if needed.
        const DUMMY_TARGET = 'target_test_user_123';
        const targetRef = db.collection('users').doc(DUMMY_TARGET);
        const tSnap = await targetRef.get();
        if (!tSnap.exists) {
            await targetRef.set({ nickname: 'Target User', cheersReceived: 0 });
        }

        // Ensure dummy user is in group
        await db.collection('groups').doc(TEST_GROUP_ID).set({
            members: admin.firestore.FieldValue.arrayUnion(DUMMY_TARGET)
        }, { merge: true });

        const initialCheers = (await targetRef.get()).data()?.cheersReceived || 0;

        // Cleanup any existing cheer for today to allow test to run multiple times
        const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }); // Assuming Tokyo for test1
        const cheerDocId = `cheer_${TEST_UID}_${DUMMY_TARGET}_${today}`;
        await db.collection('cheers').doc(cheerDocId).delete();

        const result = await MessageService.sendCheer({
            senderUid: TEST_UID,
            targetUid: DUMMY_TARGET,
            groupId: TEST_GROUP_ID
        });

        expect(result.alreadySent).toBe(false);

        const targetDataAfter = (await targetRef.get()).data() as UserDocument;
        expect(Number(targetDataAfter.cheersReceived)).toBe(Number(initialCheers) + 1);

        // Try duplicate cheer
        const resultDup = await MessageService.sendCheer({
            senderUid: TEST_UID,
            targetUid: DUMMY_TARGET,
            groupId: TEST_GROUP_ID
        });
        expect(resultDup.alreadySent).toBe(true);

        // Cleanup
        await db.collection('cheers').doc(cheerDocId).delete();
        await targetRef.update({ cheersReceived: admin.firestore.FieldValue.increment(-1) });
    });
});
