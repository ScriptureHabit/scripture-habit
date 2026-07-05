import express, { Request, Response, NextFunction } from 'express';
import { admin, db, messaging } from '../lib/firebase-admin.js';
import { StreakReminderEngine } from '../lib/streak-reminder.js';
import { CounterService } from '../services/counter-service.js';
import { ArchiveService } from '../services/archive-service.js';
import { InactivityService } from '../services/inactivity-service.js';
import { MessageService } from '../services/message-service.js';
import { calculateMemberStatus, InactivityMemberData, InactivityGroupData } from '../lib/inactivity-utils.js';
import { t } from '../lib/i18n.js';

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
    console.log('[Cron] Starting inactivity check via InactivityService...');
    try {
        const stats = await InactivityService.batchCheckInactivity(100, true);
        res.json({
            message: 'Inactivity check complete.',
            stats
        });
    } catch (err: unknown) {
        const error = err as Error;
        console.error('Error in inactivity check:', error);
        res.status(500).send('Error checking inactivity: ' + error.message);
    }
});


/**
 * Manual Test Endpoint (Dry Run Report)
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
                await MessageService.reconcileLatestMessages(groupDoc.id);
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

        // Gather all membership references across all active users
        const allMemberRefs: admin.firestore.DocumentReference[] = [];
        for (const userDoc of activeUsersSnap.docs) {
            const userData = userDoc.data();
            const groupIds: string[] = userData.groupIds || [];
            const userId = userDoc.id;
            for (const gid of groupIds) {
                allMemberRefs.push(db.collection('groups').doc(gid).collection('members').doc(userId));
            }
        }

        // Fetch all membership statuses in parallel using db.getAll in chunks of 500
        const membershipMap = new Map<string, boolean>(); // key: `${groupId}_${userId}`, value: exists
        const CHUNK_SIZE = 500;
        for (let i = 0; i < allMemberRefs.length; i += CHUNK_SIZE) {
            const chunk = allMemberRefs.slice(i, i + CHUNK_SIZE);
            const snaps = await db.getAll(...chunk);
            snaps.forEach(snap => {
                const userId = snap.id;
                const groupId = snap.ref.parent.parent!.id;
                membershipMap.set(`${groupId}_${userId}`, snap.exists);
            });
        }

        for (const userDoc of activeUsersSnap.docs) {
            const userId = userDoc.id;
            const [notesSnap, cheersSnap] = await Promise.all([
                userDoc.ref.collection('notes').count().get(),
                db.collection('cheers').where('targetUid', '==', userId).count().get()
            ]);
            
            const actualCount = notesSnap.data().count;
            const actualCheers = cheersSnap.data().count;

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
                const exists = membershipMap.get(`${gid}_${userId}`) || false;
                if (exists) {
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

        const uniqueGroupIds = new Set<string>();
        const uniqueUserIds = new Set<string>();
        for (const cheerDoc of cheersSnap.docs) {
            const data = cheerDoc.data();
            if (data.groupId) uniqueGroupIds.add(data.groupId);
            if (data.senderUid) uniqueUserIds.add(data.senderUid);
            if (data.targetUid) uniqueUserIds.add(data.targetUid);
        }

        const groupRefs = Array.from(uniqueGroupIds).map(id => db.collection('groups').doc(id));
        const userRefs = Array.from(uniqueUserIds).map(id => db.collection('users').doc(id));
        const allRefs = [...groupRefs, ...userRefs];

        const groupExists = new Map<string, boolean>();
        const userExists = new Map<string, boolean>();

        if (allRefs.length > 0) {
            const CHUNK_SIZE = 500;
            for (let i = 0; i < allRefs.length; i += CHUNK_SIZE) {
                const chunk = allRefs.slice(i, i + CHUNK_SIZE);
                const snaps = await db.getAll(...chunk);
                snaps.forEach(snap => {
                    const isGroup = snap.ref.parent.id === 'groups';
                    if (isGroup) {
                        groupExists.set(snap.id, snap.exists);
                    } else {
                        userExists.set(snap.id, snap.exists);
                    }
                });
            }
        }

        for (const cheerDoc of cheersSnap.docs) {
            const data = cheerDoc.data();
            const { groupId, senderUid, targetUid } = data;
            
            let isOrphan = false;

            // 1. Check Group
            if (groupId) {
                if (!groupExists.get(groupId)) isOrphan = true;
            } else {
                isOrphan = true;
            }

            // 2. Check Users
            if (!isOrphan && senderUid) {
                if (!userExists.get(senderUid)) isOrphan = true;
            }

            if (!isOrphan && targetUid) {
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

/**
 * Reset Unity Percentage at Midnight
 * This should be called by a scheduled cron job at midnight for each timezone
 */
