import express, { Request, Response } from 'express';
import { admin, db } from '../lib/firebase-admin.js';
import { verifyAppCheck, authenticate, requireEmailVerified, AuthenticatedRequest } from '../lib/middleware.js';
import { joinGroupSchema, updateKickThresholdSchema, leaveGroupSchema, deleteGroupSchema, updateReadStatusSchema, announceUnitySchema, updateGroupSchema, regenerateInviteCodeSchema } from '../lib/schemas.js';
import { GroupDocument, UserDocument, MemberPreview as PreviewItem, GroupMemberDocument, FirestoreTimestamp } from '../../types/firestore.js';
import { CounterService } from '../services/counter-service.js';


const router = express.Router();


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
            let groupRef;
            if (groupId) {
                groupRef = db.collection('groups').doc(groupId);
            } else if (inviteCode) {
                const groupQuery = db.collection('groups').where('inviteCode', '==', inviteCode).limit(1);
                const querySnap = await transaction.get(groupQuery);
                if (querySnap.empty) throw new Error('Invalid invite code.');
                groupRef = querySnap.docs[0].ref;
            } else {
                throw new Error('Group ID or Invite Code is required.');
            }

            const userRef = db.collection('users').doc(uid);

            // TRUTH: Execute all READS before any WRITES
            const [groupDoc, userDoc, totalMessages] = await Promise.all([
                transaction.get(groupRef),
                transaction.get(userRef),
                CounterService.getCountInTransaction(transaction, groupRef, 'messageCount')
            ]);

            if (!groupDoc.exists) throw new Error('Group not found.');
            if (!userDoc.exists) throw new Error('User not found.');

            const gid = groupDoc.id;
            const gData = groupDoc.data()! as GroupDocument;
            const userData = userDoc.data()! as UserDocument;

            // 1. Validation Phase
            if (gData.isPrivate === true || gData.isPublic === false) {
                if (inviteCode) {
                    if (gData.inviteCode !== inviteCode) {
                        throw new Error('Invalid or expired invite code.');
                    }
                    if (gData.inviteCodeExpiresAt) {
                        const ts = gData.inviteCodeExpiresAt as any;
                        const expiresAt = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
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

            // 2. Prepare Data
            const newMemberPreview = { uid, nickname: userData.nickname || 'Member' };
            const existingPreviews = (gData.memberPreviews || []) as PreviewItem[];
            const updatedPreviews = [newMemberPreview, ...existingPreviews.filter((p) => p.uid !== uid)].slice(0, 15);

            const memberData: GroupMemberDocument = {
                uid,
                nickname: userData.nickname || 'Member',
                photoURL: userData.photoURL || '',
                joinedAt: admin.firestore.FieldValue.serverTimestamp() as unknown as FirestoreTimestamp,
                lastActiveAt: admin.firestore.FieldValue.serverTimestamp() as unknown as FirestoreTimestamp,
                kickThreshold: userData.kickThreshold || 3,
                lastReadAt: admin.firestore.FieldValue.serverTimestamp() as unknown as FirestoreTimestamp,
                readMessageCount: totalMessages
            };

            // 3. START WRITES (Execution Phase)
            transaction.update(groupRef, {
                members: admin.firestore.FieldValue.arrayUnion(uid),
                membersCount: admin.firestore.FieldValue.increment(1),
                memberPreviews: updatedPreviews,
                lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
                lastMessageByNickname: userData.nickname || 'Member',
                lastMessageByUid: uid
            });

            const memberRef = groupRef.collection('members').doc(uid);
            transaction.set(memberRef, memberData);

            const userGS = userRef.collection('groupStates').doc(gid);
            transaction.set(userGS, {
                readMessageCount: totalMessages,
                lastReadAt: admin.firestore.FieldValue.serverTimestamp(),
                lastActiveAt: admin.firestore.FieldValue.serverTimestamp()
            });

            transaction.update(userRef, {
                groupIds: admin.firestore.FieldValue.arrayUnion(gid),
                groupId: gid
            });

            const msgRef = groupRef.collection('messages').doc();
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
                    const updatePayload: admin.firestore.UpdateData<GroupDocument> = {
                        ownerUserId: updatedMembers[0],
                        members: updatedMembers,
                        membersCount: admin.firestore.FieldValue.increment(-1),
                        memberPreviews: updatedPreviews
                    };

                    // TRUTH: If they already contributed to unity today, remove them to keep percentage honest
                    if (gData.dailyActivity?.activeMembers?.includes(uid)) {
                        updatePayload['dailyActivity.activeMembers'] = admin.firestore.FieldValue.arrayRemove(uid);
                    }

                    transaction.update(groupRef, updatePayload);
                } else {
                    transaction.delete(groupRef);
                }
            } else {
                    const updatePayload: admin.firestore.UpdateData<GroupDocument> = {
                        members: updatedMembers,
                        membersCount: admin.firestore.FieldValue.increment(-1),
                        memberPreviews: updatedPreviews
                    };

                    // TRUTH: Keep unity percentage accurate after member removal
                    if (gData.dailyActivity?.activeMembers?.includes(uid)) {
                        updatePayload['dailyActivity.activeMembers'] = admin.firestore.FieldValue.arrayRemove(uid);
                    }

                    transaction.update(groupRef, updatePayload);
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

            const userUpdate: Record<string, admin.firestore.FieldValue | string | number | boolean | string[] | object | undefined> = {
                groupIds: admin.firestore.FieldValue.arrayRemove(groupId)
            };
            
            // TRUTH: If the user was using this group as their "active" group, clear the legacy field
            if (uData.groupId === groupId) {
                userUpdate.groupId = admin.firestore.FieldValue.delete();
            }

            transaction.update(userRef, userUpdate);

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

        // TRUTH RECOVERY: Use the archive-aware recount method instead of simple aggregation.
        // This heals the user's view if the counter was previously corrupted or reset by archive deletes.
        const totalMessages = await CounterService.recountMessageCountWithArchive(groupRef);


        const batch = db.batch();
        batch.set(userRef.collection('groupStates').doc(groupId), {
            readMessageCount: totalMessages, 
            lastReadAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // TRUTH: Restore updating the main 'groups' document map for immediate UI sync.
        // For habit groups (<20 members), hotspots are rare, and immediate feedback is priority.
        batch.update(groupRef, {
            messageCount: totalMessages,
            [`memberLastReadAt.${uid}`]: admin.firestore.FieldValue.serverTimestamp()
        });

        // Secondary TRUTH: Update the member's private document for deep history/archiving.
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

        await userRef.update({ 
            kickThreshold: threshold,
            hasSetKickThreshold: true
        });

        if (groupIds.length > 0) {
            let batch = db.batch();
            groupIds.forEach((gid: string) => {
                const gRef = db.collection('groups').doc(gid);
                
                // Update the new scalable subcollection
                batch.set(gRef.collection('members').doc(uid), {
                    kickThreshold: threshold
                }, { merge: true });
                
                // Also update the legacy map for backward compatibility in dashboards
                batch.update(gRef, {
                    [`memberKickThresholds.${uid}`]: threshold
                });
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
        const userRefs = members.map((mUid: string) => db.collection('users').doc(mUid));
        
        // TRUTH: Process user updates in chunks of 200 to stay within Firestore's 500-write limit.
        // Each user needs 2 writes (UserDoc update + groupState delete).
        const CHUNK_SIZE = 200;
        for (let i = 0; i < userRefs.length; i += CHUNK_SIZE) {
            const batch = db.batch();
            const chunkRefs = userRefs.slice(i, i + CHUNK_SIZE);
            const userDocs = await db.getAll(...chunkRefs);

            userDocs.forEach((userDoc) => {
                if (!userDoc.exists) return;
                const uRef = userDoc.ref;
                const userData = userDoc.data()! as UserDocument;
                const updatePayload: admin.firestore.UpdateData<UserDocument> = {
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
        }

        // Final cleanup of the group and its subcollections
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

        await groupRef.update(updatePayload as admin.firestore.UpdateData<GroupDocument>);
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

/**
 * Helper to generate a unique 6-character alphanumeric invite code.
 */
async function generateUniqueInviteCode(): Promise<string> {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars O, 0, I, 1
    const groupsRef = db.collection('groups');
    let code = '';
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
        code = '';
        for (let i = 0; i < 6; i++) {
            code += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        const existing = await groupsRef.where('inviteCode', '==', code).get();
        if (existing.empty) {
            isUnique = true;
        }
        attempts++;
    }
    return code;
}

/**
 * Generate/Refresh Invite Code
 */
router.post('/regenerate-invite-code', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    const validation = regenerateInviteCodeSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });

    const { groupId, expiryDays = 7 } = validation.data;
    const uid = req.user!.uid;

    try {
        const groupRef = db.collection('groups').doc(groupId);
        const groupSnap = await groupRef.get();

        if (!groupSnap.exists) return res.status(404).json({ error: 'Group not found' });
        const gData = groupSnap.data()! as GroupDocument;
        if (gData.ownerUserId !== uid) return res.status(403).json({ error: 'Only owner can regenerate codes' });

        const inviteCode = await generateUniqueInviteCode();
        const inviteCodeExpiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000));
        
        await groupRef.update({ 
            inviteCode, 
            inviteCodeExpiresAt
        });

        res.status(200).json({ success: true, inviteCode, expiresAt: inviteCodeExpiresAt.toDate().toISOString() });
    } catch (err) {
        console.error('Error regenerating invite code:', err);
        res.status(500).json({ error: 'Failed to generate invite code' });
    }
});

// Fetch Public Groups
router.get('/groups', async (_req: Request, res: Response) => {
    try {
        const snapshot = await db.collection('groups')
            .where('isPublic', '==', true)
            .orderBy('lastMessageAt', 'desc')
            .limit(100)
            .get();

        const groups = snapshot.docs.map(doc => {
            const data = doc.data() as GroupDocument;
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

        res.json(groups);
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error('Error fetching groups:', error.message);
        }
        res.status(500).json({ error: 'Search failed' });
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

        const langQuery = (req.query.lang as string) || 'en';
        const translation = groupData.translations?.[langQuery] || groupData.translations?.['en'];

        res.json({
            name: translation?.name || groupData.name,
            description: translation?.description || groupData.description,
            membersCount: (groupData.members || []).length,
            isPrivate: groupData.isPrivate || false
        });
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error('Group preview failed:', error.message);
        }
        res.status(500).send('Fetch failed');
    }
});

export default router;
