// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { admin, db } from '../lib/firebase-admin.js';
import { MessageService } from './message-service.js';
import { GroupDocument, MessageDocument, UserDocument } from '../../types/firestore.js';
import { formatDateInTimeZone } from '../../src/utils/time-utils.js';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('MessageService Integration Test', () => {
    vi.setConfig({ testTimeout: 15000 });
    const TEST_UID = `MSG_SRV_USER_${Math.random().toString(36).substring(7)}`;
    const TEST_GROUP_ID = `MSG_SRV_TEST_GRP_${Math.random().toString(36).substring(7)}`;

    beforeEach(async () => {
        const groupRef = db.collection('groups').doc(TEST_GROUP_ID);
        // Clear existing messages to prevent cross-test contamination
        await db.recursiveDelete(groupRef.collection('messages')).catch(() => {});
        await groupRef.collection('messages_latest').doc('latest').delete().catch(() => {});

        const userRef = db.collection('users').doc(TEST_UID);
        // Ensure user exists
        await userRef.set({
            uid: TEST_UID,
            nickname: 'TestUser',
            groupIds: admin.firestore.FieldValue.arrayUnion(TEST_GROUP_ID)
        }, { merge: true });

        // Ensure group exists and user is in the group
        await groupRef.set({
            name: 'Test Group',
            members: [TEST_UID],
            timeZone: 'Asia/Tokyo',
            lastInactivityCheckedAt: admin.firestore.Timestamp.now()
        });
        
        // Also setup member subcollection
        await groupRef.collection('members').doc(TEST_UID).set({
            uid: TEST_UID,
            nickname: 'TestUser',
            joinedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    });

    it('should post a message and update group counters and member states', async () => {
        const groupRef = db.collection('groups').doc(TEST_GROUP_ID);
        


        const text = 'Integration Test Message ' + Date.now();
        const result = await MessageService.postMessage({
            uid: TEST_UID,
            groupId: TEST_GROUP_ID,
            text
        });

        expect(result.messageId).toBeDefined();

        const gSnapAfter = await groupRef.get();
        const gDataAfter = gSnapAfter.data() as GroupDocument;
        expect(gDataAfter.lastMessageByUid).toBe(TEST_UID);
        expect(gDataAfter.lastMessageAt).toBeDefined();

        // Check Strategy B latest messages array
        const latestSnap = await groupRef.collection('messages_latest').doc('latest').get();
        expect(latestSnap.exists).toBe(true);
        const latestMsgs = latestSnap.data()?.messages || [];
        expect(latestMsgs.length).toBeGreaterThan(0);
        expect(latestMsgs[latestMsgs.length - 1].id).toBe(result.messageId);
        expect(latestMsgs[latestMsgs.length - 1].text).toBe(text);

        // Check member state
        const mSnap = await groupRef.collection('members').doc(TEST_UID).get();
        expect(mSnap.exists).toBe(true);

        // Cleanup
        await groupRef.collection('messages').doc(result.messageId).delete();
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

        // Check Strategy B latest reactions
        const latestSnapOn = await db.collection('groups').doc(TEST_GROUP_ID).collection('messages_latest').doc('latest').get();
        const arrayMsgOn = (latestSnapOn.data()?.messages || []).find((m: any) => m.id === messageId);
        expect(arrayMsgOn).toBeDefined();
        expect(arrayMsgOn.reactions?.['🙏']).toContain(TEST_UID);
        expect(arrayMsgOn.reactionPreviews?.['🙏']?.[0].uid).toBe(TEST_UID);

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

        // Check Strategy B deletion shrinkage
        const latestSnapDel = await db.collection('groups').doc(TEST_GROUP_ID).collection('messages_latest').doc('latest').get();
        const latestMsgsDel = latestSnapDel.data()?.messages || [];
        expect(latestMsgsDel.find((m: any) => m.id === res2.messageId)).toBeUndefined();
        expect(latestMsgsDel.find((m: any) => m.id === res1.messageId)).toBeDefined();

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

    it('should post message with replyTo and optimisticId options', async () => {
        // Test replyTo as string
        const resStr = await MessageService.postMessage({
            uid: TEST_UID,
            groupId: TEST_GROUP_ID,
            text: 'Reply with string ID',
            replyTo: 'some-previous-msg-id',
            optimisticId: 'opt-id-123'
        });
        const snapStr = await db.collection('groups').doc(TEST_GROUP_ID).collection('messages').doc(resStr.messageId).get();
        expect(snapStr.data()?.replyTo).toBe('some-previous-msg-id');
        expect(snapStr.data()?.optimisticId).toBe('opt-id-123');

        // Test replyTo as object
        const resObj = await MessageService.postMessage({
            uid: TEST_UID,
            groupId: TEST_GROUP_ID,
            text: 'Reply with object details',
            replyTo: {
                id: 'some-msg-id-2',
                senderNickname: 'OtherUser',
                text: 'Original message',
                isNote: true
            }
        });
        const snapObj = await db.collection('groups').doc(TEST_GROUP_ID).collection('messages').doc(resObj.messageId).get();
        expect(snapObj.data()?.replyTo).toEqual({
            id: 'some-msg-id-2',
            senderNickname: 'OtherUser',
            text: 'Original message',
            isNote: true
        });
    });

    it('should handle toggleReaction errors and edge cases', async () => {
        // Try toggling reaction on non-existent group/message
        await expect(MessageService.toggleReaction({
            uid: TEST_UID,
            groupId: 'non-existent-group',
            messageId: 'some-msg-id'
        })).rejects.toThrow();



        // Forbidden check: user not in group members
        const groupRef = db.collection('groups').doc(TEST_GROUP_ID);
        const forbiddenMsgRef = groupRef.collection('messages').doc('some-existing-msg-for-forbidden');
        await forbiddenMsgRef.set({ text: 'Exist message' });
        await groupRef.update({ members: [] }); // Empty members list
        await expect(MessageService.toggleReaction({
            uid: TEST_UID,
            groupId: TEST_GROUP_ID,
            messageId: 'some-existing-msg-for-forbidden'
        })).rejects.toThrow('Forbidden');

        await forbiddenMsgRef.delete();
        // Restore members
        await groupRef.update({ members: [TEST_UID] });
    });

    it('should handle editMessage errors and edge cases', async () => {
        // Message not found when archived empty
        await expect(MessageService.editMessage({
            uid: TEST_UID,
            groupId: TEST_GROUP_ID,
            messageId: 'non-existent-msg-id-to-edit',
            text: 'New Text'
        })).rejects.toThrow('Message not found');



        // Forbidden editing someone else's message
        const msgRef = db.collection('groups').doc(TEST_GROUP_ID).collection('messages').doc('some-msg-id-to-edit');
        await msgRef.set({
            senderId: 'SOME_OTHER_USER',
            text: 'Other message text'
        });
        await expect(MessageService.editMessage({
            uid: TEST_UID,
            groupId: TEST_GROUP_ID,
            messageId: 'some-msg-id-to-edit',
            text: 'Edited Text'
        })).rejects.toThrow('Forbidden');
        
        await msgRef.delete();
    });

    it('should edit message representing shared note and propagate edits', async () => {
        const OTHER_GROUP_ID = `MSG_SRV_OTHER_GRP_${Math.random().toString(36).substring(7)}`;
        await db.collection('groups').doc(OTHER_GROUP_ID).set({
            name: 'Other Group',
            members: [TEST_UID]
        });

        const noteId = 'personal-note-123';
        const noteRef = db.collection('users').doc(TEST_UID).collection('notes').doc(noteId);
        await noteRef.set({
            scripture: 'John 3:16',
            comment: 'Original comment',
            title: 'Reflections',
            speaker: 'TestUser',
            sharedMessageIds: {
                [TEST_GROUP_ID]: 'msg-group-1',
                [OTHER_GROUP_ID]: 'msg-group-2'
            }
        });

        const msg1Ref = db.collection('groups').doc(TEST_GROUP_ID).collection('messages').doc('msg-group-1');
        const msg1Data = {
            id: 'msg-group-1',
            senderId: TEST_UID,
            text: 'Original comment',
            isNote: true,
            originalNoteId: noteId,
            createdAt: admin.firestore.Timestamp.now()
        };
        await msg1Ref.set(msg1Data);
        await db.collection('groups').doc(TEST_GROUP_ID).collection('messages_latest').doc('latest').set({
            groupId: TEST_GROUP_ID,
            messages: [msg1Data]
        });

        const msg2Ref = db.collection('groups').doc(OTHER_GROUP_ID).collection('messages').doc('msg-group-2');
        const msg2Data = {
            id: 'msg-group-2',
            senderId: TEST_UID,
            text: 'Original comment',
            isNote: true,
            originalNoteId: noteId,
            createdAt: admin.firestore.Timestamp.now()
        };
        await msg2Ref.set(msg2Data);
        await db.collection('groups').doc(OTHER_GROUP_ID).collection('messages_latest').doc('latest').set({
            groupId: OTHER_GROUP_ID,
            messages: [msg2Data]
        });

        // Edit via TEST_GROUP_ID message
        await MessageService.editMessage({
            uid: TEST_UID,
            groupId: TEST_GROUP_ID,
            messageId: 'msg-group-1',
            text: 'Super New Propagated Comment!'
        });

        // Check Strategy B edit propagation
        const latestSnapEdit = await db.collection('groups').doc(TEST_GROUP_ID).collection('messages_latest').doc('latest').get();
        const arrayMsgEdit = (latestSnapEdit.data()?.messages || []).find((m: any) => m.id === 'msg-group-1');
        expect(arrayMsgEdit).toBeDefined();
        expect(arrayMsgEdit.text).toBe('Super New Propagated Comment!');
        expect(arrayMsgEdit.isEdited).toBe(true);

        // Verify message 1 is edited
        const msg1Snap = await msg1Ref.get();
        expect(msg1Snap.data()?.text).toBe('Super New Propagated Comment!');
        expect(msg1Snap.data()?.isEdited).toBe(true);

        // Verify propagated message 2 in the other group is also edited
        const msg2Snap = await msg2Ref.get();
        expect(msg2Snap.data()?.text).toBe('Super New Propagated Comment!');
        expect(msg2Snap.data()?.isEdited).toBe(true);

        // Verify the original personal note is updated as well
        const noteSnap = await noteRef.get();
        expect(noteSnap.data()?.text).toBe('Super New Propagated Comment!');
        expect(noteSnap.data()?.isEdited).toBe(true);

        // Cleanup
        await msg1Ref.delete();
        await msg2Ref.delete();
        await noteRef.delete();
        await db.collection('groups').doc(OTHER_GROUP_ID).delete();
    });

    it('should handle deleteMessage errors and edge cases', async () => {
        // Group not found
        await expect(MessageService.deleteMessage({
            uid: TEST_UID,
            groupId: 'non-existent-group-del',
            messageId: 'some-msg-id'
        })).rejects.toThrow('Group not found');

        // Message not found (archived empty)
        await expect(MessageService.deleteMessage({
            uid: TEST_UID,
            groupId: TEST_GROUP_ID,
            messageId: 'non-existent-msg-id-del'
        })).rejects.toThrow('Message not found');



        // Cannot delete system messages
        const sysMsgRef = db.collection('groups').doc(TEST_GROUP_ID).collection('messages').doc('sys-msg-del');
        await sysMsgRef.set({
            isSystemMessage: true,
            text: 'System notification'
        });
        await expect(MessageService.deleteMessage({
            uid: TEST_UID,
            groupId: TEST_GROUP_ID,
            messageId: 'sys-msg-del'
        })).rejects.toThrow('Cannot delete system messages');
        await sysMsgRef.delete();

        // Forbidden (deleting someone else's message)
        const otherMsgRef = db.collection('groups').doc(TEST_GROUP_ID).collection('messages').doc('other-msg-del');
        await otherMsgRef.set({
            senderId: 'SOME_OTHER_USER',
            text: 'Hello from another user'
        });
        await expect(MessageService.deleteMessage({
            uid: TEST_UID,
            groupId: TEST_GROUP_ID,
            messageId: 'other-msg-del'
        })).rejects.toThrow('Forbidden');
        await otherMsgRef.delete();
    });

    it('should clean up streak announcements and active member statuses on note deletion', async () => {
        // Setup user with dailyActivity and totalNotes
        const userRef = db.collection('users').doc(TEST_UID);
        await userRef.update({
            totalNotes: 5
        });

        const todayDateStr = formatDateInTimeZone(new Date(), 'Asia/Tokyo');
        const groupRef = db.collection('groups').doc(TEST_GROUP_ID);
        await groupRef.update({
            dailyActivity: {
                date: todayDateStr,
                activeMembers: [TEST_UID]
            },
            lastNoteByUid: TEST_UID,
            lastNoteByNickname: 'TestUser'
        });

        // Create a personal note reference
        const noteId = 'personal-note-to-delete';
        const noteRef = userRef.collection('notes').doc(noteId);
        await noteRef.set({
            scripture: 'Psalm 23:1',
            comment: 'Nice scripture',
            sharedWithGroups: [TEST_GROUP_ID],
            sharedMessageIds: { [TEST_GROUP_ID]: 'msg-note-del' }
        });

        // Create the note message in group
        const msgRef = groupRef.collection('messages').doc('msg-note-del');
        await msgRef.set({
            senderId: TEST_UID,
            senderNickname: 'TestUser',
            isNote: true,
            originalNoteId: noteId,
            createdAt: admin.firestore.Timestamp.now()
        });

        // Create a second older note message to allow recovery branches to run (posted yesterday)
        const otherNoteRef = groupRef.collection('messages').doc('other-note-msg');
        await otherNoteRef.set({
            senderId: TEST_UID,
            senderNickname: 'TestUser',
            isNote: true,
            createdAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 25 * 60 * 60 * 1000))
        });

        // Create a system streak announcement message
        const sysRef = groupRef.collection('messages').doc('sys-announcement-del');
        await sysRef.set({
            senderId: 'system',
            isSystemMessage: true,
            type: 'system',
            messageType: 'system',
            text: 'TestUser has a 5-day streak!',
            createdAt: admin.firestore.Timestamp.now()
        });

        // Perform deletion of the note message
        await MessageService.deleteMessage({
            uid: TEST_UID,
            groupId: TEST_GROUP_ID,
            messageId: 'msg-note-del'
        });

        // Verify note message is deleted
        const msgSnap = await msgRef.get();
        expect(msgSnap.exists).toBe(false);

        // Verify active member status is removed because there are no other note posts for today
        const groupSnap = await groupRef.get();
        const activeMembers = groupSnap.data()?.dailyActivity?.activeMembers || [];
        expect(activeMembers).not.toContain(TEST_UID);

        // Verify personal note document fields are updated/cleaned up
        const noteSnap = await noteRef.get();
        expect(noteSnap.data()?.sharedWithGroups).toEqual([]);
        expect(noteSnap.data()?.sharedMessageIds).toEqual({});

        // Verify system streak announcement was cleaned up
        const sysSnap = await sysRef.get();
        expect(sysSnap.exists).toBe(false);

        // Cleanup
        await noteRef.delete();
        await otherNoteRef.delete();
    });

    it('should delete the only note in the group and clear last note fields', async () => {
        const userRef = db.collection('users').doc(TEST_UID);
        const groupRef = db.collection('groups').doc(TEST_GROUP_ID);

        await groupRef.update({
            lastNoteByUid: TEST_UID,
            lastNoteByNickname: 'TestUser',
            lastMessageByUid: TEST_UID,
            lastMessageByNickname: 'TestUser'
        });

        const noteId = 'only-personal-note';
        const noteRef = userRef.collection('notes').doc(noteId);
        await noteRef.set({
            scripture: 'Psalm 23:1',
            comment: 'Only note comment',
            sharedWithGroups: [TEST_GROUP_ID],
            sharedMessageIds: { [TEST_GROUP_ID]: 'only-note-msg' }
        });

        const msgRef = groupRef.collection('messages').doc('only-note-msg');
        await msgRef.set({
            senderId: TEST_UID,
            senderNickname: 'TestUser',
            isNote: true,
            originalNoteId: noteId,
            createdAt: admin.firestore.Timestamp.now()
        });

        await MessageService.deleteMessage({
            uid: TEST_UID,
            groupId: TEST_GROUP_ID,
            messageId: 'only-note-msg'
        });

        const msgSnap = await msgRef.get();
        expect(msgSnap.exists).toBe(false);

        const groupSnap = await groupRef.get();
        const gData = groupSnap.data();
        expect(gData?.lastNoteByUid).toBeUndefined();
        expect(gData?.lastMessageByUid).toBeUndefined();

        await noteRef.delete();
    });

    it('should fallback to standard ISO date when timezone fails in sendCheer', async () => {
        // Change sender user timezone to an invalid one to trigger try-catch split
        const userRef = db.collection('users').doc(TEST_UID);
        await userRef.update({
            timeZone: 'InvalidTimeZone'
        });

        const DUMMY_TARGET = 'target_fallback_test';
        const targetRef = db.collection('users').doc(DUMMY_TARGET);
        await targetRef.set({ nickname: 'Fallback Target', cheersReceived: 0 });

        await db.collection('groups').doc(TEST_GROUP_ID).update({
            members: admin.firestore.FieldValue.arrayUnion(DUMMY_TARGET)
        });

        const result = await MessageService.sendCheer({
            senderUid: TEST_UID,
            targetUid: DUMMY_TARGET,
            groupId: TEST_GROUP_ID
        });

        expect(result.alreadySent).toBe(false);

        // Cleanup
        await targetRef.delete();
        await userRef.update({ timeZone: 'Asia/Tokyo' });
    });

    it('should throw errors for sendCheer edge cases', async () => {
        // 1. Group not found
        await expect(MessageService.sendCheer({
            senderUid: TEST_UID,
            targetUid: 'some-target',
            groupId: 'non-existent-group'
        })).rejects.toThrow('Group not found.');

        // 2. Forbidden (sender or target not in group)
        await expect(MessageService.sendCheer({
            senderUid: TEST_UID,
            targetUid: 'some-target-not-member',
            groupId: TEST_GROUP_ID
        })).rejects.toThrow('Forbidden.');

        // 3. Target user not found
        const DUMMY_TARGET = 'non-existent-user-id';
        await db.collection('groups').doc(TEST_GROUP_ID).update({
            members: admin.firestore.FieldValue.arrayUnion(DUMMY_TARGET)
        });

        await expect(MessageService.sendCheer({
            senderUid: TEST_UID,
            targetUid: DUMMY_TARGET,
            groupId: TEST_GROUP_ID
        })).rejects.toThrow('Target not found.');

        // Clean up group members
        await db.collection('groups').doc(TEST_GROUP_ID).update({
            members: [TEST_UID]
        });
    });

    it('should reconcile and heal corrupted messages_latest/latest document', async () => {
        const groupRef = db.collection('groups').doc(TEST_GROUP_ID);
        const latestRef = groupRef.collection('messages_latest').doc('latest');

        // 1. Post two messages to build a valid state
        const res1 = await MessageService.postMessage({
            uid: TEST_UID,
            groupId: TEST_GROUP_ID,
            text: 'First Heal Test Message'
        });
        const res2 = await MessageService.postMessage({
            uid: TEST_UID,
            groupId: TEST_GROUP_ID,
            text: 'Second Heal Test Message'
        });

        // Verify initial latest state is correct
        const initialLatestSnap = await latestRef.get();
        expect(initialLatestSnap.exists).toBe(true);
        const latestMsgs = initialLatestSnap.data()?.messages || [];
        expect(latestMsgs.length).toBe(2);
        expect(latestMsgs[0].id).toBe(res1.messageId);
        expect(latestMsgs[1].id).toBe(res2.messageId);

        // 2. Corrupt the latest document (e.g. set it to a wrong or empty array)
        // This simulates a manual Firestore console edit or out-of-sync aggregate document
        await latestRef.set({
            groupId: TEST_GROUP_ID,
            messages: [{ id: 'corrupted-message-id', text: 'Corrupted' }]
        });

        // 3. Call reconcileLatestMessages and assert it returns healed = true
        const healResult1 = await MessageService.reconcileLatestMessages(TEST_GROUP_ID);
        expect(healResult1.healed).toBe(true);
        expect(healResult1.count).toBe(2);

        // 4. Verify that it was healed back to the actual messages from history
        const healedLatestSnap = await latestRef.get();
        const healedMsgs = healedLatestSnap.data()?.messages || [];
        expect(healedMsgs.length).toBe(2);
        expect(healedMsgs[0].id).toBe(res1.messageId);
        expect(healedMsgs[1].id).toBe(res2.messageId);

        // 5. Call reconcileLatestMessages again when healthy and assert it returns healed = false
        const healResult2 = await MessageService.reconcileLatestMessages(TEST_GROUP_ID);
        expect(healResult2.healed).toBe(false);
        expect(healResult2.count).toBe(2);

        // Cleanup
        await MessageService.deleteMessage({ uid: TEST_UID, groupId: TEST_GROUP_ID, messageId: res1.messageId });
        await MessageService.deleteMessage({ uid: TEST_UID, groupId: TEST_GROUP_ID, messageId: res2.messageId });
    });
});
