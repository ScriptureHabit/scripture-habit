import { admin, db } from '../lib/firebase-admin.js';
import { NotFoundError } from '../lib/errors.js';
import { buildNoteSearchTokens } from '../lib/search-utils.js';
import { t } from '../lib/i18n.js';
import { StreakEngine } from '../lib/streak-engine.js';
import { NotificationService } from './notification-service.js';
import { CounterService } from './counter-service.js';

// Private types for service internal use
export interface PostNoteInput {
    uid: string;
    messageText: string;
    scripture: string;
    chapter?: string | null;
    comment: string;
    title?: string | null;
    speaker?: string | null;
    shareOption: 'all' | 'current' | 'specific' | 'none';
    selectedShareGroups?: string[] | null;
    language?: string | null;
    timeZone?: string | null;
    optimisticId?: string | null;
}

export class NoteService {
    /**
     * Helper: Escape markdown for nickname
     */
    private static escapeMarkdown(text: string) {
        return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
    }

    /**
     * Posts a new note for a user, updates streaks, and shares with groups.
     */
    static async postNote(input: PostNoteInput) {
        const { uid, messageText, comment, title, speaker, shareOption, selectedShareGroups, language, timeZone: clientTimeZone, optimisticId } = input;
        
        // TRUTH: Normalize inputs to prevent "1 Nephi 1" vs "1 Nephi 01" drift
        const scripture = input.scripture.trim();
        const chapter = input.chapter?.trim().replace(/^0+/, '') || "";

        const result = await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(uid);
            const noteRef = optimisticId 
                ? userRef.collection('notes').doc(optimisticId) 
                : userRef.collection('notes').doc();

            const existingNoteSnap = await transaction.get(noteRef);
            const existingNote = existingNoteSnap.data();
            const existingSharedIds = existingNote?.sharedMessageIds || {};

            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) throw new NotFoundError('User not found.');

            const userData = userDoc.data()!;
            const userGroupIds: string[] = userData.groupIds || (userData.groupId ? [userData.groupId] : []);

            // 2. Identify target groups
            let groupsToPostTo: string[] = [];
            if (shareOption === 'all') groupsToPostTo = userGroupIds;
            else if (shareOption === 'specific') groupsToPostTo = selectedShareGroups || [];
            else if (shareOption === 'current' && userData.groupId) groupsToPostTo = [userData.groupId];

            groupsToPostTo = groupsToPostTo.filter(gid => typeof gid === 'string' && gid.length > 0);
            groupsToPostTo = [...new Set(groupsToPostTo)];
            
            // TRUTH: Limit the number of groups per transaction to avoid Firestore 500-doc write limit.
            // Sharing with 20 groups is plenty; beyond that, it should be a separate operation or background job.
            if (groupsToPostTo.length > 20) {
                groupsToPostTo = groupsToPostTo.slice(0, 20);
            }

            const groupRefs = groupsToPostTo.map(gid => db.collection('groups').doc(gid));
            const groupDocs = groupRefs.length > 0 ? await transaction.getAll(...groupRefs) : [];

            // 3. Calculate Streak
            const now = new Date();
            const timeZone = userData.timeZone || 'UTC';
            const streakResult = StreakEngine.calculateNextStreak({
                streakCount: Number(userData.streakCount || userData.streak || 0),
                highestStreak: Number(userData.highestStreak || userData.streak || 0),
                lastPostDate: userData.lastPostDate || null,
                lastPostAt: userData.lastPostAt ? (userData.lastPostAt.toDate ? userData.lastPostAt.toDate() : new Date(userData.lastPostAt)) : null,
                timeZone
            }, { now, clientTimeZone });

            const { newStreak, currentHighest, today, streakUpdated } = streakResult;

            const userUpdate: Record<string, unknown> = {
                lastPostAt: admin.firestore.Timestamp.fromDate(now)
            };

            // TRUTH: If editing an existing note (retry/idempotency), do NOT increment totalNotes.
            // This prevents duplicate counting and SDK crashes from 'undefined' values.
            if (!existingNoteSnap.exists) {
                userUpdate.totalNotes = admin.firestore.FieldValue.increment(1);
            }

            // Cleanup legacy streak field if present
            if (userData.streak !== undefined) {
                userUpdate.streak = admin.firestore.FieldValue.delete();
            }

            if (streakUpdated) {
                userUpdate.daysStudiedCount = admin.firestore.FieldValue.increment(1);
                userUpdate.streakCount = newStreak;
                userUpdate.lastPostDate = today;
                if (newStreak > currentHighest) {
                    userUpdate.highestStreak = newStreak;
                }
                
                // Update timezone if missing or default
                if (clientTimeZone && (!userData.timeZone || userData.timeZone === 'UTC')) {
                    userUpdate.timeZone = clientTimeZone;
                }
            }

            transaction.update(userRef, userUpdate as admin.firestore.UpdateData<admin.firestore.DocumentData>);

            const userToGroupMap = new Map<string, string>();
            const sharedMessageIds: Record<string, string> = { ...existingSharedIds };

