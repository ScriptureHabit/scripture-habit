import express, { Request, Response, NextFunction } from 'express';
import { admin, db } from '../lib/firebase-admin.js';
import { CounterService } from '../services/counter-service.js';
import { ArchiveService } from '../services/archive-service.js';
import { getUserFcmTokens, sendPushNotification, cleanupTokens } from '../lib/notifications.js';
import { t } from '../lib/i18n.js';
import { calculateMemberStatus, InactivityMemberData, InactivityGroupData } from '../lib/inactivity-utils.js';
import { getGroupUpdatesForMultipleRemovals } from '../lib/membership-utils.js';
import { UserDocument } from '../../types/firestore.js';

interface CronReport {
    groupId: string;
    groupName?: string;
    totalMembers: number;
    ownerUserId?: string;
    checkTime: string;
    members: CronMemberInfo[];
}

interface CronMemberInfo {
    memberId: string;
    isOwner: boolean;
    threshold: number;
    status: string;
    action: string;
    lastActive?: string;
    daysSinceActive?: number;
    reason?: string;
}

const router = express.Router();

/**
 * Middleware to check CRON_SECRET
 */
const verifyCronSecret = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.header('Authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        console.warn('Unauthorized access attempt to Cron endpoint');
        return res.status(401).send('Unauthorized');
    }
    next();
};

/**
 * Check Inactive Users
 */