router.all('/reset-unity-at-midnight', verifyCronSecret, async (_req: Request, res: Response) => {
    console.log('[Cron] Starting unity percentage midnight reset...');
    try {
        const now = new Date();
        const utcTodayStr = now.toISOString().split('T')[0];
        
        // Get all groups that need reset (where dailyActivity date is in the past compared to UTC today)
        // We process in batches to avoid timeout
        const groupsSnap = await db.collection('groups')
            .where('dailyActivity.date', '<', utcTodayStr)
            .limit(500)
            .get();
        
        if (groupsSnap.empty) {
            return res.json({ message: 'No groups need unity reset.' });
        }

        let resetCount = 0;
        const batch = db.batch();
        const MAX_BATCH_SIZE = 500;

        for (const groupDoc of groupsSnap.docs) {
            const groupData = groupDoc.data();
            const groupTimeZone = groupData.timeZone || 'UTC';
            
            // Calculate "today" in the group's timezone
            const todayInGroupTZ = new Date(now.toLocaleString('en-US', { timeZone: groupTimeZone }));
            const todayStr = todayInGroupTZ.toISOString().split('T')[0];
            
            // Check if dailyActivity is from a different day
            const activityDate = groupData.dailyActivity?.date;
            if (activityDate && activityDate !== todayStr) {
                // Reset dailyActivity and unityPercentage
                batch.update(groupDoc.ref, {
                    'dailyActivity.date': todayStr,
                    'dailyActivity.activeMembers': [],
                    'unityPercentage': 0
                });
                resetCount++;
                
                // Commit batch if it reaches the limit
                if (resetCount % MAX_BATCH_SIZE === 0) {
                    await batch.commit();
                    console.log(`[Cron] Processed ${resetCount} groups for unity reset...`);
                }
            }
        }

        // Commit remaining updates
        if (resetCount % MAX_BATCH_SIZE !== 0) {
            await batch.commit();
        }

        console.log(`[Cron] Unity reset complete. Reset ${resetCount} groups.`);
        res.json({
            message: 'Unity percentage midnight reset complete.',
            stats: { resetCount, processedAt: now.toISOString() }
        });
    } catch (err: unknown) {
        const error = err as Error;
        console.error('[Cron] Error in unity reset:', error);
        res.status(500).send('Error: ' + error.message);
    }
});

/**
 * Daily Streak Reminder (Timezone-Aware)
 * Runs hourly to send 20:30 local time notifications to uncompleted users.
 */
