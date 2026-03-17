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

    const { inviteCode, groupId } = validation.data;
    const uid = req.user.uid;

    try {
        const result = await db.runTransaction(async (transaction) => {
            let groupDoc;
            if (groupId) {
                const groupRef = db.collection('groups').doc(groupId);
                groupDoc = await transaction.get(groupRef);
                if (!groupDoc.exists) throw new Error('Group not found.');
            } else if (inviteCode) {
                const groupQuery = db.collection('groups').where('inviteCode', '==', inviteCode).limit(1);
                const groupQuerySnap = await transaction.get(groupQuery);
                if (groupQuerySnap.empty) throw new Error('Invalid invite code.');
                groupDoc = groupQuerySnap.docs[0];
            } else {
                throw new Error('Group ID or Invite Code is required.');
            }

            const gid = groupDoc.id;
            const gData = groupDoc.data();

            // If it's a private group and joining via invite code, verify it
            // (Public groups can be joined via groupId directly)
            if (gData.isPrivate === true || gData.isPublic === false) {
                if (inviteCode) {
                    if (gData.inviteCode !== inviteCode) {
                        throw new Error('Invalid or expired invite code.');
                    }
                    if (gData.inviteCodeExpiresAt) {
                        const expiresAt = gData.inviteCodeExpiresAt.toDate();
                        if (expiresAt < new Date()) {
                            throw new Error('This invite link has expired. Please ask the group owner for a new one.');
                        }
                    }
                } else if (!gData.isPublic) {
                    // It's private but no invite code provided
                    throw new Error('This is a private group. You need an invite code to join.');
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
            const newMemberPreview = { uid, nickname: userData.nickname || 'Member' };
            const existingPreviews = gData.memberPreviews || [];
            // Keep unique previews, max 15
            const updatedPreviews = [newMemberPreview, ...existingPreviews.filter(p => p.uid !== uid)].slice(0, 15);

            transaction.update(groupDoc.ref, {
                members: admin.firestore.FieldValue.arrayUnion(uid),
                membersCount: admin.firestore.FieldValue.increment(1),
                memberPreviews: updatedPreviews,
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
            const updatedPreviews = (gData.memberPreviews || []).filter(p => p.uid !== uid);

            if (gData.ownerUserId === uid) {
                if (updatedMembers.length > 0) {
                    transaction.update(groupRef, {
                        ownerUserId: updatedMembers[0],
                        members: updatedMembers,
                        membersCount: admin.firestore.FieldValue.increment(-1),
                        memberPreviews: updatedPreviews,
                        [`memberLastActive.${uid}`]: admin.firestore.FieldValue.delete(),
                        [`memberLastReadAt.${uid}`]: admin.firestore.FieldValue.delete(),
                        [`memberKickThresholds.${uid}`]: admin.firestore.FieldValue.delete()
                    });
                } else {
                    transaction.delete(groupRef);
                }
            } else {
                transaction.update(groupRef, {
                    members: updatedMembers,
                    membersCount: admin.firestore.FieldValue.increment(-1),
                    memberPreviews: updatedPreviews,
                    [`memberLastActive.${uid}`]: admin.firestore.FieldValue.delete(),
                    [`memberLastReadAt.${uid}`]: admin.firestore.FieldValue.delete(),
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
        if (!userDoc.exists) {
            console.error(`UserDoc not found for UID: ${uid}`);
            return res.status(404).json({ error: 'User not found' });
        }

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
        res.status(500).json({ error: error.message || 'Internal Server Error' });
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
        // Using both isPublic and isPrivate for compatibility
        // Fetching more to sort in memory and avoid composite index requirements
        const snapshot = await db.collection('groups')
            .where('isPublic', '==', true)
            .limit(200)
            .get();

        let groups = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name,
                description: data.description,
                membersCount: data.membersCount || 0,
                noteCount: data.noteCount || 0,
                memberPreviews: data.memberPreviews || [],
                lastNoteByNickname: data.lastNoteByNickname || '',
                lastNoteAt: data.lastNoteAt || null,
                lastMessageAt: data.lastMessageAt || null,
                isPublic: true,
                createdAt: data.createdAt,
                translations: data.translations
            };
        });

        // Filter and Sort in memory
        groups = groups
            .filter(g => g.membersCount > 0)
            .sort((a, b) => (b.membersCount || 0) - (a.membersCount || 0))
            .slice(0, 50);

        res.json(groups);
    } catch (error) {
        console.error('Error fetching groups:', error);
        res.status(500).json({ error: 'Search failed', details: error.message });
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
