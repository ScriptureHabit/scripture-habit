import express from 'express';
import { admin, db } from '../lib/firebase-admin.js';
import { verifyAppCheck, authenticate, requireEmailVerified } from '../lib/middleware.js';
import { joinGroupSchema, updateKickThresholdSchema, leaveGroupSchema, deleteGroupSchema } from '../lib/schemas.js';

const router = express.Router();

// Join Group
router.post('/join-group', authenticate, requireEmailVerified, verifyAppCheck, async (req, res) => {
    const validation = joinGroupSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });
    }

    const { inviteCode } = validation.data;
    const uid = req.user.uid;

    try {

        const result = await db.runTransaction(async (transaction) => {
            const groupQuery = db.collection('groups').where('inviteCode', '==', inviteCode).limit(1);
            const groupQuerySnap = await transaction.get(groupQuery);

            if (groupQuerySnap.empty) throw new Error('Invalid invite code.');

            const groupDoc = groupQuerySnap.docs[0];
            const gid = groupDoc.id;
            const gData = groupDoc.data();

            if (gData.isPrivate && gData.inviteCode !== inviteCode) {
                 throw new Error('Invalid or expired invite code.');
            }

            // Check if invite code is expired (24h)
            if (gData.inviteCodeExpiresAt) {
                const expiresAt = gData.inviteCodeExpiresAt.toDate();
                if (expiresAt < new Date()) {
                    throw new Error('This invite link has expired. Please ask the group owner for a new one.');
                }
            }

            const members = gData.members || [];
            if (members.includes(uid)) throw new Error('You are already a member of this group.');
            if (members.length >= (gData.maxMembers || 500)) throw new Error('This group is full.');

            const userRef = db.collection('users').doc(uid);
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) throw new Error('User not found.');
            const userData = userDoc.data();

            // Update Group
            transaction.update(groupDoc.ref, {
                members: admin.firestore.FieldValue.arrayUnion(uid),
                membersCount: admin.firestore.FieldValue.increment(1),
                [`memberLastActive.${uid}`]: admin.firestore.FieldValue.serverTimestamp(),
                [`memberKickThresholds.${uid}`]: userData.kickThreshold || 3
            });

            // Update User
            transaction.update(userRef, {
                groupIds: admin.firestore.FieldValue.arrayUnion(gid),
                groupId: gid // Legacy support
            });

            // System Message
            const msgRef = groupDoc.ref.collection('messages').doc();
            transaction.set(msgRef, {
                text: `✨ **${userData.nickname || 'Someone'}** joined the group! Welcome!`,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                senderId: 'system',
                isSystemMessage: true,
                type: 'join'
            });

            return { gid, groupName: gData.name };
        });

        res.status(200).json({ message: 'Success', ...result });
    } catch (error) {
        console.error('Error joining group:', error.message);
        res.status(400).json({ error: error.message });
    }
});