router.all('/streak-warning', verifyCronSecret, async (req: Request, res: Response) => {
    try {
        const now = (req.headers['x-test-time'] && process.env.FIRESTORE_EMULATOR_HOST)
            ? new Date(req.headers['x-test-time'] as string)
            : new Date();
        const targetTimezones = StreakReminderEngine.getTargetTimezones(now, 20); // Targeting 20:XX local time

        if (targetTimezones.length === 0) {
            return res.json({ message: 'No timezones currently match 20:XX. Skipping.' });
        }

        // Query users in those timezones who have FCM tokens
        const MAX_TIMEZONES_PER_QUERY = 10;
        const eligibleUsers: { id: string, data: admin.firestore.DocumentData }[] = [];

        // Firestore 'in' queries support max 10 values, so we chunk timezones
        for (let i = 0; i < targetTimezones.length; i += MAX_TIMEZONES_PER_QUERY) {
            const tzChunk = targetTimezones.slice(i, i + MAX_TIMEZONES_PER_QUERY);
            const snapshot = await db.collection('users')
                .where('timeZone', 'in', tzChunk)
                .get();

            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.hasFcmToken === true) {
                    eligibleUsers.push({ id: doc.id, data });
                }
            });
        }

        let sentCount = 0;
        let failedTokens = 0;
        let skippedCount = 0;
        let batch = db.batch(); 
        let batchOpCount = 0;

        // Group tokens by language
        const tokensByLang: Record<string, { token: string, uid: string }[]> = {};
        const userActiveTokens = new Map<string, Set<string>>();

        // Parallelize token fetching in chunks of 50 to avoid N+1 serialization timeouts
        const CHUNK_SIZE = 50;
        for (let i = 0; i < eligibleUsers.length; i += CHUNK_SIZE) {
            const chunk = eligibleUsers.slice(i, i + CHUNK_SIZE);
            const fetchPromises = chunk.map(async (user) => {
                const { data } = user;
                const needsReminder = StreakReminderEngine.needsReminder(data.lastPostDate, now, data.timeZone);
                if (!needsReminder) {
                    return { user, needsReminder: false, fcmTokens: [] };
                }
                const tokensDoc = await db.collection('users').doc(user.id).collection('private').doc('tokens').get();
                const fcmTokens = tokensDoc.data()?.fcmTokens || [];
                return { user, needsReminder: true, fcmTokens };
            });

            const chunkResults = await Promise.all(fetchPromises);

            for (const res of chunkResults) {
                if (!res.needsReminder) {
                    skippedCount++;
                    continue;
                }
                const { user, fcmTokens } = res;
                if (fcmTokens.length === 0) continue;

                userActiveTokens.set(user.id, new Set(fcmTokens));

                const lang = user.data.language || 'en';
                if (!tokensByLang[lang]) tokensByLang[lang] = [];

                for (const token of fcmTokens) {
                    tokensByLang[lang].push({ token, uid: user.id });
                }
            }
        }

        // Send notifications per language
        for (const [lang, allTokensToSend] of Object.entries(tokensByLang)) {
            if (allTokensToSend.length === 0) continue;

            const title = t(lang, 'notifications.streak_warning_title');
            const body = t(lang, 'notifications.streak_warning_body');

            // Chunk tokens just in case > 500 (FCM limit)
            for (let i = 0; i < allTokensToSend.length; i += 500) {
                const chunkMapping = allTokensToSend.slice(i, i + 500);
                const chunk = chunkMapping.map(tk => tk.token);

                const message = {
                    notification: { title, body },
                    data: {
                        type: 'streak_reminder'
                    },
                    tokens: chunk
                };

                const response = await messaging.sendEachForMulticast(message);
                sentCount += response.successCount;

                if (response.failureCount > 0) {
                    failedTokens += response.failureCount;
                    // Clean up invalid tokens
                    for (let idx = 0; idx < response.responses.length; idx++) {
                        const resp = response.responses[idx];
                        if (!resp.success) {
                            const errorString = resp.error?.code;
                            if (errorString === 'messaging/invalid-registration-token' ||
                                errorString === 'messaging/registration-token-not-registered') {
                                
                                const invalidToken = chunk[idx];
                                const uid = chunkMapping[idx].uid;
                                
                                batch.update(db.collection('users').doc(uid).collection('private').doc('tokens'), {
                                    fcmTokens: admin.firestore.FieldValue.arrayRemove(invalidToken)
                                });
                                batchOpCount++;

                                // Memory tracking to see if we cleared all active tokens for this user
                                const activeTokensSet = userActiveTokens.get(uid);
                                if (activeTokensSet) {
                                    activeTokensSet.delete(invalidToken);
                                    if (activeTokensSet.size === 0) {
                                        // Self-healing: no tokens left, set public flag to false to prevent redundant queries
                                        batch.update(db.collection('users').doc(uid), {
                                            hasFcmToken: false
                                        });
                                        batchOpCount++;
                                    }
                                }

                                if (batchOpCount >= 400) {
                                    await batch.commit();
                                    batch = db.batch();
                                    batchOpCount = 0;
                                }
                            }
                        }
                    }
                }
            }
        }

        if (batchOpCount > 0) {
            await batch.commit();
        }

        res.json({
            message: 'Streak warnings processed.',
            stats: { 
                targetTimezones: targetTimezones.length,
                eligibleUsersWithTokens: eligibleUsers.length,
                skippedCompletedUsers: skippedCount,
                tokensSentTo: sentCount,
                failedTokensCleanedUp: failedTokens
            }
        });
    } catch (err: unknown) {
        const error = err as Error;
        console.error('[Cron] Error in streak warnings:', error);
        res.status(500).send('Error: ' + error.message);
    }
});

/**
 * Get Daily Active Users for the past N days (Self-Healing Sync Endpoint)
 */
router.all('/daily-active-users', verifyCronSecret, async (req: Request, res: Response) => {
    console.log('[Cron] Fetching daily active users...');
    try {
        const days = req.query.days ? parseInt(req.query.days as string, 10) : 2;
        const now = new Date();
        const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const cutoffStr = cutoffDate.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });

        // Query dailyStats documents that are greater than or equal to the cutoff date string
        const snapshot = await db.collection('dailyStats')
            .where(admin.firestore.FieldPath.documentId(), '>=', cutoffStr)
            .get();

        const stats = snapshot.docs.map(doc => {
            const data = doc.data();
            const activeUsersArray = data.activeUsers || [];
            return {
                date: doc.id,
                activeUsersCount: activeUsersArray.length
            };
        });

        // Sort by date chronologically
        stats.sort((a, b) => a.date.localeCompare(b.date));

        res.json(stats);
    } catch (err: unknown) {
        const error = err as Error;
        console.error('Error fetching daily active users:', error);
        res.status(500).send('Error: ' + error.message);
    }
});

export default router;
