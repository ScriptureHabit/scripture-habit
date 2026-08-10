import express, { Request, Response, NextFunction } from 'express';
import { admin, db, messaging } from '../lib/firebase-admin.js';
import { StreakReminderEngine } from '../lib/streak-reminder.js';
import { InactivityService } from '../services/inactivity-service.js';
import { calculateMemberStatus, InactivityMemberData, InactivityGroupData } from '../lib/inactivity-utils.js';
import { t } from '../lib/i18n.js';
import { AuthenticationError, NotFoundError, sendErrorResponse } from '../lib/errors.js';
import { getAiDailyComment } from '../data/ai-daily-comments-2026.js';
import { MessageService } from '../services/message-service.js';

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
        sendErrorResponse(res, new AuthenticationError('Unauthorized'));
        return;
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
        console.error('Error in inactivity check:', err);
        sendErrorResponse(res, err, 'Error checking inactivity');
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
        if (!groupDoc.exists) throw new NotFoundError('Not Found');

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
        console.error('[Cron] Error in test-inactive-check:', err);
        sendErrorResponse(res, err, 'Error in test inactive check');
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
        console.error('Error in user stats sync:', err);
        sendErrorResponse(res, err, 'Error syncing user stats');
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
        console.error('Error in cheers cleanup:', err);
        sendErrorResponse(res, err, 'Error cleaning up cheers');
    }
});

/**
 * Daily Streak Reminder (Timezone-Aware)
 * Runs hourly to send 20:XX local time notifications to uncompleted users.
 */
