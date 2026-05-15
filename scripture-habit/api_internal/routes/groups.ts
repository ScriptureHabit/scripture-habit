import express, { Request, Response } from 'express';
import { admin, db } from '../lib/firebase-admin.js';
import { verifyAppCheck, authenticate, requireEmailVerified, AuthenticatedRequest } from '../lib/middleware.js';
import { joinGroupSchema, updateKickThresholdSchema, leaveGroupSchema, deleteGroupSchema, updateReadStatusSchema, announceUnitySchema, updateGroupSchema, regenerateInviteCodeSchema, kickMemberSchema, createGroupSchema } from '../lib/schemas.js';
import { GroupDocument, UserDocument, MemberPreview as PreviewItem, GroupMemberDocument } from '../../types/firestore.js';
import { MAX_GROUPS_PER_USER } from '../lib/constants.js';
import { CounterService } from '../services/counter-service.js';
import { removeMemberFromGroup } from '../lib/membership-utils.js';


const router = express.Router();

/**
 * Create Group
 * Enforces MAX_GROUPS_PER_USER on the server to prevent bypasses.
 */
router.post('/create-group', authenticate, requireEmailVerified, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    const validation = createGroupSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });
    }

    const { name, description, isPublic, timeZone } = validation.data;
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const result = await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(uid);
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) throw new Error('User not found.');
            const userData = userDoc.data()! as UserDocument;

            // 1. Enforce group limit
            const currentGroupIds = userData.groupIds || [];
            if (currentGroupIds.length >= MAX_GROUPS_PER_USER) {
                throw new Error(`You have reached the maximum limit of ${MAX_GROUPS_PER_USER} groups. Please leave or delete an existing group before creating a new one.`);
            }

            // 2. Prepare Data
            const now = admin.firestore.Timestamp.now();
            const expiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1000); // 7 days default
            const inviteCode = await generateUniqueInviteCode(transaction);

            const userNick = userData.nickname || 'Owner';
            const groupRef = db.collection('groups').doc();
            const newGroupId = groupRef.id;

            const newGroupData: GroupDocument = {
                name,
                description: description || '',
                createdAt: now,
                groupStreak: 0,
                inviteCode,
                inviteCodeExpiresAt: expiresAt,
                isPublic: isPublic || false,
                isPrivate: !isPublic, // Legacy field
                maxMembers: 100000,
                membersCount: 1,
                memberPreviews: [{ uid, nickname: userNick }],
                messageCount: 0,
                noteCount: 0,
                ownerUserId: uid,
                members: [uid],
                memberJoinedAt: { [uid]: now },
                memberKickThresholds: { [uid]: userData.kickThreshold || 3 },
                timeZone: timeZone || 'Asia/Tokyo',
                lastInactivityCheckedAt: now,
                lastMessageAt: now,
                lastMessageByNickname: userNick,
                lastMessageByUid: uid
            };

            const memberData: admin.firestore.WithFieldValue<GroupMemberDocument> = {
                uid,
                nickname: userNick,
                photoURL: userData.photoURL || '',
                joinedAt: now,
                lastActiveAt: now,
                lastReadAt: now,
                kickThreshold: userData.kickThreshold || 3,
                readMessageCount: 0
            };

            // 3. Execution Phase
            console.error(`[Groups] Creating group ${newGroupId} with data: ${JSON.stringify(newGroupData)}`);
            transaction.set(groupRef, newGroupData);
            transaction.set(groupRef.collection('members').doc(uid), memberData);

            transaction.set(userRef.collection('groupStates').doc(newGroupId), {
                readMessageCount: 0,
                lastReadAt: now,
                lastActiveAt: now
            });

            transaction.update(userRef, {
                groupIds: admin.firestore.FieldValue.arrayUnion(newGroupId),
                groupId: newGroupId
            });

            const msgRef = groupRef.collection('messages').doc();
            transaction.set(msgRef, {
                text: `🎨 **${userNick}** created the group! Welcome!`,
                createdAt: now,
                senderId: 'system',
                isSystemMessage: true,
                type: 'system',
                messageType: 'system'
            });

            return { groupId: newGroupId, inviteCode };
        });

        res.status(200).json({ message: 'Success', ...result });
    } catch (error) {
        let message = 'Internal Server Error';
        if (error instanceof Error) {
            message = error.message;
            console.error('Error creating group:', error.message);
        }
        res.status(400).json({ error: message });
    }
});


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
            const groupDoc = await transaction.get(groupRef);
            const userDoc = await transaction.get(userRef);
            const totalMessages = await CounterService.getCountInTransaction(transaction, groupRef, 'messageCount');

            if (!groupDoc.exists) throw new Error('Group not found.');
            if (!userDoc.exists) throw new Error('User not found.');

            const gid = groupDoc.id;
            const gData = groupDoc.data()! as GroupDocument;
            const userData = userDoc.data()! as UserDocument;

            const members = gData.members || [];
            const maxMembers = gData.maxMembers || 500;

            // 1. Validation Phase
            if (gData.isPrivate === true || gData.isPublic === false) {
                if (inviteCode) {
                    if (gData.inviteCode !== inviteCode) {
                        throw new Error('Invalid or expired invite code.');
                    }
                    if (gData.inviteCodeExpiresAt) {
                        const ts = gData.inviteCodeExpiresAt;
                        const expiresAt = (ts && typeof ts === 'object' && 'toDate' in ts && typeof ts.toDate === 'function')
                            ? ts.toDate()
                            : new Date(ts as string | number | Date);

                        if (expiresAt < new Date()) {
                            throw new Error('This invite link has expired. Please ask the group owner for a new one.');
                        }
                    }
                } else if (!gData.isPublic) {
                    throw new Error('This is a private group. You need an invite code to join.');
                }
            }

            if (members.includes(uid)) throw new Error('You are already a member of this group.');
            if (members.length >= maxMembers) {
                throw new Error('This group is full.');
            }

            const userGroupIds = userData.groupIds || [];
            if (userGroupIds.length >= MAX_GROUPS_PER_USER) {
                throw new Error(`You can only join up to ${MAX_GROUPS_PER_USER} groups. Please leave one before joining another.`);
            }

            // 2. Prepare Data
            const updatedMembers = [...members, uid];
            const newMemberPreview = { uid, nickname: userData.nickname || 'Member' };
            const existingPreviews = (gData.memberPreviews || []) as PreviewItem[];
            const updatedPreviews = [newMemberPreview, ...existingPreviews.filter((p) => p.uid !== uid)].slice(0, 15);

            const memberData: admin.firestore.WithFieldValue<GroupMemberDocument> = {
                uid,
                nickname: userData.nickname || 'Member',
                photoURL: userData.photoURL || '',
                joinedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
                kickThreshold: userData.kickThreshold || 3,
                lastReadAt: admin.firestore.FieldValue.serverTimestamp(),
                readMessageCount: totalMessages
            };

            // 3. START WRITES (Execution Phase)
            transaction.update(groupRef, {
                members: updatedMembers,
                membersCount: updatedMembers.length,
                memberPreviews: updatedPreviews,
                [`memberJoinedAt.${uid}`]: admin.firestore.FieldValue.serverTimestamp(),
                [`memberKickThresholds.${uid}`]: userData.kickThreshold || 3,
                lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
                lastMessageByNickname: userData.nickname || 'Member',
                lastMessageByUid: uid,
                lastInactivityCheckedAt: admin.firestore.FieldValue.serverTimestamp()
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
                type: 'join',
                messageType: 'join'
            });

            // IMPORTANT: Increment message counter for the join message
            CounterService.increment(transaction, groupRef, 'messageCount', 1);

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

            // Use centralized utility for the heavy lifting
            await removeMemberFromGroup(transaction, groupId, uid, {
                removeFromUserDoc: true,
                clearUserGroupId: true,
                removeGroupState: true,
                transferOwnership: true,
                preferredLanguage: uData.language || 'en',
                systemMessage: {
                    type: 'leave',
                    nickname: uData.nickname || 'Someone'
                }
            });

            return { success: true };
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
            lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
            readMessageCount: totalMessages
        }, { merge: true });

        console.log(`[API] Updating read status: uid=${uid}, groupId=${groupId}, readCount=${totalMessages}`);
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

