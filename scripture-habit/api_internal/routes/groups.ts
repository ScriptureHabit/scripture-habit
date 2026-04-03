import express, { Request, Response } from 'express';
import { admin, db } from '../lib/firebase-admin.js';
import { verifyAppCheck, authenticate, requireEmailVerified, AuthenticatedRequest } from '../lib/middleware.js';
import { joinGroupSchema, updateKickThresholdSchema, leaveGroupSchema, deleteGroupSchema, updateReadStatusSchema, announceUnitySchema, updateGroupSchema, regenerateInviteCodeSchema } from '../lib/schemas.js';
import { GroupDocument, UserDocument, MemberPreview as PreviewItem, GroupMemberDocument } from '../../types/firestore.js';

const router = express.Router();


const generateInviteCode = (length = 10) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
};

// Join Group
router.post('/join-group', authenticate, requireEmailVerified, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    const validation = joinGroupSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });
    }

    const { inviteCode, groupId } = validation.data;
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

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
            const gData = groupDoc.data()! as GroupDocument;
            if (!gData) throw new Error('Group data unavailable.');

            if (gData.isPrivate === true || gData.isPublic === false) {
                if (inviteCode) {
                    if (gData.inviteCode !== inviteCode) {
                        throw new Error('Invalid or expired invite code.');
                    }
                    if (gData.inviteCodeExpiresAt) {
                        const ts = gData.inviteCodeExpiresAt as unknown as { toDate?: () => Date };
                        const expiresAt = typeof ts.toDate === 'function'
                            ? ts.toDate()
                            : new Date(gData.inviteCodeExpiresAt as string | number | Date);

                        
                        if (expiresAt < new Date()) {

                            throw new Error('This invite link has expired. Please ask the group owner for a new one.');
                        }
                    }
                } else if (!gData.isPublic) {
                    throw new Error('This is a private group. You need an invite code to join.');
                }
            }

            const members = gData.members || [];
            if (members.includes(uid)) throw new Error('You are already a member of this group.');
            if (members.length >= (gData.maxMembers || 500)) throw new Error('This group is full.');

            const userRef = db.collection('users').doc(uid);
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) throw new Error('User not found.');
            const userData = userDoc.data()! as UserDocument;
            if (!userData) throw new Error('User data unavailable.');

            const newMemberPreview = { uid, nickname: userData.nickname || 'Member' };
            const existingPreviews = (gData.memberPreviews || []) as PreviewItem[];
            const updatedPreviews = [newMemberPreview, ...existingPreviews.filter((p) => p.uid !== uid)].slice(0, 15);

            transaction.update(groupDoc.ref, {
                members: admin.firestore.FieldValue.arrayUnion(uid),
                membersCount: admin.firestore.FieldValue.increment(1),
                memberPreviews: updatedPreviews
            });

            // New: Per-user member document in subcollection
            const memberRef = groupDoc.ref.collection('members').doc(uid);
            transaction.set(memberRef, {
                uid,
                nickname: userData.nickname || 'Member',
                photoURL: userData.photoURL || '',
                joinedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
                kickThreshold: userData.kickThreshold || 3,
                lastReadAt: admin.firestore.FieldValue.serverTimestamp(),
                readMessageCount: 0
            } as unknown as GroupMemberDocument);

            transaction.update(userRef, {
                groupIds: admin.firestore.FieldValue.arrayUnion(gid),
                groupId: gid
            });

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
        let message = 'Internal Server Error';
        if (error instanceof Error) {
            message = error.message;
            console.error('Error joining group:', error.message);
        } else {
            console.error('Error joining group:', error);
        }
        res.status(400).json({ error: message });
    }
});

