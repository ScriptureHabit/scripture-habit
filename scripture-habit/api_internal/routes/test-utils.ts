/* eslint-disable no-restricted-properties */
import express, { Response } from 'express';
import { admin, db } from '../lib/firebase-admin.js';
import { authenticate, AuthenticatedRequest } from '../lib/middleware.js';
import { formatDateInTimeZone } from '../../src/utils/time-utils.js';
import { ForbiddenError, AuthenticationError, NotFoundError, sendErrorResponse } from '../lib/errors.js';

const router = express.Router();

/**
 * [TEST ONLY] Seeding endpoint to ensure a group exists for the test user.
 * This removes the need for UI-based group creation in E2E tests.
 */
router.post('/setup-test-group', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
        // PROTECT: Strictly disable in production
        if (process.env.NODE_ENV === 'production' && process.env.VITE_DEV_MODE !== 'true') {
            throw new ForbiddenError('Test utilities are disabled in production');
        }

        const uid = req.user?.uid;
        if (!uid) throw new AuthenticationError('Unauthorized');

        const timeZone = req.body.timeZone || 'UTC';
        const groupName = req.body.groupName || 'E2E Test Group';
        const memberCount = req.body.memberCount || 1; // Number of members for unity percentage testing
        const setYesterdayDate = req.body.setYesterdayDate || false; // For testing midnight reset
        const unityPercentage = req.body.unityPercentage !== undefined ? req.body.unityPercentage : 0; // Direct unity percentage setting
        
        console.log(`[TestSetup] Creating group with params: setYesterdayDate=${setYesterdayDate}, unityPercentage=${unityPercentage}`);
        console.log(`[TestSetup] Request body:`, JSON.stringify(req.body));
        
        // 1. Check if user already has a group with this name
        const groupsSnapshot = await db.collection('groups')
            .where('members', 'array-contains', uid)
            .get();
        
        const existingGroupDoc = groupsSnapshot.docs.find(doc => doc.data().name === groupName);
        
        if (existingGroupDoc) {
            console.log(`[TestSetup] Group already exists: ${existingGroupDoc.id}. Ensuring timeZone is ${timeZone}`);
            await existingGroupDoc.ref.update({ timeZone });
            return res.status(200).json({ 
                message: 'Group already exists (updated timezone if needed)', 
                groupId: existingGroupDoc.id,
                isNew: false
            });
        }

        // 2. Create new group
        const groupRef = db.collection('groups').doc();
        const groupId = groupRef.id;

        // Calculate yesterday's date in the specified timezone robustly
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = formatDateInTimeZone(yesterday, timeZone);
        
        // dailyActivity: empty for testing, or yesterday if setYesterdayDate is true
        const dailyActivityDate = setYesterdayDate ? yesterdayStr : '';
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();
        const userData = userDoc.data() || {};
        const nickname = userData.nickname || 'Test User';

        const memberJoinedTime = setYesterdayDate ? yesterday : now;
        const memberJoinedAt: Record<string, admin.firestore.Timestamp | Date> = {};
        memberJoinedAt[uid] = memberJoinedTime;
        
        const additionalMembers: string[] = [];
        const additionalMemberPreviews: { uid: string; nickname: string }[] = [];
        
        if (memberCount > 1) {
            for (let i = 1; i < memberCount; i++) {
                const dummyUid = `dummy-member-${i}-${Date.now()}`;
                additionalMembers.push(dummyUid);
                additionalMemberPreviews.push({ uid: dummyUid, nickname: `Test Member ${i}` });
                memberJoinedAt[dummyUid] = memberJoinedTime;
            }
        }
        
        const allMembers = [uid, ...additionalMembers];
        const allMemberPreviews = [{ uid, nickname }, ...additionalMemberPreviews];
        
        await db.runTransaction(async (transaction) => {
            // Group Document
            transaction.set(groupRef, {
                name: groupName,
                description: 'Automatically created for E2E tests',
                ownerUserId: uid,
                members: allMembers,
                membersCount: allMembers.length,
                memberPreviews: allMemberPreviews,
                timeZone: timeZone,
                isPublic: true,
                isPrivate: false,
                inviteCode: `TEST-${Math.floor(Math.random() * 10000)}`,
                createdAt: memberJoinedTime,
                lastMessageAt: memberJoinedTime,
                lastMessageByNickname: nickname,
                lastMessageByUid: uid,
                memberJoinedAt: memberJoinedAt,
                memberLastActive: { [uid]: memberJoinedTime },
                memberLastReadAt: { [uid]: memberJoinedTime },
                lastInactivityCheckedAt: now,
                dailyActivity: { 
                    date: dailyActivityDate, 
                    activeMembers: unityPercentage === 100 ? allMembers : [] 
                }, // Set to empty or yesterday for testing
                unityPercentage: unityPercentage // Use provided value (0 or 100)
            });

            // Current user member subcollection
            const memberRef = groupRef.collection('members').doc(uid);
            transaction.set(memberRef, {
                uid,
                nickname,
                joinedAt: memberJoinedTime,
                lastActiveAt: memberJoinedTime,
                lastReadAt: memberJoinedTime,
                readMessageCount: 0,
                kickThreshold: 3
            });

            // Additional dummy members
            additionalMembers.forEach((dummyUid, index) => {
                const dummyMemberRef = groupRef.collection('members').doc(dummyUid);
                transaction.set(dummyMemberRef, {
                    uid: dummyUid,
                    nickname: `Test Member ${index + 1}`,
                    joinedAt: memberJoinedTime,
                    lastActiveAt: memberJoinedTime,
                    lastReadAt: memberJoinedTime,
                    readMessageCount: 0,
                    kickThreshold: 3
                });
            });

            // User document update
            transaction.update(userRef, {
                groupIds: admin.firestore.FieldValue.arrayUnion(groupId),
                groupId: groupId
            });
            
            // Initial system message
            const msgRef = groupRef.collection('messages').doc();
            transaction.set(msgRef, {
                text: `✨ **${nickname}** joined the test group!`,
                createdAt: now,
                senderId: 'system',
                isSystemMessage: true,
                type: 'join',
                messageType: 'join'
            });
        });

        console.log(`[TestSetup] Created group: ${groupId}`);
        res.status(201).json({ 
            message: 'Group created successfully', 
            groupId,
            isNew: true
        });

    } catch (error) {
        console.error('[TestSetup] Error:', error);
        sendErrorResponse(res, error, 'Test setup failed');
    }
});