router.post('/kick-member', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    const validation = kickMemberSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: 'Invalid input' });

    const { groupId, targetUid } = validation.data;
    const uid = req.user!.uid;

    try {
        await db.runTransaction(async (transaction) => {
            const groupRef = db.collection('groups').doc(groupId);
            const userRef = db.collection('users').doc(targetUid);
            const [gSnap, uSnap] = await Promise.all([
                transaction.get(groupRef),
                transaction.get(userRef)
            ]);

            const gData = gSnap.data()! as GroupDocument;
            const uData = uSnap.data() as UserDocument | undefined;

            // 1. Validation: Only owner can kick
            if (gData.ownerUserId !== uid) {
                throw new Error('Forbidden: Only the group owner can kick members.');
            }

            // 2. Validation: Cannot kick yourself
            if (targetUid === uid) {
                throw new Error('You cannot kick yourself. Please use the leave group option if you wish to exit.');
            }

            // 3. Validation: Group/User existence
            if (!gSnap.exists) throw new Error('Group not found.');
            if (!uSnap.exists) throw new Error('Target user not found.');
            if (!uData) throw new Error('Target user data unavailable.');

            // 4. Validation: Must be a member
            if (!(gData.members || []).includes(targetUid)) {
                throw new Error('Target user is not a member of this group.');
            }

            // 4. USE CENTRALIZED UTILITY
            await removeMemberFromGroup(transaction, groupId, targetUid, {
                removeFromUserDoc: true,
                clearUserGroupId: true,
                removeGroupState: true,
                preferredLanguage: uData.language || 'en',
                systemMessage: {
                    type: 'kick',
                    nickname: uData.nickname || 'Someone'
                }
            });
        });

        res.json({ success: true });
    } catch (err) {
        let message = 'Kick failed';
        if (err instanceof Error) message = err.message;
        res.status(400).json({ error: message });
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

        // TRUTH: If the user is part of multiple groups, we need to handle the case where some might be deleted.
        // We fetch all group documents to verify their existence before batch updating.
        const existingGroupIds: string[] = [];
        const missingGroupIds: string[] = [];

        if (groupIds.length > 0) {
            const groupRefs = groupIds.map(gid => db.collection('groups').doc(gid));
            const groupSnaps = await db.getAll(...groupRefs);

            groupSnaps.forEach((snap, index) => {
                if (snap.exists) {
                    existingGroupIds.push(groupIds[index]);
                } else {
                    missingGroupIds.push(groupIds[index]);
                    console.warn(`[Cleanup] Found ghost group reference: ${groupIds[index]} for user ${uid}`);
                }
            });
        }

        const userUpdate: admin.firestore.UpdateData<UserDocument> = {
            kickThreshold: threshold,
            hasSetKickThreshold: true
        };

        // If we found ghost groups, clean them up from the user's record
        if (missingGroupIds.length > 0) {
            userUpdate.groupIds = admin.firestore.FieldValue.arrayRemove(...missingGroupIds);
            if (userData.groupId && missingGroupIds.includes(userData.groupId)) {
                userUpdate.groupId = admin.firestore.FieldValue.delete();
            }
        }

        await userRef.update(userUpdate);

        if (existingGroupIds.length > 0) {
            const batch = db.batch();
            existingGroupIds.forEach((gid: string) => {
                const gRef = db.collection('groups').doc(gid);

                // Update the new scalable subcollection
                batch.set(gRef.collection('members').doc(uid), {
                    kickThreshold: threshold
                }, { merge: true });

                // Also update the legacy map for backward compatibility in dashboards
                // This is safe because existingGroupIds only contains IDs that actually exist.
                batch.set(gRef, {
                    memberKickThresholds: {
                        [uid]: threshold
                    }
                }, { merge: true });
            });
            await batch.commit();
        }

        res.json({ success: true, cleanedUpGroups: missingGroupIds });
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

        if (!groupDoc.exists) return res.status(404).json({ error: 'Group not found' });
        const groupData = groupDoc.data()! as GroupDocument;

        if (groupData.ownerUserId !== uid) {
            return res.status(403).json({ error: 'Forbidden: Only owner can delete group' });
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

    const { groupId, name, description, isPublic, isPrivate, timeZone, translations } = validation.data;
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

        const updatePayload: Partial<GroupDocument> = {};
        if (name !== undefined) updatePayload.name = name;
        if (description !== undefined) updatePayload.description = description;
        if (isPublic !== undefined) updatePayload.isPublic = isPublic;
        if (isPrivate !== undefined) updatePayload.isPrivate = isPrivate;
        if (timeZone !== undefined) updatePayload.timeZone = timeZone;
        if (translations !== undefined) updatePayload.translations = translations as GroupDocument['translations'];

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
async function generateUniqueInviteCode(transaction?: admin.firestore.Transaction): Promise<string> {
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
        
        // Use the provided transaction if available, otherwise use regular get()
        let existing;
        if (transaction) {
            existing = await transaction.get(groupsRef.where('inviteCode', '==', code).limit(1));
        } else {
            existing = await groupsRef.where('inviteCode', '==', code).limit(1).get();
        }
        
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
        const { inviteCode, inviteCodeExpiresAt } = await db.runTransaction(async (transaction) => {
            const gSnap = await transaction.get(groupRef);
            if (!gSnap.exists) throw new Error('Group not found');
            const gData = gSnap.data()! as GroupDocument;
            if (gData.ownerUserId !== uid) throw new Error('Only owner can regenerate codes');

            const code = await generateUniqueInviteCode(transaction);
            const expires = admin.firestore.Timestamp.fromDate(new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000));

            transaction.update(groupRef, {
                inviteCode: code,
                inviteCodeExpiresAt: expires
            });
            
            return { inviteCode: code, inviteCodeExpiresAt: expires };
        });

        res.status(200).json({ success: true, inviteCode, expiresAt: inviteCodeExpiresAt.toDate().toISOString() });
    } catch (err) {
        console.error('Error regenerating invite code:', err);
        res.status(500).json({ error: 'Failed to generate invite code' });
    }
});