// Leave Group
router.post('/leave-group', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    const validation = leaveGroupSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: 'Invalid input' });
    
    const { groupId } = validation.data;
    if (!groupId) return res.status(400).json({ error: 'groupId is required' });
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    try {
        await db.runTransaction(async (transaction) => {
            const groupRef = db.collection('groups').doc(groupId);
            const userRef = db.collection('users').doc(uid);
            const gSnap = await transaction.get(groupRef);
            const uSnap = await transaction.get(userRef);

            if (!gSnap.exists) throw new Error('Group not found.');
            const gData = gSnap.data()! as GroupDocument;
            if (!gData) throw new Error('Group data unavailable.');
            const members = gData.members || [];

            if (!members.includes(uid)) throw new Error('Not a member.');

            const uData = uSnap.data()! as UserDocument;
            if (!uData) throw new Error('User data unavailable.');
            const updatedMembers = members.filter((m: string) => m !== uid);
            const existingPreviews = (gData.memberPreviews || []) as PreviewItem[];
            const updatedPreviews = existingPreviews.filter((p) => p.uid !== uid);

            if (gData.ownerUserId === uid) {
                if (updatedMembers.length > 0) {
                    transaction.update(groupRef, {
                        ownerUserId: updatedMembers[0],
                        members: updatedMembers,
                        membersCount: admin.firestore.FieldValue.increment(-1),
                        memberPreviews: updatedPreviews
                    });
                } else {
                    transaction.delete(groupRef);
                }
            } else {
                transaction.update(groupRef, {
                    members: updatedMembers,
                    membersCount: admin.firestore.FieldValue.increment(-1),
                    memberPreviews: updatedPreviews
                });
            }

            // Always delete the member subcollection document
            transaction.delete(groupRef.collection('members').doc(uid));

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

            transaction.update(userRef, {
                groupIds: admin.firestore.FieldValue.arrayRemove(groupId)
            });

            transaction.delete(userRef.collection('groupStates').doc(groupId));
        });

        res.json({ success: true });
    } catch (error) {
        let message = 'Internal Server Error';
        if (error instanceof Error) {
            message = error.message;
            console.error('Leave group failed:', error.message);
        } else {
            console.error('Leave group failed:', error);
        }
        res.status(500).json({ error: message });
    }
});

router.post('/update-read-status', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    const validation = updateReadStatusSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });

    const { groupId } = validation.data;
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const groupRef = db.collection('groups').doc(groupId);
        const userRef = db.collection('users').doc(uid);

        const [groupSnap, userSnap] = await Promise.all([groupRef.get(), userRef.get()]);
        if (!groupSnap.exists) return res.status(404).json({ error: 'Group not found' });
        if (!userSnap.exists) return res.status(404).json({ error: 'User not found' });

        const groupData = groupSnap.data()! as GroupDocument;
        if (!groupData) return res.status(404).json({ error: 'Group not found' });
        const members = groupData.members || [];
        const ownerUserId = groupData.ownerUserId || '';
        if (!members.includes(uid) && ownerUserId !== uid) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const totalMessages = groupData.messageCount || 0;

        const batch = db.batch();
        batch.set(userRef.collection('groupStates').doc(groupId), {
            readMessageCount: totalMessages, // We assume "opening it" or "marking as read" from dashboard means reading all
            lastReadAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // IMPORTANT: Stop updating the main 'groups' document map to avoid hotspots.
        // Instead, update the member's private document in the 'members' subcollection.
        batch.set(groupRef.collection('members').doc(uid), {
            lastReadAt: admin.firestore.FieldValue.serverTimestamp(),
            readMessageCount: totalMessages
        }, { merge: true });

        await batch.commit();

        res.json({ success: true });
    } catch (error) {
        let message = 'Internal Server Error';
        if (error instanceof Error) {
            message = error.message;
            console.error('Update read status failed:', error.message);
        } else {
            console.error('Update read status failed:', error);
        }
        res.status(500).json({ error: message });
    }
});