            // 4. Post to groups (Carefully handle idempotency per group)
            for (let i = 0; i < groupDocs.length; i++) {
                const gDoc = groupDocs[i];
                if (!gDoc.exists) continue;
                
                const gid = gDoc.id;
                const gData = gDoc.data()!;
                const members: string[] = gData.members || [];
                if (!members.includes(uid)) continue;

                // TRUTH: If already shared with this group, don't duplicate.
                if (existingSharedIds[gid]) continue;

                const msgRef = db.collection('groups').doc(gid).collection('messages').doc();
                sharedMessageIds[gid] = msgRef.id;

                const userNickname = userData.nickname || 'Member';

                transaction.set(msgRef, {
                    text: messageText,
                    senderId: uid,
                    senderNickname: userNickname,
                    senderPhotoURL: userData.photoURL || null,
                    createdAt: admin.firestore.Timestamp.fromDate(now),
                    isNote: true,
                    originalNoteId: noteRef.id,
                    scripture,
                    chapter: chapter || ""
                });

                let groupToday;
                const groupTimeZone = gData.timeZone || timeZone;
                try {
                    groupToday = now.toLocaleDateString('sv-SE', { timeZone: groupTimeZone });
                } catch {
                    groupToday = now.toLocaleDateString('sv-SE', { timeZone: 'UTC' });
                }

                const updatePayload: admin.firestore.UpdateData<admin.firestore.DocumentData> = {
                    lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastNoteAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastNoteByNickname: userNickname,
                    lastNoteByUid: uid,
                    [`memberLastActive.${uid}`]: admin.firestore.FieldValue.serverTimestamp()
                };

                // TRUTH: Shard increment without waiting for expensive shard sum
                CounterService.increment(transaction, gDoc.ref, 'messageCount');
                CounterService.increment(transaction, gDoc.ref, 'noteCount');
                
                // Use approximate total for read count to avoid transaction contention
                const approxTotal = (gData.messageCount || 0) + 1;

                if (gData.dailyActivity?.date !== groupToday) {
                    updatePayload.dailyActivity = { date: groupToday, activeMembers: [uid] };
                } else {
                    updatePayload['dailyActivity.activeMembers'] = admin.firestore.FieldValue.arrayUnion(uid);
                }
                
                transaction.update(gDoc.ref, updatePayload);

                // Update member subcollection for activity tracking (Scalable)
                const memberRef = gDoc.ref.collection('members').doc(uid);
                transaction.set(memberRef, {
                    lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastReadAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastNoteAt: admin.firestore.FieldValue.serverTimestamp(),
                    readMessageCount: approxTotal
                }, { merge: true });
                
                const userGS = userRef.collection('groupStates').doc(gid);
                transaction.set(userGS, { 
                    readMessageCount: approxTotal, 
                    lastReadAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastActiveAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });

                // Fill notification map
                members.forEach(mUid => {
                    if (mUid !== uid && !userToGroupMap.has(mUid)) {
                        userToGroupMap.set(mUid, gid);
                    }
                });
            }

            // 5. Record personal note
            transaction.set(noteRef, {
                text: messageText,
                createdAt: admin.firestore.Timestamp.fromDate(now),
                scripture,
                chapter,
                title: title || null,
                speaker: speaker || null,
                comment,
                shareOption,
                sharedWithGroups: Object.keys(sharedMessageIds),
                sharedMessageIds,
                searchTokens: buildNoteSearchTokens({ scripture, chapter, comment, title, speaker })
            });

            // 6. Streak Announcements
            if (streakUpdated && newStreak > 0) {
                const safeNickname = this.escapeMarkdown(userData.nickname || 'Member');
                const announceMsg = t(language || 'en', 'notifications.streak_announcement', { 
                    nickname: safeNickname, 
                    streak: newStreak 
                });
                
                const botName = t(language || 'en', 'notifications.bot_name');
                
                [...new Set(userGroupIds)].forEach(gid => {
                    const announceRef = db.collection('groups').doc(gid).collection('messages').doc();
                    transaction.set(announceRef, {
                        text: announceMsg,
                        senderId: 'system',
                        senderNickname: botName,
                        // TRUTH: Offset by 1 second to ensure it follows the note logically in chat lists
                        createdAt: admin.firestore.Timestamp.fromMillis(now.getTime() + 1000),
                        isSystemMessage: true,
                        messageType: 'streakAnnouncement',
                        messageData: { nickname: userData.nickname, userId: uid, streakCount: newStreak }
                    });
                });
            }

            return { 
                personalNoteId: noteRef.id, 
                alreadyPosted: false,
                newStreak, 
                streakUpdated, 
                nickname: userData.nickname, 
                _internalNotifications: { userToGroupMapEntries: Array.from(userToGroupMap.entries()) } 
            };
        });

        // 7. Push Notifications (Async after transaction)
        if (!result.alreadyPosted) {
            NotificationService.notifyNotePosted({
                groupIds: Array.from(new Set(result._internalNotifications.userToGroupMapEntries.map(e => e[1]))),
                senderUid: uid,
                senderNickname: result.nickname || 'Member',
                language: language || 'en',
                userToGroupMapEntries: result._internalNotifications.userToGroupMapEntries
            });

            // 8. Probabilistic Aggregation (Sync shards back to main doc every ~10 posts)
            if (Math.random() < 0.1) {
                Promise.all(result._internalNotifications.userToGroupMapEntries.map(async (entry) => {
                    const gid = entry[1];
                    try {
                        await CounterService.aggregateAndSync(db.collection('groups').doc(gid), 'messageCount');
                    } catch (e) {
                        console.warn(`[NoteService] Aggregation failed for group ${gid}:`, e);
                    }
                })).catch(err => console.error("[NoteService] Aggregation background task error:", err));
            }
        }

        const { _internalNotifications, ...publicResult } = result;
        return publicResult;
    }
}