// Fetch Public Groups
router.get('/', async (req: Request, res: Response) => {
    try {
        const limitAmount = Math.min(parseInt(req.query.limit as string) || 20, 100);
        const lastId = req.query.lastId as string;

        let query = db.collection('groups')
            .where('isPublic', '==', true)
            .orderBy('lastMessageAt', 'desc')
            .orderBy('name', 'desc')
            .orderBy(admin.firestore.FieldPath.documentId(), 'desc');

        if (lastId) {
            // ALWAYS fetch the doc if lastId is provided for 100% reliable pagination
            const lastDoc = await db.collection('groups').doc(lastId).get();
            if (lastDoc.exists) {
                // Using the document snapshot directly is the most reliable way to handle composite cursors
                query = query.startAfter(lastDoc);
            }
        }

        const snapshot = await query.limit(limitAmount).get();

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
                lastNoteAt: data.lastNoteAt ? (data.lastNoteAt as admin.firestore.Timestamp).toDate().toISOString() : null,
                lastMessageAt: data.lastMessageAt ? (data.lastMessageAt as admin.firestore.Timestamp).toDate().toISOString() : null,
                isPublic: true,
                createdAt: data.createdAt ? (data.createdAt as admin.firestore.Timestamp).toDate().toISOString() : null,
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

        const language = (req.query.language as string) || (req.query.lang as string) || 'en';
        const translation = groupData.translations?.[language] || groupData.translations?.['en'];

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