// Leave Group
router.post('/leave-group', authenticate, verifyAppCheck, async (req, res) => {
    const validation = leaveGroupSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: 'Invalid input' });
    
    const { groupId } = validation.data;
    const uid = req.user.uid;
    try {

        await db.runTransaction(async (transaction) => {
            const groupRef = db.collection('groups').doc(groupId);
            const userRef = db.collection('users').doc(uid);
            const gSnap = await transaction.get(groupRef);
            const uSnap = await transaction.get(userRef);

            if (!gSnap.exists) throw new Error('Group not found.');
            const gData = gSnap.data();
            const members = gData.members || [];

            if (!members.includes(uid)) throw new Error('Not a member.');

            const uData = uSnap.data();

            // Update Group
            const updatedMembers = members.filter(m => m !== uid);
            if (gData.ownerUserId === uid) {
                if (updatedMembers.length > 0) {
                    transaction.update(groupRef, {
                        ownerUserId: updatedMembers[0],
                        members: updatedMembers,
                        membersCount: admin.firestore.FieldValue.increment(-1),
                        [`memberLastActive.${uid}`]: admin.firestore.FieldValue.delete(),
                        [`memberKickThresholds.${uid}`]: admin.firestore.FieldValue.delete()
                    });
                } else {
                    transaction.delete(groupRef);
                }
            } else {
                transaction.update(groupRef, {
                    members: updatedMembers,
                    membersCount: admin.firestore.FieldValue.increment(-1),
                    [`memberLastActive.${uid}`]: admin.firestore.FieldValue.delete(),
                    [`memberKickThresholds.${uid}`]: admin.firestore.FieldValue.delete()
                });
            }

            // System Message
            if (updatedMembers.length > 0) {
                const msgRef = groupRef.collection('messages').doc();
                transaction.set(msgRef, {
                    text: `👋 **${uData.nickname || 'Someone'}** left the group.`,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    senderId: 'system',
                    isSystemMessage: true,
                    type: 'leave'
                });
            }

            // Update User
            transaction.update(userRef, {
                groupIds: admin.firestore.FieldValue.arrayRemove(groupId)
            });

            // Delete groupState
            transaction.delete(userRef.collection('groupStates').doc(groupId));
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Leave group failed:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Update Kick Threshold
router.post('/update-kick-threshold', authenticate, verifyAppCheck, async (req, res) => {
    const validation = updateKickThresholdSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });
    }

    const { threshold } = validation.data;
    const uid = req.user.uid;

    try {

        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();
        if (!userDoc.exists) return res.status(404).send('User not found');

        const userData = userDoc.data();
        const groupIds = userData.groupIds || (userData.groupId ? [userData.groupId] : []);

        // Update User Doc
        await userRef.update({ kickThreshold: threshold });

        // Propagate to all groups
        if (groupIds.length > 0) {
            const batch = db.batch();
            groupIds.forEach(gid => {
                const gRef = db.collection('groups').doc(gid);
                batch.update(gRef, {
                    [`memberKickThresholds.${uid}`]: threshold
                });
            });
            await batch.commit();
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Update threshold failed:', error);
        res.status(500).send(error.message);
    }
});

// Delete Group
router.post('/delete-group', authenticate, verifyAppCheck, async (req, res) => {
    const validation = deleteGroupSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: 'Invalid input' });
    
    const { groupId } = validation.data;
    const uid = req.user.uid;

    try {

        const groupRef = db.collection('groups').doc(groupId);
        const groupDoc = await groupRef.get();

        if (!groupDoc.exists) return res.status(404).send('Group not found');
        const groupData = groupDoc.data();

        if (groupData.ownerUserId !== uid) {
            return res.status(403).send('Forbidden: Only owner can delete group');
        }

        const members = groupData.members || [];

        // 1. Remove group from all members' groupIds
        const batch = db.batch();
        for (const mUid of members) {
            const uRef = db.collection('users').doc(mUid);
            batch.update(uRef, {
                groupIds: admin.firestore.FieldValue.arrayRemove(groupId)
            });
            const gsRef = uRef.collection('groupStates').doc(groupId);
            batch.delete(gsRef);
        }
        await batch.commit();

        // 2. Recursive Delete the group
        await db.recursiveDelete(groupRef);

        res.json({ success: true });
    } catch (error) {
        console.error('Group deletion failed:', error);
        res.status(500).send(error.message);
    }
});

// Fetch Public Groups
router.get('/groups', async (req, res) => {
    try {
        // Query for public, non-ghost groups
        const snapshot = await db.collection('groups')
            .where('isPrivate', '==', false)
            .where('membersCount', '>', 0)
            .orderBy('membersCount', 'desc')
            .limit(50)
            .get();

        const groups = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name,
                description: data.description,
                membersCount: data.membersCount || 0,
                lastNoteByNickname: data.lastNoteByNickname || '',
                lastNoteAt: data.lastNoteAt || null,
                isPrivate: false
            };
        });

        res.json(groups);
    } catch (error) {
        console.error('Error fetching groups:', error);
        res.status(500).send('Search failed');
    }
});

// Group Preview
router.get('/group-preview/:inviteCode', async (req, res) => {
    const { inviteCode } = req.params;

    try {
        const snapshot = await db.collection('groups').where('inviteCode', '==', inviteCode).limit(1).get();
        if (snapshot.empty) return res.status(404).json({ error: 'Group not found' });

        const groupData = snapshot.docs[0].data();
        
        // Expiration check
        if (groupData.inviteCodeExpiresAt) {
            const expiresAt = groupData.inviteCodeExpiresAt.toDate();
            if (expiresAt < new Date()) {
                return res.status(410).json({ error: 'Invite link expired' });
            }
        }

        res.json({
            name: groupData.name,
            description: groupData.description,
            membersCount: (groupData.members || []).length,
            isPrivate: groupData.isPrivate || false
        });
    } catch (error) {
        res.status(500).send('Fetch failed');
    }
});

export default router;
