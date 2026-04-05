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
        const { uid, messageText, scripture, chapter, comment, title, speaker, shareOption, selectedShareGroups, language, timeZone: clientTimeZone, optimisticId } = input;

        const result = await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(uid);
            
            // 1. Idempotency Check: If optimisticId is provided, check if it was already processed.
            // Using it as the document ID for the personal note is the most robust way.
            const noteRef = optimisticId 
                ? userRef.collection('notes').doc(optimisticId) 
                : userRef.collection('notes').doc();

            const existingNote = await transaction.get(noteRef);
            if (existingNote.exists) {
                // Already posted. Return existing data for idempotency.
                return { 
                    personalNoteId: noteRef.id, 
                    alreadyPosted: true,
                    streakUpdated: false,
                    newStreak: 0,
                    _internalNotifications: { userToGroupMapEntries: [] as [string, string][] } 
                };
            }

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

            const userUpdate: admin.firestore.UpdateData<admin.firestore.DocumentData> = {
                totalNotes: admin.firestore.FieldValue.increment(1),
                lastPostAt: admin.firestore.Timestamp.fromDate(now)
            };

            // Cleanup legacy streak field if present
            if (userData.streak !== undefined) userUpdate.streak = admin.firestore.FieldValue.delete();

            if (streakUpdated) {
                userUpdate.daysStudiedCount = admin.firestore.FieldValue.increment(1);
                userUpdate.streakCount = newStreak;
                userUpdate.lastPostDate = today;
                if (newStreak > currentHighest) userUpdate.highestStreak = newStreak;
                
                // Update timezone if missing
                if (clientTimeZone && (!userData.timeZone || userData.timeZone === 'UTC')) {
                    userUpdate.timeZone = clientTimeZone;
                }
            }

            transaction.update(userRef, userUpdate);

            const userToGroupMap = new Map<string, string>();
            const validatedGroupsToPostTo: string[] = [];

            groupDocs.forEach(gDoc => {
                if (!gDoc.exists) return;
                const gid = gDoc.id;
                const members: string[] = gDoc.data()?.members || [];
                if (!members.includes(uid)) return;

                validatedGroupsToPostTo.push(gid);
                members.forEach(mUid => {
                    if (mUid !== uid && !userToGroupMap.has(mUid)) {
                        userToGroupMap.set(mUid, gid);
                    }
                });
            });

            const noteTimestamp = admin.firestore.Timestamp.now();
            const sharedMessageIds: Record<string, string> = {};

            // 4. Post to groups
            let idx = 0;
            for (const gDoc of groupDocs) {
                const gid = gDoc.id;
                if (!validatedGroupsToPostTo.includes(gid)) {
                    idx++;
                    continue;
                }
                
                const gData = gDoc.data()!;
                const msgRef = db.collection('groups').doc(gid).collection('messages').doc();
                sharedMessageIds[gid] = msgRef.id;

                const userNickname = userData.nickname || 'Member';

                transaction.set(msgRef, {
                    text: messageText,
                    senderId: uid,
                    senderNickname: userNickname,
                    senderPhotoURL: userData.photoURL || null,
                    createdAt: noteTimestamp,
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
                    lastMessageAt: noteTimestamp,
                    lastNoteAt: noteTimestamp,
                    lastNoteByNickname: userNickname,
                    lastNoteByUid: uid
                };

                // TRUTH: Shard BOTH messageCount and noteCount to prevent document hotspots
                CounterService.increment(transaction, groupRefs[idx], 'messageCount');
                CounterService.increment(transaction, groupRefs[idx], 'noteCount');
                
                const totalMessages = (await CounterService.getCountInTransaction(transaction, groupRefs[idx], 'messageCount')) + 1;

                if (gData.dailyActivity?.date !== groupToday) {
                    updatePayload.dailyActivity = { date: groupToday, activeMembers: [uid] };
                } else {
                    updatePayload['dailyActivity.activeMembers'] = admin.firestore.FieldValue.arrayUnion(uid);
                }
                
                // Keep the legacy map updated for dashboard quick-scanning
                updatePayload[`memberLastActive.${uid}`] = noteTimestamp;
                
                transaction.update(groupRefs[idx], updatePayload);

                // Update member subcollection for activity tracking (Scalable)
                const memberRef = groupRefs[idx].collection('members').doc(uid);
                transaction.set(memberRef, {
                    lastActiveAt: noteTimestamp,
                    lastReadAt: noteTimestamp,
                    lastNoteAt: noteTimestamp,
                    readMessageCount: totalMessages
                }, { merge: true });
                
                const userGS = userRef.collection('groupStates').doc(gid);
                transaction.set(userGS, { 
                    readMessageCount: totalMessages, 
                    lastReadAt: noteTimestamp,
                    lastActiveAt: noteTimestamp
                }, { merge: true });

                idx++;
            }

            // 5. Record personal note
            transaction.set(noteRef, {
                text: messageText,
                createdAt: noteTimestamp,
                scripture,
                chapter,
                title: title || null,
                speaker: speaker || null,
                comment,
                shareOption,
                sharedWithGroups: validatedGroupsToPostTo,
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
                        createdAt: admin.firestore.Timestamp.fromMillis(noteTimestamp.toMillis() + 2000),
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