router.post('/announce-unity', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    const validation = announceUnitySchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });

    const { groupId } = validation.data;
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const groupRef = db.collection('groups').doc(groupId);

        await db.runTransaction(async (transaction) => {
            const groupDoc = await transaction.get(groupRef);
            if (!groupDoc.exists) throw new Error('Group not found');

            const groupData = groupDoc.data()! as GroupDocument;
            const members = groupData.members || [];
            const ownerUserId = groupData.ownerUserId || '';
            if (!members.includes(uid) && ownerUserId !== uid) {
                throw new Error('Forbidden');
            }

            const effectiveTimeZone = groupData.timeZone || 'UTC';
            let todayStr;
            try {
                todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: effectiveTimeZone });
            } catch {
                todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'UTC' });
            }

            const lastAnnouncementDate = groupData.lastUnityAnnouncementDate;
            if (lastAnnouncementDate === todayStr) {
                return;
            }

            transaction.update(groupRef, {
                lastUnityAnnouncementDate: todayStr
            });

            const messageRef = groupRef.collection('messages').doc();
            transaction.set(messageRef, {
                senderId: 'system',
                isSystemMessage: true,
                messageType: 'unityAnnouncement',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });

        res.json({ success: true });
    } catch (error) {
        let message = 'Internal Server Error';
        if (error instanceof Error) {
            message = error.message;
            console.error('Announce unity failed:', error.message);
            if (message === 'Forbidden') {
                return res.status(403).json({ error: 'Forbidden' });
            }
        } else {
            console.error('Announce unity failed:', error);
        }
        res.status(500).json({ error: message });
    }
});

// Update Kick Threshold
router.post('/update-kick-threshold', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    const validation = updateKickThresholdSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });
    }

    const { threshold } = validation.data;
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            console.error(`UserDoc not found for UID: ${uid}`);
            return res.status(404).json({ error: 'User not found' });
        }

        const userData = userDoc.data()! as UserDocument;
        const groupIds = userData.groupIds || (userData.groupId ? [userData.groupId] : []);

        await userRef.update({ kickThreshold: threshold });

        if (groupIds.length > 0) {
            const batch = db.batch();
            groupIds.forEach((gid: string) => {
                const gRef = db.collection('groups').doc(gid);
                // New: Only store in the member subcollection document
                batch.set(gRef.collection('members').doc(uid), {
                    kickThreshold: threshold
                }, { merge: true });
            });
            await batch.commit();
        }

        res.json({ success: true });
    } catch (error) {
        let message = 'Internal Server Error';
        if (error instanceof Error) {
            message = error.message;
            console.error('Update threshold failed:', error.message);
        } else {
            console.error('Update threshold failed:', error);
        }
        res.status(500).json({ error: message });
    }
});

// Delete Group
router.post('/delete-group', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    const validation = deleteGroupSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: 'Invalid input' });
    
    const { groupId } = validation.data;
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const groupRef = db.collection('groups').doc(groupId);
        const groupDoc = await groupRef.get();

        if (!groupDoc.exists) return res.status(404).send('Group not found');
        const groupData = groupDoc.data()! as GroupDocument;

        if (groupData.ownerUserId !== uid) {
            return res.status(403).send('Forbidden: Only owner can delete group');
        }

        const members = groupData.members || [];
        const batch = db.batch();
        const userRefs = members.map((mUid: string) => db.collection('users').doc(mUid));
        const userDocs = await db.getAll(...userRefs);

        userDocs.forEach((userDoc) => {
            if (!userDoc.exists) return;
            const uRef = userDoc.ref;
            const userData = userDoc.data()! as UserDocument;
            const updatePayload: Record<string, unknown> = {
                groupIds: admin.firestore.FieldValue.arrayRemove(groupId)
            };

            if (userData.groupId === groupId) {
                updatePayload.groupId = admin.firestore.FieldValue.delete();
            }

            batch.update(uRef, updatePayload);
            const gsRef = uRef.collection('groupStates').doc(groupId);
            batch.delete(gsRef);
        });
        await batch.commit();

        await db.recursiveDelete(groupRef);

        res.json({ success: true });
    } catch (error) {
        let message = 'Internal Server Error';
        if (error instanceof Error) {
            message = error.message;
            console.error('Group deletion failed:', error.message);
        } else {
            console.error('Group deletion failed:', error);
        }
        res.status(500).send(message);
    }
});