/**
 * [TEST ONLY] Leave ALL groups for the current user.
 * Used to clean up state between E2E tests to prevent group-limit pollution.
 */
router.post('/leave-all-groups', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
        if (process.env.NODE_ENV === 'production' && process.env.VITE_DEV_MODE !== 'true') {
            throw new ForbiddenError('Test utilities are disabled in production');
        }

        const uid = req.user?.uid;
        if (!uid) throw new AuthenticationError('Unauthorized');

        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();
        if (!userDoc.exists) throw new NotFoundError('User not found');

        const userData = userDoc.data()!;
        const groupIds: string[] = userData.groupIds || (userData.groupId ? [userData.groupId] : []);

        if (groupIds.length === 0) {
            return res.status(200).json({ message: 'No groups to leave', left: 0 });
        }

        console.log(`[TestCleanup] Leaving ${groupIds.length} groups for user ${uid}`);

        const { removeMemberFromGroup } = await import('../lib/membership-utils.js');

        for (const gid of groupIds) {
            try {
                const groupRef = db.collection('groups').doc(gid);
                const groupDoc = await groupRef.get();
                
                if (groupDoc.exists) {
                    const data = groupDoc.data();
                    const createdAt = data?.createdAt?.toMillis?.() || 0;
                    if (Date.now() - createdAt < 10000) {
                        console.log(`[TestCleanup] Skipping very new group ${gid}`);
                        continue;
                    }

                    console.log(`[TestCleanup] Removing ${uid} from group ${gid}`);
                    await db.runTransaction(async (transaction) => {
                        await removeMemberFromGroup(transaction, gid, uid, {
                            removeFromUserDoc: true,
                            clearUserGroupId: true,
                            removeGroupState: true
                        });
                    });
                }
            } catch (err) {
                console.error(`[TestCleanup] Failed to leave group ${gid}:`, err);
            }
        }

        // Clear all group references from user doc
        await userRef.update({
            groupIds: [],
            groupId: admin.firestore.FieldValue.delete(),
        });

        return res.status(200).json({ message: `Left ${groupIds.length} groups`, left: groupIds.length });
    } catch (error) {
        console.error('[TestCleanup] Error:', error);
        sendErrorResponse(res, error, 'Leave all groups failed');
    }
});

/**
 * [TEST ONLY] Reset the hasSetKickThreshold flag for the user.
 */
router.post('/reset-kick-threshold', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
        if (process.env.NODE_ENV === 'production' && process.env.VITE_DEV_MODE !== 'true') {
            throw new ForbiddenError('Test utilities are disabled in production');
        }

        const uid = req.user?.uid;
        if (!uid) throw new AuthenticationError('Unauthorized');

        await db.collection('users').doc(uid).update({
            hasSetKickThreshold: admin.firestore.FieldValue.delete(),
            kickThreshold: admin.firestore.FieldValue.delete()
        });
        return res.status(200).json({ message: 'Kick threshold reset successfully' });
    } catch (error) {
        sendErrorResponse(res, error, 'Reset kick threshold failed');
    }
});

export default router;