router.all('/streak-reminder', verifyCronSecret, async (req: Request, res: Response) => {
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
                .where('hasFcmToken', '==', true)
                .where('timeZone', 'in', tzChunk)
                .get();

            snapshot.forEach(doc => {
                eligibleUsers.push({ id: doc.id, data: doc.data() });
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

        // Parallelize token fetching in chunks of 500 using db.getAll to avoid N+1 serialization timeouts
        const targetUsers: { id: string, data: admin.firestore.DocumentData }[] = [];
        for (const user of eligibleUsers) {
            const { data } = user;
            const needsReminder = StreakReminderEngine.needsReminder(data.lastPostDate, now, data.timeZone);
            if (needsReminder) {
                targetUsers.push(user);
            } else {
                skippedCount++;
            }
        }

        if (targetUsers.length > 0) {
            const tokenRefs = targetUsers.map(user =>
                db.collection('users').doc(user.id).collection('private').doc('tokens')
            );

            // Fetch tokens in batches of 500 using db.getAll
            const CHUNK_SIZE = 500;
            const tokenDocs: admin.firestore.DocumentSnapshot[] = [];

            for (let i = 0; i < tokenRefs.length; i += CHUNK_SIZE) {
                const chunkRefs = tokenRefs.slice(i, i + CHUNK_SIZE);
                const snaps = await db.getAll(...chunkRefs);
                tokenDocs.push(...snaps);
            }

            tokenDocs.forEach((docSnap, index) => {
                const user = targetUsers[index];
                const fcmTokens: string[] = docSnap.data()?.fcmTokens || [];
                if (fcmTokens.length === 0) return;

                userActiveTokens.set(user.id, new Set(fcmTokens));

                const lang = user.data.language || 'en';
                if (!tokensByLang[lang]) tokensByLang[lang] = [];

                for (const token of fcmTokens) {
                    tokensByLang[lang].push({ token, uid: user.id });
                }
            });
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
                                
                                const docRef = db.collection('users').doc(uid).collection('private').doc('tokens');
                                batch.update(docRef, {
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
        sendErrorResponse(res, err, 'Error in streak warnings');
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
        sendErrorResponse(res, err, 'Error fetching daily active users');
    }
});

/**
 * Post Daily Notes for AI Partner Groups
 */
router.all('/post-ai-daily-notes', verifyCronSecret, async (req: Request, res: Response) => {
    console.log('[Cron] Posting daily notes for AI Partner Groups...');
    try {
        const snapshot = await db.collection('groups').where('isAiGroup', '==', true).get();
        const now = admin.firestore.Timestamp.now();
        const nowDate = new Date();
        const force = req.query?.force === 'true' || req.body?.force === true;
        let processedCount = 0;
        let skippedCount = 0;

        const CHUNK_SIZE = 10;
        for (let i = 0; i < snapshot.docs.length; i += CHUNK_SIZE) {
            const chunk = snapshot.docs.slice(i, i + CHUNK_SIZE);
            await Promise.all(chunk.map(async (doc) => {
                const groupRef = doc.ref;
                const gData = doc.data();

                // Skip deleted groups
                if (gData.isDeleted) return;

                // Calculate timezone-specific local date and hour
                const groupTz = gData.timeZone || 'Asia/Tokyo';
                let todayStr: string;
                let currentLocalHour: number;

                try {
                    todayStr = nowDate.toLocaleDateString('sv-SE', { timeZone: groupTz });
                    const hourStr = new Intl.DateTimeFormat('en-US', {
                        timeZone: groupTz,
                        hour: 'numeric',
                        hour12: false
                    }).format(nowDate);
                    currentLocalHour = parseInt(hourStr, 10);
                    if (currentLocalHour === 24) currentLocalHour = 0;
                } catch {
                    todayStr = nowDate.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
                    currentLocalHour = (nowDate.getUTCHours() + 9) % 24;
                }

                // Target 7:00 AM or later local time for posting daily notes (unless forced).
                // Defensive design: Ensures that even if GitHub Actions triggers with hours of delay,
                // the note will still be posted on the same day once 7:00 AM local time has passed.
                if (!force && currentLocalHour < 7) {
                    skippedCount++;
                    return;
                }

                // Deterministic Document ID for 100% Idempotency (prevent duplicate posts per day)
                const msgRef = groupRef.collection('messages').doc(`ai_note_${todayStr}`);
                const msgSnap = await msgRef.get();

                if (!msgSnap.exists) {
                    // Fetch group owner to get preferred language
                    let lang = 'en';
                    let ownerFcmTokens: string[] = [];
                    if (gData.ownerUserId) {
                        const ownerDoc = await db.collection('users').doc(gData.ownerUserId).get();
                        if (ownerDoc.exists) {
                            const oData = ownerDoc.data();
                            lang = oData?.language || 'en';
                            if (oData?.fcmToken) {
                                ownerFcmTokens = Array.isArray(oData.fcmToken) ? oData.fcmToken : [oData.fcmToken];
                            }
                        }
                    }

                    const botName = t(lang, 'groupChat.aiGroupBotNickname') || (lang === 'ja' ? 'スクハビAI' : 'Scripture Habit AI');
                    const dailyComment = getAiDailyComment(todayStr, lang);
                    const scriptureVal = dailyComment.scripture || (lang === 'ja' ? '旧約聖書' : 'Old Testament');
                    const chapterVal = dailyComment.chapter || 'Genesis 1:1';
                    const categoryLabel = lang === 'ja' ? 'カテゴリ' : 'Category';
                    const chapterLabel = lang === 'ja' ? '章' : 'Chapter';
                    const commentLabel = lang === 'ja' ? 'コメント' : 'Comment';
                    const structuredText = `${categoryLabel}: ${scriptureVal}\n${chapterLabel}: ${chapterVal}\n\n${commentLabel}:\n${dailyComment.comment}`;

                    await msgRef.set({
                        text: structuredText,
                        scripture: scriptureVal,
                        chapter: chapterVal,
                        comment: dailyComment.comment,
                        createdAt: now,
                        senderId: 'ai-partner-bot',
                        senderNickname: botName,
                        isSystemMessage: false,
                        isNote: true,
                        expireAt: admin.firestore.Timestamp.fromMillis(now.toMillis() + 90 * 24 * 60 * 60 * 1000)
                    });

                    await groupRef.update({
                        lastMessageAt: now,
                        lastMessageByNickname: botName,
                        lastMessageByUid: 'ai-partner-bot',
                        lastNoteAt: now,
                        lastNoteByNickname: botName,
                        lastNoteByUid: 'ai-partner-bot',
                        [`memberLastActive.ai-partner-bot`]: now
                    });

                    // Send FCM push notification to group owner
                    if (ownerFcmTokens.length > 0 && messaging) {
                        try {
                            await messaging.sendEachForMulticast({
                                tokens: ownerFcmTokens,
                                notification: {
                                    title: `${botName}`,
                                    body: dailyComment.comment
                                },
                                data: {
                                    groupId: groupRef.id,
                                    type: 'ai_daily_note'
                                }
                            });
                        } catch (pushErr) {
                            console.warn(`[Cron] FCM Push failed for AI note in group ${groupRef.id}:`, pushErr);
                        }
                    }

                    processedCount++;
                } else {
                    skippedCount++;
                }

                // Always reconcile latest messages for the AI group to ensure messages_latest/latest cache is up-to-date
                try {
                    await MessageService.reconcileLatestMessages(doc.id);
                } catch (reconcileErr) {
                    console.warn(`[Cron] Failed to reconcile latest messages for AI group ${doc.id}:`, reconcileErr);
                }
            }));
        }

        res.json({
            message: 'AI daily notes processed successfully.',
            totalAiGroups: snapshot.size,
            postedTodayCount: processedCount,
            alreadyPostedCount: skippedCount
        });
    } catch (err: unknown) {
        console.error('Error posting AI daily notes:', err);
        sendErrorResponse(res, err, 'Error posting AI daily notes');
    }
});

export default router;