router.post('/update-group', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    const validation = updateGroupSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });
    }

    const { groupId, name, description, isPublic, isPrivate, translations } = validation.data;
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const groupRef = db.collection('groups').doc(groupId);
        const groupDoc = await groupRef.get();

        if (!groupDoc.exists) return res.status(404).json({ error: 'Group not found' });
        const groupData = groupDoc.data()! as GroupDocument;

        if (groupData.ownerUserId !== uid) {
            return res.status(403).json({ error: 'Forbidden: Only owner can update group' });
        }

        const updatePayload: Record<string, unknown> = {};
        if (name !== undefined) updatePayload.name = name;
        if (description !== undefined) updatePayload.description = description;
        if (isPublic !== undefined) updatePayload.isPublic = isPublic;
        if (isPrivate !== undefined) updatePayload.isPrivate = isPrivate;
        if (translations !== undefined) updatePayload.translations = translations;

        if (Object.keys(updatePayload).length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        await groupRef.update(updatePayload);
        res.json({ success: true });
    } catch (error) {
        let message = 'Request failed.';
        if (error instanceof Error) {
            message = error.message;
            console.error('Update group failed:', error.message);
        } else {
            console.error('Update group failed:', error);
        }
        res.status(500).json({ error: message });
    }
});

router.post('/regenerate-invite-code', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    const validation = regenerateInviteCodeSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });
    }

    const { groupId, expiryDays = 7 } = validation.data;
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const groupRef = db.collection('groups').doc(groupId);
        const groupDoc = await groupRef.get();

        if (!groupDoc.exists) return res.status(404).json({ error: 'Group not found' });
        const groupData = groupDoc.data()! as GroupDocument;

        if (groupData.ownerUserId !== uid) {
            return res.status(403).json({ error: 'Forbidden: Only owner can regenerate invite code' });
        }

        const newCode = generateInviteCode(10);
        const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000));

        await groupRef.update({
            inviteCode: newCode,
            inviteCodeExpiresAt: expiresAt
        });

        res.json({ success: true, inviteCode: newCode });
    } catch (error) {
        let message = 'Request failed.';
        if (error instanceof Error) {
            message = error.message;
            console.error('Regenerate invite code failed:', error.message);
        } else {
            console.error('Regenerate invite code failed:', error);
        }
        res.status(500).json({ error: message });
    }
});

// Fetch Public Groups
router.get('/groups', async (_req: Request, res: Response) => {
    try {
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

        groups = groups
            .filter(g => g.membersCount > 0)
            .sort((a, b) => (b.membersCount || 0) - (a.membersCount || 0))
            .slice(0, 50);

        res.json(groups);
    } catch (error) {
        let message = 'Search failed';
        if (error instanceof Error) {
            message = error.message;
            console.error('Error fetching groups:', error.message);
        } else {
            console.error('Error fetching groups:', error);
        }
        res.status(500).json({ error: 'Search failed', details: message });
    }
});

// Group Preview
router.get('/group-preview/:inviteCode', async (req: Request, res: Response) => {
    const { inviteCode } = req.params;

    try {
        const snapshot = await db.collection('groups').where('inviteCode', '==', inviteCode).limit(1).get();
        if (snapshot.empty) return res.status(404).json({ error: 'Group not found' });

        const groupData = snapshot.docs[0].data();

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
        if (error instanceof Error) {
            console.error('Group preview failed:', error.message);
        } else {
            console.error('Group preview failed:', error);
        }
        res.status(500).send('Fetch failed');
    }
});

export default router;
