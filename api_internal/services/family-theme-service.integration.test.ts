// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { admin, db } from '../lib/firebase-admin.js';
import { FamilyThemeService } from './family-theme-service.js';
import { GroupDocument, UserDocument } from '../../types/firestore.js';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('FamilyThemeService Integration Tests', () => {
    const USER_1 = `fam_user_1_${Math.random().toString(36).substring(7)}`;
    const USER_2 = `fam_user_2_${Math.random().toString(36).substring(7)}`;
    const FAM_GROUP = `fam_group_${Math.random().toString(36).substring(7)}`;
    const OTHER_GROUP = `fam_other_group_${Math.random().toString(36).substring(7)}`;
    const AI_GROUP = `fam_ai_group_${Math.random().toString(36).substring(7)}`;

    beforeEach(async () => {
        // Clean up
        for (const gid of [FAM_GROUP, OTHER_GROUP, AI_GROUP]) {
            await db.recursiveDelete(db.collection('groups').doc(gid).collection('messages')).catch(() => {});
        }

        // Calculate yesterday in Asia/Tokyo
        const now = new Date();
        const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0];

        // Setup users
        await db.collection('users').doc(USER_1).set({
            uid: USER_1,
            nickname: 'Takehiro',
            daysStudiedCount: 5,
            streakCount: 5,
            lastPostDate: yesterday,
            studiedDates: [yesterday],
            groupIds: [FAM_GROUP, OTHER_GROUP, AI_GROUP],
            timeZone: 'Asia/Tokyo'
        } as UserDocument);

        await db.collection('users').doc(USER_2).set({
            uid: USER_2,
            nickname: 'Mary',
            daysStudiedCount: 3,
            streakCount: 3,
            lastPostDate: yesterday,
            studiedDates: [yesterday],
            groupIds: [FAM_GROUP],
            timeZone: 'Asia/Tokyo'
        } as UserDocument);

        // Setup family group
        await db.collection('groups').doc(FAM_GROUP).set({
            name: 'Kato Family',
            members: [USER_1, USER_2],
            isFamilySyncEnabled: true,
            timeZone: 'Asia/Tokyo',
            createdAt: admin.firestore.Timestamp.now()
        } as GroupDocument);

        // Setup other regular group
        await db.collection('groups').doc(OTHER_GROUP).set({
            name: 'Ward Friends',
            members: [USER_1, 'friend_user_1'],
            timeZone: 'Asia/Tokyo',
            createdAt: admin.firestore.Timestamp.now()
        } as GroupDocument);

        // Setup AI group
        await db.collection('groups').doc(AI_GROUP).set({
            name: 'AI Companion',
            members: [USER_1, 'ai-partner-bot'],
            isAiGroup: true,
            aiCompanionUid: 'ai-partner-bot',
            timeZone: 'Asia/Tokyo',
            createdAt: admin.firestore.Timestamp.now()
        } as GroupDocument);
    });

    describe('selectTheme & matching flow', () => {
        it('should handle single selection, mismatch, and successful match flow with propagation', async () => {
            // 1. User 1 selects "charity"
            const res1 = await FamilyThemeService.selectTheme({
                groupId: FAM_GROUP,
                uid: USER_1,
                themeId: 'charity',
                clientTimeZone: 'Asia/Tokyo'
            });

            expect(res1.matched).toBe(false);
            expect(res1.selections[USER_1]).toBe('charity');

            // 2. User 2 selects "patience" (mismatch)
            const res2 = await FamilyThemeService.selectTheme({
                groupId: FAM_GROUP,
                uid: USER_2,
                themeId: 'patience',
                clientTimeZone: 'Asia/Tokyo'
            });

            expect(res2.matched).toBe(false);
            expect(res2.selections[USER_2]).toBe('patience');

            // Verify group is still not completed
            const groupSnapAfterMismatch = await db.collection('groups').doc(FAM_GROUP).get();
            expect(groupSnapAfterMismatch.data()?.familyThemeSession?.matchedTheme).toBeNull();

            // 3. User 2 changes choice to "charity" (MATCH!)
            const res3 = await FamilyThemeService.selectTheme({
                groupId: FAM_GROUP,
                uid: USER_2,
                themeId: 'charity',
                clientTimeZone: 'Asia/Tokyo'
            });

            expect(res3.matched).toBe(true);
            expect(res3.matchedTheme).toBe('charity');
            expect(res3.completedBy).toContain(USER_1);
            expect(res3.completedBy).toContain(USER_2);
            expect(res3.streakUpdated).toBe(true);
            expect(res3.daysStudiedCount).toBe(4);
            expect(res3.newStreak).toBe(4);

            // 4. Verify Family Group State
            const groupSnap = await db.collection('groups').doc(FAM_GROUP).get();
            const groupData = groupSnap.data() as GroupDocument;
            expect(groupData.unityPercentage).toBe(100);
            expect(groupData.dailyActivity?.activeMembers).toContain(USER_1);
            expect(groupData.dailyActivity?.activeMembers).toContain(USER_2);

            // Verify Family Group Chat remains quiet (no automatic messages)
            const famMsgsSnap = await db.collection('groups').doc(FAM_GROUP).collection('messages').get();
            expect(famMsgsSnap.docs.length).toBe(0);

            // 5. Verify User 1 and User 2 streaks & days
            const u1Snap = await db.collection('users').doc(USER_1).get();
            const u1Data = u1Snap.data() as UserDocument;
            expect(u1Data.daysStudiedCount).toBe(6);
            expect(u1Data.streakCount).toBe(6);
            expect(u1Data.studiedDates?.length).toBe(2);

            const u2Snap = await db.collection('users').doc(USER_2).get();
            const u2Data = u2Snap.data() as UserDocument;
            expect(u2Data.daysStudiedCount).toBe(4);
            expect(u2Data.streakCount).toBe(4);

            // Verify Personal Note saved to users/{uid}/notes
            const u1NotesSnap = await db.collection('users').doc(USER_1).collection('notes').get();
            expect(u1NotesSnap.docs.length).toBe(1);
            const u1Note = u1NotesSnap.docs[0].data();
            expect(u1Note.scripture).toBe('familyStudy');
            expect(u1Note.chapter).toBe('charity');
            expect(u1Note.text).toContain('家族学習');

            const u2NotesSnap = await db.collection('users').doc(USER_2).collection('notes').get();
            expect(u2NotesSnap.docs.length).toBe(1);

            // 6. Verify Propagation to Other Group as user note & announcement
            const otherGroupSnap = await db.collection('groups').doc(OTHER_GROUP).get();
            const otherGroupData = otherGroupSnap.data() as GroupDocument;
            expect(otherGroupData.dailyActivity?.activeMembers).toContain(USER_1);
            expect(otherGroupData.lastNoteByNickname).toBe('Takehiro');
            expect(otherGroupData.lastNoteByUid).toBe(USER_1);

            const otherMsgsSnap = await db.collection('groups').doc(OTHER_GROUP).collection('messages').get();
            // 2 messages: user note + notePostedAnnouncement
            expect(otherMsgsSnap.docs.length).toBe(2);
            const otherNoteMsg = otherMsgsSnap.docs.find(d => d.data().isNote);
            expect(otherNoteMsg).toBeDefined();
            expect(otherNoteMsg?.data().senderId).toBe(USER_1);
            expect(otherNoteMsg?.data().scripture).toBe('familyStudy');
            expect(otherNoteMsg?.data().chapter).toBe('charity');
            expect(otherNoteMsg?.data().text).toContain('家族学習');

            const otherAnnounceMsg = otherMsgsSnap.docs.find(d => d.data().messageType === 'notePostedAnnouncement');
            expect(otherAnnounceMsg).toBeDefined();
            expect(otherAnnounceMsg?.data().text).toContain('Takehiro');

            // 7. Verify Propagation to AI Group
            const aiGroupSnap = await db.collection('groups').doc(AI_GROUP).get();
            const aiGroupData = aiGroupSnap.data() as GroupDocument;
            expect(aiGroupData.unityPercentage).toBe(100);

            const aiMsgsSnap = await db.collection('groups').doc(AI_GROUP).collection('messages').get();
            // Should contain user's note + announcement + AI companion response = 3
            expect(aiMsgsSnap.docs.length).toBe(3);
            const userNoteMsg = aiMsgsSnap.docs.find(d => d.data().isNote);
            expect(userNoteMsg).toBeDefined();
            expect(userNoteMsg?.data().scripture).toBe('familyStudy');
            const aiBotMsg = aiMsgsSnap.docs.find(d => d.data().senderId === 'ai-partner-bot');
            expect(aiBotMsg).toBeDefined();
            expect(aiBotMsg?.data().text).toContain('Takehiro');
        });
    });

    describe('toggleFamilySync', () => {
        it('should allow toggling and prevent enabling on multiple groups for the same user', async () => {
            const SECOND_GROUP = `fam_sec_group_${Math.random().toString(36).substring(7)}`;
            await db.collection('groups').doc(SECOND_GROUP).set({
                name: 'Second Group',
                members: [USER_1],
                isFamilySyncEnabled: false,
                createdAt: admin.firestore.Timestamp.now()
            });

            // FAM_GROUP already has isFamilySyncEnabled: true for USER_1
            // Attempting to enable on SECOND_GROUP should fail
            await expect(FamilyThemeService.toggleFamilySync(SECOND_GROUP, USER_1, true)).rejects.toThrow(
                'familyTheme.alreadyEnabledInOtherGroup'
            );

            // Disabling on FAM_GROUP
            await FamilyThemeService.toggleFamilySync(FAM_GROUP, USER_1, false);
            const famSnap = await db.collection('groups').doc(FAM_GROUP).get();
            expect(famSnap.data()?.isFamilySyncEnabled).toBe(false);

            // Now enabling on SECOND_GROUP should succeed
            await FamilyThemeService.toggleFamilySync(SECOND_GROUP, USER_1, true);
            const secondSnap = await db.collection('groups').doc(SECOND_GROUP).get();
            expect(secondSnap.data()?.isFamilySyncEnabled).toBe(true);
        });
    });
});
