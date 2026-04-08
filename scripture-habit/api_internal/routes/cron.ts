import express, { Request, Response, NextFunction } from 'express';
import { admin, db } from '../lib/firebase-admin.js';
import { CounterService } from '../services/counter-service.js';
import { ArchiveService } from '../services/archive-service.js';
import { getUserFcmTokens, sendPushNotification, cleanupTokens } from '../lib/notifications.js';
import { t } from '../lib/i18n.js';
import { FirestoreTimestamp } from '../../types/firestore.js';

interface MemberPreview {
    uid: string;
    nickname: string;
}

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
        let snapshot = await groupsRef
            .orderBy('lastInactivityCheckedAt', 'asc')
            .limit(100)
            .get();

        // Step 2: "The Net" - Catch new/stale groups that doesn't have the field yet.
        if (snapshot.size < 50) {
            snapshot = await groupsRef.limit(50).get();
        }

        let list = snapshot.docs;

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
            if (membersSnap.empty) continue;

            let groupChanged = false;
            const groupUpdates: Record<string, admin.firestore.FieldValue | string | number | boolean | string[] | object | undefined | null> = {
                lastInactivityCheckedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            let isGroupDeleted = false;

            const activeMembers: string[] = [];
            const inactiveMembers: string[] = [];
            const membersToInitialize: string[] = [];

            membersSnap.forEach(memberDoc => {
                const memberData = memberDoc.data();
                const memberId = memberDoc.id;

                // This ensures we respect the "habit rule" (threshold) even for those who haven't started posting yet.
                const candidates: FirestoreTimestamp[] = [
                    memberData.lastNoteAt,
                    memberData.lastPostAt,
                    memberData.joinedAt
                ].filter(Boolean);

                const individualThresholdDays = memberData.kickThreshold || (groupData.memberKickThresholds && groupData.memberKickThresholds[memberId]) || 3;
                const individualThresholdMs = individualThresholdDays * 24 * 60 * 60 * 1000;

                if (candidates.length === 0) {
                    // GHOST BUSTER: If no activity data or joinedAt exists (corrupt/v1 legacy),
                    // we initialize joinedAt now to start their 3-day grace period.
                    batch.update(memberDoc.ref, { joinedAt: admin.firestore.FieldValue.serverTimestamp() });
                    batchOpCount++;
                    activeMembers.push(memberId);
                } else {
                    // Find the newest among candidates
                    const candidateDates = candidates.map(c => {
                        if (!c) return 0;

                        // Type-safe approach to extract milliseconds
                        if (typeof (c as admin.firestore.Timestamp).toMillis === 'function') {
                            return (c as admin.firestore.Timestamp).toMillis();
                        }

                        const tsObj = c as { seconds?: number; _seconds?: number };
                        if (tsObj.seconds !== undefined) return tsObj.seconds * 1000;
                        if (tsObj._seconds !== undefined) return tsObj._seconds * 1000;

                        if (c instanceof Date) return c.getTime();
                        if (typeof c === 'number') return c;

                        return 0;
                    }).filter(t => t > 0);

                    const lastActiveTime = candidateDates.length > 0 ? Math.max(...candidateDates) : 0;
                    const diff = lastActiveTime > 0 ? now.getTime() - lastActiveTime : 0;

                    if (lastActiveTime > 0 && diff > individualThresholdMs) {
                        inactiveMembers.push(memberId);
                    } else {
                        activeMembers.push(memberId);
                    }
                }
            });

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
                    batch.set(transferMsgRef, {
                        text: `👑 **Ownership Transferred**\nThe previous owner was inactive. Ownership has been transferred to a verified active member.`,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        senderId: 'system',
                        isSystemMessage: true,
                        type: 'system'
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
                // Using remainingMembers for future logic if needed, but for now just filter previews
                const updatedPreviews = (groupData.memberPreviews || []).filter((p: MemberPreview) => !finalMembersToRemove.includes(p.uid));

                groupUpdates['members'] = admin.firestore.FieldValue.arrayRemove(...finalMembersToRemove);
                groupUpdates['membersCount'] = admin.firestore.FieldValue.increment(-finalMembersToRemove.length);
                groupUpdates['memberPreviews'] = updatedPreviews;

                // TRUTH: If kicked members contributed to unity today, remove them to keep it honest
                if (groupData.dailyActivity?.date && groupData.dailyActivity?.activeMembers?.some((id: string) => finalMembersToRemove.includes(id))) {
                    const remainingActive = (groupData.dailyActivity.activeMembers as string[]).filter(id => !finalMembersToRemove.includes(id));
                    groupUpdates['dailyActivity.activeMembers'] = remainingActive;
                }

                finalMembersToRemove.forEach(uid => {
                    groupUpdates[`memberLastActive.${uid}`] = admin.firestore.FieldValue.delete();
                    groupUpdates[`memberLastReadAt.${uid}`] = admin.firestore.FieldValue.delete();
                });
                groupChanged = true;
                removedCount += finalMembersToRemove.length;

                const messageRef = groupsRef.doc(groupId).collection('messages').doc();
                batch.set(messageRef, {
                    text: `👋 **${finalMembersToRemove.length} member(s)** were removed due to inactivity.`,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    senderId: 'system',
                    isSystemMessage: true,
                    type: 'leave'
                });
                batchOpCount++;

                for (const uid of finalMembersToRemove) {
                    const userRef = db.collection('users').doc(uid);
                    batch.update(userRef, { groupIds: admin.firestore.FieldValue.arrayRemove(groupId) });
                    batch.delete(userRef.collection('groupStates').doc(groupId));

                    // Cleanup the member subcollection document (Ghost Buster)
                    batch.delete(groupsRef.doc(groupId).collection('members').doc(uid));

                    batchOpCount += 3;

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

        const groupData = groupDoc.data();
        if (!groupData) return res.status(404).json({ error: 'Data Not Found' });

        const members: string[] = groupData.members || [];
        const memberLastActive = groupData.memberLastActive || {};
        const ownerUserId = groupData.ownerUserId;
        const now = new Date();
        const groupName = groupData.name || '';
        const report: CronReport = { groupId: groupId as string, groupName, totalMembers: members.length, ownerUserId, checkTime: now.toISOString(), members: [] };
        const memberKickThresholds = groupData.memberKickThresholds || {};

        for (const memberId of members) {
            const threshold = memberKickThresholds[memberId] || 3;
            const thresholdMs = threshold * 24 * 60 * 60 * 1000;
            const info: CronMemberInfo = { memberId, isOwner: memberId === ownerUserId, threshold, status: '', action: '' };

            if (memberId === ownerUserId) {
                info.status = 'Owner (skipped)';
                info.action = 'none';
            } else {
                const lastTs = memberLastActive[memberId];
                if (!lastTs) {
                    info.status = 'No tracking data';
                    info.action = 'would initialize';
                } else {
                    const lastDate = lastTs.toDate();
                    const diff = now.getTime() - lastDate.getTime();
                    info.lastActive = lastDate.toISOString();
                    info.daysSinceActive = Math.floor(diff / (24 * 60 * 60 * 1000));
                    info.status = diff > thresholdMs ? '⚠️ Inactive' : '✅ Active';
                    info.action = diff > thresholdMs ? 'would remove' : 'keep';
                }
            }
            report.members.push(info);
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
            const notesSnap = await userDoc.ref.collection('notes').get();
            const actualCount = notesSnap.size;

            const userData = userDoc.data();
            const groupIds: string[] = userData.groupIds || [];
            const validGroupIds: string[] = [];
            let profileChanged = false;

            // 1. Verify Note Count Truth
            if (actualCount !== (userData.totalNotes || 0)) {
                profileChanged = true;
            }

            // 2. Verify Membership Truth (Prune Orphans)
            for (const gid of groupIds) {
                const memberSnap = await db.collection('groups').doc(gid).collection('members').doc(userDoc.id).get();
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

export default router;
