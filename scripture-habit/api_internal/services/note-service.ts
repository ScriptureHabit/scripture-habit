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

            const allGroupIds = [...new Set([...userGroupIds, ...groupsToPostTo])].filter(gid => gid && gid.length > 0);
            const groupRefs = allGroupIds.map(gid => db.collection('groups').doc(gid));
            const groupDocs = groupRefs.length > 0 ? await transaction.getAll(...groupRefs) : [];
            const groupDocsMap = new Map(groupDocs.map(doc => [doc.id, doc]));

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
            if (!existingNoteSnap.exists) {
                userUpdate.totalNotes = admin.firestore.FieldValue.increment(1);
            }

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
                
                if (clientTimeZone && (!userData.timeZone || userData.timeZone === 'UTC')) {
                    userUpdate.timeZone = clientTimeZone;
                }
            }

            transaction.update(userRef, userUpdate as admin.firestore.UpdateData<admin.firestore.DocumentData>);

            const userToGroupMap = new Map<string, string>();
            const sharedMessageIds: Record<string, string> = { ...existingSharedIds };

            // 4. Post to groups (Carefully handle idempotency per group)
            for (const gid of groupsToPostTo) {
                const gDoc = groupDocsMap.get(gid);
                if (!gDoc || !gDoc.exists) continue;
                
                const gData = gDoc.data()!;
                const members: string[] = gData.members || [];
                if (!members.includes(uid)) continue;

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

                // TRUTH: Deterministic counting. Calculate the exact new total count for consistent read status.
                const newTotal = (Number(gData.messageCount) || 0) + 1;

                const updatePayload: admin.firestore.UpdateData<admin.firestore.DocumentData> = {
                    lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastNoteAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastNoteByNickname: userNickname,
                    lastNoteByUid: uid,
                    [`memberLastActive.${uid}`]: admin.firestore.FieldValue.serverTimestamp(),
                    [`memberLastReadAt.${uid}`]: admin.firestore.FieldValue.serverTimestamp(),
                    messageCount: admin.firestore.FieldValue.increment(1),
                    noteCount: admin.firestore.FieldValue.increment(1)
                };

                if (gData.dailyActivity?.date !== groupToday) {
                    updatePayload.dailyActivity = { date: groupToday, activeMembers: [uid] };
                } else {
                    updatePayload['dailyActivity.activeMembers'] = admin.firestore.FieldValue.arrayUnion(uid);
                }
                
                transaction.update(gDoc.ref, updatePayload);

                // Update member state for read-sync
                const userGS = userRef.collection('groupStates').doc(gid);
                transaction.set(userGS, { 
                    readMessageCount: newTotal, 
                    lastReadAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastActiveAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });

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
                    const gDoc = groupDocsMap.get(gid);
                    if (!gDoc || !gDoc.exists) return; // SAFE: Document is already in the transaction context

                    const announceRef = gDoc.ref.collection('messages').doc();
                    transaction.set(announceRef, {
                        text: announceMsg,
                        senderId: 'system',
                        senderNickname: botName,
                        createdAt: admin.firestore.Timestamp.fromMillis(now.getTime() + 1000),
                        isSystemMessage: true,
                        messageType: 'streakAnnouncement',
                        messageData: { nickname: userData.nickname, userId: uid, streakCount: newStreak }
                    });
                    
                    transaction.update(gDoc.ref, {
                        messageCount: admin.firestore.FieldValue.increment(1),
                        lastMessageAt: admin.firestore.Timestamp.fromMillis(now.getTime() + 1000),
                        lastMessageByNickname: botName,
                        lastMessageByUid: 'system'
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
        }

        const { _internalNotifications, ...publicResult } = result;
        return publicResult;
    }
}
