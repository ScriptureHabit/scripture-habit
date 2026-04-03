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
        const { uid, messageText, scripture, chapter, comment, title, speaker, shareOption, selectedShareGroups, language, timeZone: clientTimeZone } = input;

        const result = await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(uid);
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) throw new NotFoundError('User not found.');

            const userData = userDoc.data()!;
            const userGroupIds: string[] = userData.groupIds || (userData.groupId ? [userData.groupId] : []);

            // 1. Identify target groups
            let groupsToPostTo: string[] = [];
            if (shareOption === 'all') groupsToPostTo = userGroupIds;
            else if (shareOption === 'specific') groupsToPostTo = selectedShareGroups || [];
            else if (shareOption === 'current' && userData.groupId) groupsToPostTo = [userData.groupId];

            groupsToPostTo = groupsToPostTo.filter(gid => typeof gid === 'string' && gid.length > 0);
            groupsToPostTo = [...new Set(groupsToPostTo)];

            const groupRefs = groupsToPostTo.map(gid => db.collection('groups').doc(gid));
            const groupDocs = groupRefs.length > 0 ? await transaction.getAll(...groupRefs) : [];

            // 2. Calculate Streak
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

            const userToGroupMap = new Map();
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

            const noteRef = userRef.collection('notes').doc();
            const noteTimestamp = admin.firestore.Timestamp.now();
            const sharedMessageIds: Record<string, string> = {};

            // 3. Post to groups
            groupDocs.forEach((gDoc, idx) => {
                const gid = gDoc.id;
                if (!validatedGroupsToPostTo.includes(gid)) return;
                
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
                    // messageCount: admin.firestore.FieldValue.increment(1), // MOVED TO SHARDS
                    noteCount: admin.firestore.FieldValue.increment(1),

                    lastMessageAt: noteTimestamp,
                    lastNoteAt: noteTimestamp,
                    lastNoteByNickname: userNickname,
                    lastNoteByUid: uid
                };

                CounterService.increment(transaction, groupRefs[idx]);


                if (gData.dailyActivity?.date !== groupToday) {
                    updatePayload.dailyActivity = { date: groupToday, activeMembers: [uid] };
                } else {
                    updatePayload['dailyActivity.activeMembers'] = admin.firestore.FieldValue.arrayUnion(uid);
                }
                transaction.update(groupRefs[idx], updatePayload);

                // Update member subcollection for activity tracking (Scalable)
                const memberRef = groupRefs[idx].collection('members').doc(uid);
                transaction.set(memberRef, {
                    lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastReadAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                
                const userGS = userRef.collection('groupStates').doc(gid);
                transaction.set(userGS, { 
                    readMessageCount: admin.firestore.FieldValue.increment(1), 
                    lastReadAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastActiveAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            });

            // 4. Record personal note
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

            // 5. Streak Announcements
            if (streakUpdated && newStreak > 0) {
                const safeNickname = this.escapeMarkdown(userData.nickname || 'Member');
                const announceMsg = t(language, 'notifications.streak_announcement', { 
                    nickname: safeNickname, 
                    streak: newStreak 
                });
                
                const botName = t(language, 'notifications.bot_name');
                
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
                newStreak, 
                streakUpdated, 
                nickname: userData.nickname, 
                _internalNotifications: { userToGroupMapEntries: Array.from(userToGroupMap.entries()) } 
            };
        });

        // 6. Push Notifications (Async after transaction)
        NotificationService.notifyNotePosted({
            groupIds: Array.from(new Set(result._internalNotifications.userToGroupMapEntries.map(e => e[1]))),
            senderUid: uid,
            senderNickname: result.nickname || 'Member',
            language: language,
            userToGroupMapEntries: result._internalNotifications.userToGroupMapEntries
        });

        // 7. Probabilistic Aggregation (Sync shards back to main doc every ~10 posts)
        if (Math.random() < 0.1) {
            Promise.all(result._internalNotifications.userToGroupMapEntries.map(async ([_, gid]) => {
                try {
                    await CounterService.aggregateAndSync(db.collection('groups').doc(gid), 'messageCount');
                } catch (e) {
                    console.warn(`[NoteService] Aggregation failed for group ${gid}:`, e);
                }
            })).catch(err => console.error("[NoteService] Aggregation background task error:", err));
        }

        const { _internalNotifications, ...publicResult } = result;
        return publicResult;

    }
}
