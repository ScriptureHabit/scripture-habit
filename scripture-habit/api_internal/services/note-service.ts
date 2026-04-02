import { admin, db } from '../lib/firebase-admin.ts';
import { STREAK_ANNOUNCEMENT_TEMPLATES, notifyGroupMembers } from '../lib/notifications.ts';
import { NotFoundError } from '../lib/errors.ts';

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

            const groupRefs = groupsToPostTo.map(gid => db.collection('groups').doc(gid));
            const groupDocs = groupRefs.length > 0 ? await transaction.getAll(...groupRefs) : [];

            // 2. Calculate Streak
            const now = new Date();
            let timeZone = userData.timeZone || 'UTC';
            let today: string, yesterday: string;

            try {
                today = now.toLocaleDateString('sv-SE', { timeZone });
                const yesterdayDate = new Date(now);
                yesterdayDate.setDate(yesterdayDate.getDate() - 1);
                yesterday = yesterdayDate.toLocaleDateString('sv-SE', { timeZone });
            } catch {
                timeZone = 'UTC';
                today = now.toLocaleDateString('sv-SE', { timeZone });
                const yesterdayDate = new Date(now);
                yesterdayDate.setDate(yesterdayDate.getDate() - 1);
                yesterday = yesterdayDate.toLocaleDateString('sv-SE', { timeZone });
            }

            let newStreak = Number(userData.streakCount || userData.streak || 0);
            if (isNaN(newStreak)) newStreak = 0;

            let currentHighest = Number(userData.highestStreak || newStreak);
            if (isNaN(currentHighest)) currentHighest = newStreak;

            let streakUpdated = false;
            const lastPostAt = userData.lastPostAt ? (userData.lastPostAt.toDate ? userData.lastPostAt.toDate() : new Date(userData.lastPostAt)) : new Date(0);
            const hoursSinceLastPost = (now.getTime() - lastPostAt.getTime()) / (1000 * 60 * 60);

            const userUpdate: admin.firestore.UpdateData<admin.firestore.DocumentData> = {
                totalNotes: admin.firestore.FieldValue.increment(1),
                lastPostAt: admin.firestore.Timestamp.fromDate(now)
            };


            if (userData.streak !== undefined) {
                userUpdate.streak = admin.firestore.FieldValue.delete();
            }

            if (userData.lastPostDate !== today) {
                if (userData.lastPostDate > today) {
                    // Future date guard
                } else {
                    userUpdate.daysStudiedCount = admin.firestore.FieldValue.increment(1);

                    if (!userData.lastPostDate) {
                        newStreak = (newStreak > 0) ? newStreak + 1 : 1;
                        streakUpdated = true;
                    } else {
                        const isConsecutiveDay = userData.lastPostDate === yesterday;
                        const isTraveling = clientTimeZone && clientTimeZone !== timeZone;
                        const withinGracePeriod = isTraveling && hoursSinceLastPost < 45;

                        if (isConsecutiveDay || withinGracePeriod) {
                            newStreak += 1;
                        } else {
                            newStreak = 1;
                        }
                        streakUpdated = true;
                    }

                    if (streakUpdated) {
                        userUpdate.streakCount = newStreak;
                        userUpdate.lastPostDate = today;
                        if (newStreak > currentHighest) userUpdate.highestStreak = newStreak;
                        if (clientTimeZone && (!userData.timeZone || userData.timeZone === 'UTC')) {
                            userUpdate.timeZone = clientTimeZone;
                        }
                    }
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
                    messageCount: admin.firestore.FieldValue.increment(1),
                    noteCount: admin.firestore.FieldValue.increment(1),

                    lastMessageAt: noteTimestamp,
                    lastNoteAt: noteTimestamp,
                    lastNoteByNickname: userNickname,
                    lastNoteByUid: uid,
                    [`memberLastActive.${uid}`]: admin.firestore.FieldValue.serverTimestamp()
                };

                if (gData.dailyActivity?.date !== groupToday) {
                    updatePayload.dailyActivity = { date: groupToday, activeMembers: [uid] };
                } else {
                    updatePayload['dailyActivity.activeMembers'] = admin.firestore.FieldValue.arrayUnion(uid);
                }
                transaction.update(groupRefs[idx], updatePayload);
                
                const userGS = userRef.collection('groupStates').doc(gid);
                transaction.set(userGS, { readMessageCount: admin.firestore.FieldValue.increment(1), lastReadAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
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
                // Assuming script-categories and buildNoteSearchTokens are accessible via util if really separated
                searchTokens: Array.from(new Set([scripture, chapter || '', comment, title || '', speaker || ''].join(' ').toLowerCase().split(' ').filter(Boolean)))
            });

            // 5. Streak Announcements
            if (streakUpdated && newStreak > 0) {
                const safeNickname = this.escapeMarkdown(userData.nickname || 'Member');
                const templates = STREAK_ANNOUNCEMENT_TEMPLATES as Record<string, string>;
                const announceMsg = (templates[language || 'en'] || templates.en)
                    .replace('{nickname}', safeNickname)

                    .replace('{streak}', String(newStreak));
                
                [...new Set(userGroupIds)].forEach(gid => {
                    const announceRef = db.collection('groups').doc(gid).collection('messages').doc();
                    transaction.set(announceRef, {
                        text: announceMsg,
                        senderId: 'system',
                        senderNickname: 'Scripture Habit Bot',
                        createdAt: admin.firestore.Timestamp.fromMillis(noteTimestamp.toMillis() + 2000),
                        isSystemMessage: true,
                        messageType: 'streakAnnouncement',
                        messageData: { nickname: userData.nickname, userId: uid, streakCount: newStreak }
                    });
                });
            }

            return { personalNoteId: noteRef.id, newStreak, streakUpdated, nickname: userData.nickname, userToGroupMapEntries: Array.from(userToGroupMap.entries()) };
        });

        // 6. Push Notifications (Async after transaction)
        try {
            const lang = language || 'ja';
            const titleMap: Record<string, string> = {
                'ja': '📖 聖典学習', 'en': '📖 Scripture Study', 'es': '📖 Estudio de las escrituras'
            };
            const bodyTemplateMap: Record<string, string> = {
                'ja': '{nickname}さんがノートを投稿しました！✨', 'en': '{nickname} posted a note! ✨'
            };

            const notifTitle = titleMap[lang] || titleMap['en'];
            const notifBody = (bodyTemplateMap[lang] || bodyTemplateMap['en']).replace('{nickname}', result.nickname || 'Member');

            const groupsToNotifyMap = new Map<string, string[]>();
            result.userToGroupMapEntries.forEach(([memberUid, gid]: [string, string]) => {
                if (!groupsToNotifyMap.has(gid)) groupsToNotifyMap.set(gid, []);
                groupsToNotifyMap.get(gid)!.push(memberUid);
            });

            await Promise.all(Array.from(groupsToNotifyMap.entries()).map(([gid, membersList]) => 
                notifyGroupMembers(gid, uid, { title: notifTitle, body: notifBody, data: { type: 'note', groupId: gid } }, membersList)
            ));
        } catch (err) { console.error('[NotificationService] Error:', err); }

        return result;
    }
}
