import express, { Response } from 'express';
import { admin, db } from '../lib/firebase-admin.js';
import { authenticate, AuthenticatedRequest } from '../lib/middleware.js';

const router = express.Router();

/**
 * [TEST ONLY] Seeding endpoint to ensure a group exists for the test user.
 * This removes the need for UI-based group creation in E2E tests.
 */
router.post('/test/setup-test-group', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    // PROTECT: Strictly disable in production
    if (process.env.NODE_ENV === 'production' && process.env.VITE_DEV_MODE !== 'true') {
        return res.status(403).json({ error: 'Test utilities are disabled in production' });
    }

    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const timeZone = req.body.timeZone || 'UTC';
        const groupName = req.body.groupName || 'E2E Test Group';
        
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

        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();
        const userData = userDoc.data() || {};
        const nickname = userData.nickname || 'Test User';

        const now = admin.firestore.FieldValue.serverTimestamp();
        
        await db.runTransaction(async (transaction) => {
            // Group Document
            transaction.set(groupRef, {
                name: groupName,
                description: 'Automatically created for E2E tests',
                ownerUserId: uid,
                members: [uid],
                membersCount: 1,
                memberPreviews: [{ uid, nickname }],
                timeZone: timeZone, // Use the provided or default timezone
                isPublic: true,
                isPrivate: false,
                inviteCode: `TEST-${Math.floor(Math.random() * 10000)}`,
                createdAt: now,
                lastMessageAt: now,
                lastMessageByNickname: nickname,
                lastMessageByUid: uid,
                messageCount: 0,
                [`memberJoinedAt.${uid}`]: now
            });

            // Member subcollection
            const memberRef = groupRef.collection('members').doc(uid);
            transaction.set(memberRef, {
                uid,
                nickname,
                joinedAt: now,
                lastActiveAt: now,
                lastReadAt: now,
                readMessageCount: 0,
                kickThreshold: 3
            });

            // User document update
            transaction.update(userRef, {
                groupIds: admin.firestore.FieldValue.arrayUnion(groupId),
                groupId: groupId // Set as primary for dashboard redirection
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
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router;