router.all('/check-inactive-users', verifyCronSecret, async (_req: Request, res: Response) => {
    console.log('Starting inactivity check...');
    try {
        const groupsRef = db.collection('groups');
        // Optimization: Only check groups that were NOT checked in the last 6 hours
        // Step 1: Rotation - Fetch groups that haven't been checked in the longest time.
        // NOTE: This skips groups where the field is missing (new groups).
        // Step 1: Rotation - Fetch groups that haven't been checked in the longest time.
        // NOTE: Standard orderBy skips groups where the field is missing.
        const staleGroupsSnap = await groupsRef
            .orderBy('lastInactivityCheckedAt', 'asc')
            .limit(100)
            .get();

        // Step 2: "The Net" - Catch new groups that don't have the field yet.
        // We use a separate query because orderBy excludes missing fields.
        const newGroupsSnap = await groupsRef
            .where('lastInactivityCheckedAt', '==', null)
            .limit(50)
            .get();

        const list = [...staleGroupsSnap.docs];
        const seenIds = new Set(list.map(d => d.id));
        
        // Add new groups if not already in list
        newGroupsSnap.docs.forEach(doc => {
            if (!seenIds.has(doc.id)) {
                list.push(doc);
                seenIds.add(doc.id);
            }
        });

        // Step 3: Emergency Fallback - If we still have very few groups, just grab some.
        if (list.length < 50) {
            const fallbackSnap = await groupsRef.limit(50).get();
            fallbackSnap.docs.forEach(doc => {
                if (!seenIds.has(doc.id)) {
                    list.push(doc);
                    seenIds.add(doc.id);
                }
            });
        }

        let processedCount = 0;
        let removedCount = 0;
        let transferCount = 0;
        let deletedGroupCount = 0;
        let initializedCount = 0;

        let batch = db.batch();
        let batchOpCount = 0;

        const now = new Date();

        for (const docSnapshot of list) {
            const groupData = docSnapshot.data();
            const groupId = docSnapshot.id;
            let ownerUserId: string = groupData.ownerUserId;

            const membersSnap = await docSnapshot.ref.collection('members').get();
            if (membersSnap.empty || groupData.isDeleted === true) {
                // TRUTH: Safe cleanup of groups with no members or marked for deletion.
                // Since this happens outside the transaction loop of membership removal,
                // it's the perfect place for Ghost Busting (recursiveDelete).
                try {
                    console.log(`[GhostBuster] Purging group ${groupId} (isDeleted: ${groupData.isDeleted}, empty: ${membersSnap.empty})`);
                    await db.recursiveDelete(docSnapshot.ref);
                    deletedGroupCount++;
                } catch (err) {
                    console.error(`[GhostBuster] Failed to purge group ${groupId}:`, err);
                    // Fallback: move on in rotation so we don't get stuck
                    batch.update(docSnapshot.ref, { lastInactivityCheckedAt: admin.firestore.FieldValue.serverTimestamp() });
                    batchOpCount++;
                }
                continue;
            }

            let groupChanged = false;
            const groupUpdates: Record<string, admin.firestore.FieldValue | string | number | boolean | string[] | object | undefined | null> = {
                lastInactivityCheckedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            let isGroupDeleted = false;

            const activeMembers: string[] = [];
            const inactiveMembers: string[] = [];
            const membersToInitialize: string[] = [];

            const processedMemberIds = new Set<string>();

            membersSnap.forEach(memberDoc => {
                const memberData = memberDoc.data() as InactivityMemberData;
                const memberId = memberDoc.id;
                processedMemberIds.add(memberId);

                const result = calculateMemberStatus(memberId, memberData, groupData as InactivityGroupData, now);

                if (result.status === 'needs_initialization') {
                    // GHOST BUSTER: If truly no activity exists anywhere, we initialize joinedAt now.
                    batch.update(memberDoc.ref, { joinedAt: admin.firestore.FieldValue.serverTimestamp() });
                    batchOpCount++;
                    activeMembers.push(memberId);
                    initializedCount++;
                } else if (result.status === 'inactive') {
                    inactiveMembers.push(memberId);
                } else {
                    activeMembers.push(memberId);
                }
            });

            // GHOST CLEANUP: Identify UIDs in the members array or activity maps that were NOT in the subcollection.
            // These are orphaned and should be removed immediately.
            const groupMemberIds = groupData.members || [];
            
            // Comprehensive map check across all activity/config maps
            const mapsToCheck = [
                groupData.memberLastActive,
                groupData.memberLastReadAt,
                groupData.memberKickThresholds,
                groupData.memberJoinedAt // Preserved for frontend Unity calculation, but checked for orphaned UIDs
            ];

            for (const map of mapsToCheck) {
                if (!map) continue;
                for (const uid in map) {
                    if (!processedMemberIds.has(uid) && !inactiveMembers.includes(uid)) {
                        inactiveMembers.push(uid);
                    }
                }
            }

            for (const uid of groupMemberIds) {
                if (!processedMemberIds.has(uid)) {
                    if (!inactiveMembers.includes(uid)) inactiveMembers.push(uid);
                }
            }

            const allMemberIds = membersSnap.docs.map(d => d.id);

            // Check if Owner is Inactive
            if (inactiveMembers.includes(ownerUserId)) {
                if (activeMembers.length > 0) {
                    const newOwnerId = activeMembers[0];
                    groupUpdates['ownerUserId'] = newOwnerId;
                    ownerUserId = newOwnerId;
                    groupChanged = true;
                    transferCount++;

                    const transferMsgRef = groupsRef.doc(groupId).collection('messages').doc();

                    // Localization: Use the new owner's language for the transfer message
                    let transferLang = 'en';
                    try {
                        const newOwnerUserDoc = await db.collection('users').doc(newOwnerId).get();
                        transferLang = (newOwnerUserDoc.data() as UserDocument)?.language || 'en';
                    } catch (err) {
                        console.error(`Failed to fetch lang for new owner ${newOwnerId}:`, err);
                    }

                    batch.set(transferMsgRef, {
                        text: t(transferLang, 'notifications.ownership_transferred'),
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        senderId: 'system',
                        isSystemMessage: true,
                        type: 'system',
                        messageType: 'system'
                    });
                    batchOpCount++;
                } else {
                    // TRUTH: Before deleting the group, we MUST clean up all member references 
                    // to prevent "stuck" users in non-existent groups.
                    for (const uid of allMemberIds) {
                        const userRef = db.collection('users').doc(uid);
                        batch.update(userRef, {
                            groupIds: admin.firestore.FieldValue.arrayRemove(groupId),
                            // If this was their primary group, clear it
                            groupId: admin.firestore.FieldValue.delete()
                        });
                        batch.delete(userRef.collection('groupStates').doc(groupId));
                        batchOpCount += 2;
                    }

                    // Commit user cleanup BEFORE the recursive delete to ensure safety
                    if (batchOpCount > 0) {
                        try {
                            await batch.commit();
                        } catch (err) {
                            console.error(`Failed to commit pre-delete batch for group ${groupId}:`, err);
                        }
                        batch = db.batch();
                        batchOpCount = 0;
                    }

                    try {
                        await db.recursiveDelete(groupsRef.doc(groupId));
                        deletedGroupCount++;
                        isGroupDeleted = true;
                    } catch (err) {
                        console.error(`CRITICAL: Recursive delete failed for group ${groupId}:`, err);
                    }
                }
            }

            if (isGroupDeleted) {
                processedCount++;
                if (batchOpCount > 400) { await batch.commit(); batch = db.batch(); batchOpCount = 0; }
                continue;
            }

            if (membersToInitialize.length > 0) {
                membersToInitialize.forEach(uid => { groupUpdates[`memberLastActive.${uid}`] = admin.firestore.FieldValue.serverTimestamp(); });
                groupChanged = true;
                initializedCount += membersToInitialize.length;
            }

            const finalMembersToRemove = inactiveMembers.filter(uid => uid !== ownerUserId);
            if (finalMembersToRemove.length > 0) {
                // TRUTH: Use the standardized bulk removal logic to ensure all maps and arrays are in sync
                const bulkRemovalUpdates = getGroupUpdatesForMultipleRemovals(groupData, finalMembersToRemove);
                Object.assign(groupUpdates, bulkRemovalUpdates);
                
                groupChanged = true;
                removedCount += finalMembersToRemove.length;

                const messageRef = groupsRef.doc(groupId).collection('messages').doc();

                // Localization: Use the current owner's language for the removal message
                let removalLang = 'en';
                try {
                    const ownerUserDoc = await db.collection('users').doc(ownerUserId).get();
                    removalLang = ownerUserDoc.data()?.language || 'en';
                } catch (err) {
                    console.error(`Failed to fetch language for owner ${ownerUserId} for removal message:`, err);
                }

                batch.set(messageRef, {
                    text: t(removalLang, 'notifications.members_removed', { count: finalMembersToRemove.length }),
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    senderId: 'system',
                    isSystemMessage: true,
                    type: 'leave',
                    messageType: 'leave'
                });
                batchOpCount++;

                for (const uid of finalMembersToRemove) {
                    const userRef = db.collection('users').doc(uid);
                    batch.update(userRef, { 
                        groupIds: admin.firestore.FieldValue.arrayRemove(groupId),
                        // Also clear primary groupId if it matches (logic consistency)
                        groupId: admin.firestore.FieldValue.delete() 
                    });
                    batch.delete(userRef.collection('groupStates').doc(groupId));

                    // Cleanup the member subcollection document (Ghost Buster)
                    batch.delete(groupsRef.doc(groupId).collection('members').doc(uid));

                    batchOpCount += 3;
                    if (batchOpCount > 400) {
                        await batch.commit();
                        batch = db.batch();
                        batchOpCount = 0;
                    }

                    // Send localized kick notification
                    getUserFcmTokens(uid).then(async tokens => {
                        if (tokens.length > 0) {
                            const uSnap = await db.collection('users').doc(uid).get();
                            const uData = uSnap.data();
                            const lang = uData?.language || 'en';

                            const title = t(lang, 'notifications.kick_title');
                            const body = t(lang, 'notifications.kick_body', { groupName: groupData.name || 'Group' });

                            const result = await sendPushNotification(tokens, {
                                title,
                                body,
                                data: { type: 'kick', groupId }
                            });

                            if (result.failedTokens.length > 0) {
                                await cleanupTokens(uid, result.failedTokens);
                            }
                        }
                    }).catch(err => console.error(`Failed to send kick notification to ${uid}:`, err));
                }
            }

            if (groupChanged) {
                batch.update(groupsRef.doc(groupId), groupUpdates);
                batchOpCount++;
            }

            if (batchOpCount > 400) { await batch.commit(); batch = db.batch(); batchOpCount = 0; }
            processedCount++;
        }

        if (batchOpCount > 0) await batch.commit();

        res.json({
            message: 'Inactivity check complete.',
            stats: { processedGroups: processedCount, removedUsers: removedCount, initializedTracking: initializedCount, transferredOwnerships: transferCount, deletedGroups: deletedGroupCount }
        });
    } catch (err: unknown) {
        const error = err as Error;
        console.error('Error in inactivity check:', error);
        res.status(500).send('Error checking inactivity: ' + error.message);
    }
});


/**
 * Manual Test Endpoint
 */
router.get('/test-inactive-check/:groupId', verifyCronSecret, async (req: Request, res: Response) => {
    const groupId = req.params.groupId as string;
    try {
        const groupRef = db.collection('groups').doc(groupId);
        const groupDoc = await groupRef.get();
        if (!groupDoc.exists) return res.status(404).json({ error: 'Not Found' });

        const groupData = groupDoc.data() || {};
        const members: string[] = groupData.members || [];
        const ownerUserId = groupData.ownerUserId;
        const now = new Date();
        const groupName = groupData.name || '';
        const report: CronReport = { groupId, groupName, totalMembers: members.length, ownerUserId, checkTime: now.toISOString(), members: [] };
        
        const membersSnap = await groupRef.collection('members').get();
        const processedMemberIds = new Set<string>();

        // Check members in subcollection
        membersSnap.forEach(memberDoc => {
            const memberId = memberDoc.id;
            const memberData = memberDoc.data() as InactivityMemberData;
            processedMemberIds.add(memberId);
            
            const result = calculateMemberStatus(memberId, memberData, groupData as InactivityGroupData, now);
            
            const info: CronMemberInfo = { 
                memberId, 
                isOwner: memberId === ownerUserId, 
                threshold: Math.floor(result.thresholdMs / (24 * 60 * 60 * 1000)), 
                status: '', 
                action: '',
                reason: result.reason
            };

            if (result.status === 'needs_initialization') {
                info.status = 'Ghost (No activity data)';
                info.action = 'would initialize joinedAt';
            } else {
                info.lastActive = result.lastActiveTime > 0 ? new Date(result.lastActiveTime).toISOString() : undefined;
                info.daysSinceActive = result.lastActiveTime > 0 ? Math.floor(result.diffMs / (24 * 60 * 60 * 1000)) : undefined;
                info.status = result.status === 'inactive' ? '⚠️ Inactive' : '✅ Active';
                info.action = result.status === 'inactive' ? 'would remove' : 'keep';
            }
            report.members.push(info);
        });

        // Check for Ghost members (in array but not in subcollection)
        for (const memberId of members) {
            if (!processedMemberIds.has(memberId)) {
                report.members.push({
                    memberId,
                    isOwner: memberId === ownerUserId,
                    threshold: 0,
                    status: '👻 GHOST (Missing member document)',
                    action: 'REMOVE'
                });
            }
        }

        res.json(report);
    } catch (err: unknown) {
        const error = err as Error;
        res.status(500).json({ error: error.message });
    }
});

/**
 * Archive Old Messages (Bucket Pattern)
 */
router.all('/archive-old-messages', verifyCronSecret, async (_req: Request, res: Response) => {
    console.log('[Cron] Starting message archiving...');
    try {
        const groupsToArchive = await ArchiveService.getGroupsNeedingArchive(150);
        let groupsProcessed = 0;
        let totalMessagesArchived = 0;

        for (const groupId of groupsToArchive) {
            try {
                const count = await ArchiveService.archiveOldMessages(groupId);
                if (count > 0) {
                    groupsProcessed++;
                    totalMessagesArchived += count;
                }
            } catch (err) {
                console.error(`Failed to archive group ${groupId}:`, err);
            }
        }

        res.json({
            message: 'Archiving complete.',
            stats: {
                targetGroupsFound: groupsToArchive.length,
                groupsProcessed,
                totalMessagesArchived
            }
        });
    } catch (err: unknown) {
        const error = err as Error;
        console.error('Error during archiving:', error);
        res.status(500).send('Error during archiving: ' + error.message);
    }
});

/**
 * Aggregate Message Counts (Background Sync)
 */
router.all('/aggregate-message-counts', verifyCronSecret, async (_req: Request, res: Response) => {
    console.log('[Cron] Starting message count aggregation...');
    try {
        const now = new Date();
        const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // 1. Groups active in the last 10 minutes (priority)
        const activeGroupsSnap = await db.collection('groups')
            .where('lastMessageAt', '>=', tenMinutesAgo)
            .get();

        // 2. Groups that haven't been synced in > 24 hours (cleanup)
        const staleGroupsSnap = await db.collection('groups')
            .where('messageCount_syncedAt', '<', twentyFourHoursAgo)
            .limit(50)
            .get();

        const allDocs = [...activeGroupsSnap.docs];
        // Deduplicate
        const seenIds = new Set(allDocs.map(d => d.id));
        staleGroupsSnap.docs.forEach(doc => {
            if (!seenIds.has(doc.id)) allDocs.push(doc);
        });

        let updatedCount = 0;

        // 1. Priority Sync (Fast Shard Hum)
        for (const groupDoc of activeGroupsSnap.docs) {
            try {
                await CounterService.aggregateAndSync(groupDoc.ref, 'messageCount');
                await CounterService.aggregateAndSync(groupDoc.ref, 'noteCount');
                updatedCount++;
            } catch (err) {
                console.error(`Priority aggregation failed for group ${groupDoc.id}:`, err);
            }
        }

        // 2. SUPREME TRUTH Sync (Document counting for stale groups)
        for (const groupDoc of staleGroupsSnap.docs) {
            // Already handled if in activeGroups
            if (seenIds.has(groupDoc.id)) continue;

            try {
                // TRUTH: Physical recount for notes, and archive-aware recount for messages.
                await CounterService.recountAndSync(groupDoc.ref, 'notes', 'noteCount');
                await CounterService.recountMessageCountWithArchive(groupDoc.ref);
                updatedCount++;
            } catch (err) {
                console.error(`Maintenance sync failed for group ${groupDoc.id}:`, err);
            }
        }

        res.json({
            message: 'Aggregation complete.',
            stats: {
                totalGroupsHandled: activeGroupsSnap.size + staleGroupsSnap.size,
                groupsUpdated: updatedCount
            }
        });
    } catch (err: unknown) {
        const error = err as Error;
        console.error('Error in aggregation:', error);
        res.status(500).send('Error during aggregation: ' + error.message);
    }
});

/**
 * Sync User Stats (totalNotes, etc.)
 */
router.all('/sync-user-stats', verifyCronSecret, async (_req: Request, res: Response) => {
    console.log('[Cron] Starting user stats sync...');
    try {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // Target users who have been active in the last 24 hours
        const activeUsersSnap = await db.collection('users')
            .where('lastPostAt', '>=', oneDayAgo)
            .limit(100)
            .get();

        let updatedCount = 0;
        let batch = db.batch();
        let batchOpCount = 0;

        for (const userDoc of activeUsersSnap.docs) {
            const userId = userDoc.id;
            const [notesSnap, cheersSnap] = await Promise.all([
                userDoc.ref.collection('notes').get(),
                db.collection('cheers').where('targetUid', '==', userId).get()
            ]);
            
            const actualCount = notesSnap.size;
            const actualCheers = cheersSnap.size;

            const userData = userDoc.data();
            const groupIds: string[] = userData.groupIds || [];
            const validGroupIds: string[] = [];
            let profileChanged = false;

            // 1. Verify Note Count Truth
            if (actualCount !== (userData.totalNotes || 0)) {
                profileChanged = true;
            }

            // 2. Verify Cheers Count Truth
            if (actualCheers !== (userData.cheersReceived || 0)) {
                profileChanged = true;
            }

            // 3. Verify Membership Truth (Prune Orphans)
            for (const gid of groupIds) {
                const memberSnap = await db.collection('groups').doc(gid).collection('members').doc(userId).get();
                if (memberSnap.exists) {
                    validGroupIds.push(gid);
                } else {
                    profileChanged = true;
                    // Individual cleanup for the orphan association
                    batch.delete(userDoc.ref.collection('groupStates').doc(gid));
                }
            }

            if (profileChanged) {
                batch.update(userDoc.ref, {
                    totalNotes: actualCount,
                    cheersReceived: actualCheers,
                    groupIds: validGroupIds
                });
                batchOpCount++;
                updatedCount++;
            }

            if (batchOpCount > 400) {
                await batch.commit();
                batch = db.batch();
                batchOpCount = 0;
            }
        }

        if (batchOpCount > 0) await batch.commit();

        res.json({
            message: 'User stats sync complete.',
            stats: { usersProcessed: activeUsersSnap.size, usersUpdated: updatedCount }
        });
    } catch (err: unknown) {
        const error = err as Error;
        console.error('Error in user stats sync:', error);
        res.status(500).send('Error: ' + error.message);
    }
});

/**
 * Cleanup Orphaned Cheers (Ghost Buster)
 */
router.all('/cleanup-orphaned-cheers', verifyCronSecret, async (_req: Request, res: Response) => {
    console.log('[Cron] Starting cheers cleanup...');
    try {
        // Fetch a batch of cheers that haven't been checked recently or at all
        const cheersSnap = await db.collection('cheers')
            .orderBy('lastCheckedAt', 'asc')
            .limit(200)
            .get();

        if (cheersSnap.empty) {
            return res.json({ message: 'No cheers to check.' });
        }

        let deletedCount = 0;
        let checkedCount = 0;
        const batch = db.batch();

        // existence cache to reduce redundant lookups
        const groupExists = new Map<string, boolean>();
        const userExists = new Map<string, boolean>();

        for (const cheerDoc of cheersSnap.docs) {
            const data = cheerDoc.data();
            const { groupId, senderUid, targetUid } = data;
            
            let isOrphan = false;

            // 1. Check Group
            if (groupId) {
                if (!groupExists.has(groupId)) {
                    const gSnap = await db.collection('groups').doc(groupId).get();
                    groupExists.set(groupId, gSnap.exists);
                }
                if (!groupExists.get(groupId)) isOrphan = true;
            } else {
                isOrphan = true;
            }

            // 2. Check Users
            if (!isOrphan && senderUid) {
                if (!userExists.has(senderUid)) {
                    const uSnap = await db.collection('users').doc(senderUid).get();
                    userExists.set(senderUid, uSnap.exists);
                }
                if (!userExists.get(senderUid)) isOrphan = true;
            }

            if (!isOrphan && targetUid) {
                if (!userExists.has(targetUid)) {
                    const uSnap = await db.collection('users').doc(targetUid).get();
                    userExists.set(targetUid, uSnap.exists);
                }
                if (!userExists.get(targetUid)) isOrphan = true;
            }

            if (isOrphan) {
                batch.delete(cheerDoc.ref);
                deletedCount++;
            } else {
                batch.update(cheerDoc.ref, { lastCheckedAt: admin.firestore.FieldValue.serverTimestamp() });
            }
            checkedCount++;
        }

        await batch.commit();

        res.json({
            message: 'Cheers cleanup complete.',
            stats: { checked: checkedCount, deletedOrphans: deletedCount }
        });
    } catch (err: unknown) {
        const error = err as Error;
        console.error('Error in cheers cleanup:', error);
        res.status(500).send('Error: ' + error.message);
    }
});

export default router;
