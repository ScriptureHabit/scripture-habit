import { admin, db } from '../lib/firebase-admin.js';
import { NotFoundError } from '../lib/errors.js';
import { buildNoteSearchTokens } from '../lib/search-utils.js';
import { t } from '../lib/i18n.js';
import { StreakEngine } from '../lib/streak-engine.js';
import { NotificationService } from './notification-service.js';

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
    private static escapeMarkdown(text: string) {
        return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
    }

    static async postNote(input: PostNoteInput) {
        const { uid, messageText, comment, title, speaker, shareOption, selectedShareGroups, language, timeZone: clientTimeZone, optimisticId } = input;
        
        const scripture = input.scripture.trim();
        const chapter = input.chapter?.trim().replace(/^0+/, '') || "";

        try {
            const result = await db.runTransaction(async (transaction) => {
                const userRef = db.collection('users').doc(uid);
                const noteRef = optimisticId 
                    ? userRef.collection('notes').doc(optimisticId) 
                    : userRef.collection('notes').doc();

                // --- 1. ALL READS FIRST ---
                const [userDoc, existingNoteSnap] = await Promise.all([
                    transaction.get(userRef),
                    transaction.get(noteRef)
                ]);

                if (!userDoc.exists) throw new NotFoundError('User not found.');
                const userData = userDoc.data()!;
                const userGroupIds: string[] = userData.groupIds || (userData.groupId ? [userData.groupId] : []);

                // Target logic
                let groupsToPostTo: string[] = [];
                if (shareOption === 'all') groupsToPostTo = userGroupIds;
                else if (shareOption === 'specific') groupsToPostTo = selectedShareGroups || [];
                else if (shareOption === 'current' && userData.groupId) groupsToPostTo = [userData.groupId];
                
                groupsToPostTo = [...new Set(groupsToPostTo.filter(gid => !!gid))].slice(0, 20);

                const allGroupIds = [...new Set([...userGroupIds, ...groupsToPostTo])].filter(gid => !!gid);
                
                // SECOND BATCH OF READS (must be before any write)
                const groupDocs = allGroupIds.length > 0 
                  ? await transaction.getAll(...allGroupIds.map(gid => db.collection('groups').doc(gid)))
                  : [];
                const groupDocsMap = new Map(groupDocs.map(d => [d.id, d]));

                // --- 2. CALCULATIONS (Pure Logic) ---
                const existingNote = existingNoteSnap.data();
                const existingSharedIds = existingNote?.sharedMessageIds || {};
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

                // --- 3. ALL WRITES START HERE ---
                const userUpdate: Record<string, any> = {
                    lastPostAt: admin.firestore.Timestamp.fromDate(now)
                };

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
                    if (newStreak > currentHighest) userUpdate.highestStreak = newStreak;
                    if (clientTimeZone && (!userData.timeZone || userData.timeZone === 'UTC')) {
                        userUpdate.timeZone = clientTimeZone;
                    }
                }

                transaction.update(userRef, userUpdate);

                const userToGroupEntries: [string, string][] = [];
                const sharedMessageIds: Record<string, string> = { ...existingSharedIds };

                // Group Writes
                const userNickname = userData.nickname || 'Member';
                const serverTime = admin.firestore.Timestamp.fromDate(now);

                for (const gid of groupsToPostTo) {
                    const gDoc = groupDocsMap.get(gid);
                    if (!gDoc || !gDoc.exists) continue;
                    
                    const gData = gDoc.data()!;
                    const members: string[] = gData.members || [];
                    if (!members.includes(uid) || existingSharedIds[gid]) continue;

                    const msgRef = db.collection('groups').doc(gid).collection('messages').doc();
                    sharedMessageIds[gid] = msgRef.id;

                    transaction.set(msgRef, {
                        text: messageText,
                        senderId: uid,
                        senderNickname: userNickname,
                        senderPhotoURL: userData.photoURL || null,
                        createdAt: serverTime,
                        isNote: true,
                        originalNoteId: noteRef.id,
                        scripture,
                        chapter: chapter || ""
                    });

                    let groupToday;
                    try {
                        groupToday = new Intl.DateTimeFormat('sv-SE', { 
                            timeZone: gData.timeZone || timeZone,
                            year: 'numeric', month: '2-digit', day: '2-digit'
                        }).format(now);
                    } catch {
                        groupToday = new Intl.DateTimeFormat('sv-SE', { 
                            timeZone: 'UTC',
                            year: 'numeric', month: '2-digit', day: '2-digit'
                        }).format(now);
                    }

                    const groupUpdate: Record<string, any> = {
                        lastMessageAt: serverTime,
                        lastNoteAt: serverTime,
                        lastNoteByNickname: userNickname,
                        lastNoteByUid: uid,
                        [`memberLastActive.${uid}`]: serverTime,
                        [`memberLastReadAt.${uid}`]: serverTime,
                        messageCount: admin.firestore.FieldValue.increment(1),
                        noteCount: admin.firestore.FieldValue.increment(1)
                    };

                    if (gData.dailyActivity?.date !== groupToday) {
                        groupUpdate.dailyActivity = { date: groupToday, activeMembers: [uid] };
                    } else {
                        groupUpdate['dailyActivity.activeMembers'] = admin.firestore.FieldValue.arrayUnion(uid);
                    }
                    
                    transaction.update(gDoc.ref, groupUpdate);
                    
                    const memberRef = gDoc.ref.collection('members').doc(uid);
                    transaction.set(memberRef, { 
                        lastNoteAt: serverTime,
                        lastActiveAt: serverTime,
                        lastPostAt: serverTime,
                        lastReadAt: serverTime,
                        readMessageCount: (Number(gData.messageCount) || 0) + 1
                    }, { merge: true });

                    const userGS = userRef.collection('groupStates').doc(gid);
                    transaction.set(userGS, { 
                        readMessageCount: (Number(gData.messageCount) || 0) + 1, 
                        lastReadAt: serverTime,
                        lastActiveAt: serverTime
                    }, { merge: true });

                    members.forEach(mUid => {
                        if (mUid !== uid) userToGroupEntries.push([mUid, gid]);
                    });
                }

                // Personal Note Write
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

                // Streak Announcements
                if (streakUpdated && newStreak > 0) {
                    const safeNickname = this.escapeMarkdown(userNickname);
                    const announceMsg = t(language || 'en', 'notifications.streak_announcement', { nickname: safeNickname, streak: newStreak });
                    const botName = t(language || 'en', 'notifications.bot_name');
                    const announceTime = admin.firestore.Timestamp.fromMillis(now.getTime() + 1000);

                    [...new Set(userGroupIds)].forEach(gid => {
                        const gDoc = groupDocsMap.get(gid);
                        if (!gDoc || !gDoc.exists) return;

                        transaction.set(gDoc.ref.collection('messages').doc(), {
                            text: announceMsg,
                            senderId: 'system',
                            senderNickname: botName,
                            createdAt: announceTime,
                            isSystemMessage: true,
                            type: 'streakAnnouncement',
                            messageType: 'streakAnnouncement',
                            messageData: { nickname: userNickname, userId: uid, streakCount: newStreak }
                        });
                        
                        transaction.update(gDoc.ref, {
                            messageCount: admin.firestore.FieldValue.increment(1),
                            lastMessageAt: announceTime,
                            lastMessageByNickname: botName,
                            lastMessageByUid: 'system'
                        });
                    });
                }

                return { 
                    personalNoteId: noteRef.id, 
                    sharedMessageIds,
                    newStreak, 
                    streakUpdated, 
                    nickname: userNickname, 
                    userToGroupEntries 
                };
            });

            // Push Notifications
            NotificationService.notifyNotePosted({
                groupIds: [...new Set(result.userToGroupEntries.map(e => e[1]))],
                senderUid: uid,
                senderNickname: result.nickname,
                language: language || 'en',
                userToGroupMapEntries: result.userToGroupEntries
            });

            const { userToGroupEntries, ...publicResult } = result;
            return publicResult;
        } catch (error) {
            console.error('[NoteService] PostNote Transaction Error:', error);
            throw error;
        }
    }

    static async deleteNote(uid: string, noteId: string) {
        const userRef = db.collection('users').doc(uid);
        const noteRef = userRef.collection('notes').doc(noteId);

        try {
            await db.runTransaction(async (transaction) => {
                // --- 1. INITIAL READ: The Note itself ---
                const noteSnap = await transaction.get(noteRef);
                if (!noteSnap.exists) throw new NotFoundError('Note not found');

                const noteData = noteSnap.data() || {};
                const sharedMessageIds: Record<string, string> = typeof noteData.sharedMessageIds === 'object' && noteData.sharedMessageIds !== null
                    ? noteData.sharedMessageIds
                    : {};

                const sharedEntries = Object.entries(sharedMessageIds);
                const groupRefs = sharedEntries.map(([gid]) => db.collection('groups').doc(gid));
                const msgRefs = sharedEntries.map(([gid, mid]) => db.collection('groups').doc(gid).collection('messages').doc(String(mid)));

                // --- 2. BATCH READ: User, Groups, and affected Messages ---
                const [_userDoc, ...sharedDocs] = await transaction.getAll(userRef, ...groupRefs, ...msgRefs);
                const groupDocs = sharedDocs.slice(0, sharedEntries.length);
                const msgDocs = sharedDocs.slice(sharedEntries.length);

                const now = new Date();
                const todayStart = new Date(now);
                todayStart.setHours(0, 0, 0, 0);

                // --- 3. DYNAMIC READS (Queries): Identify needs for lastNote recovery ---
                const queryMetadata: { groupId: string, messageId: string, needsNextNote: boolean, needsTodayNotes: boolean }[] = [];
                const queryPromises: Promise<admin.firestore.QuerySnapshot>[] = [];

                for (let i = 0; i < sharedEntries.length; i++) {
                    const [groupId, messageId] = sharedEntries[i];
                    const gSnap = groupDocs[i];
                    const mSnap = msgDocs[i];
                    if (!gSnap.exists || !mSnap.exists) {
                        queryMetadata.push({ groupId, messageId, needsNextNote: false, needsTodayNotes: false });
                        continue;
                    }

                    const gData = gSnap.data()!;
                    const needsNextNote = gData.lastNoteByUid === uid;

                    let needsTodayNotes = false;
                    const groupTimeZone = gData.timeZone || 'UTC';
                    let groupToday;
                    try {
                        groupToday = now.toLocaleDateString('sv-SE', { timeZone: groupTimeZone });
                    } catch {
                        groupToday = now.toLocaleDateString('sv-SE', { timeZone: 'UTC' });
                    }

                    if (gData.dailyActivity?.date === groupToday && gData.dailyActivity?.activeMembers?.includes(uid)) {
                        needsTodayNotes = true;
                    }

                    queryMetadata.push({ groupId, messageId, needsNextNote, needsTodayNotes });

                    if (needsNextNote) {
                        queryPromises.push(transaction.get(
                            db.collection('groups').doc(groupId).collection('messages')
                                .where('isNote', '==', true)
                                .orderBy('createdAt', 'desc')
                                .limit(5) // Just enough to find the next valid one
                        ));
                    }
                    if (needsTodayNotes) {
                        queryPromises.push(transaction.get(
                            db.collection('groups').doc(groupId).collection('messages')
                                .where('senderId', '==', uid)
                                .where('isNote', '==', true)
                                .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(todayStart))
                                .limit(2)
                        ));
                    }
                }

                const querySnaps = await Promise.all(queryPromises);
                let snapIdx = 0;

                // --- 4. ALL WRITES START HERE ---
                transaction.delete(noteRef);
                transaction.update(userRef, {
                    totalNotes: admin.firestore.FieldValue.increment(-1)
                });

                for (let i = 0; i < sharedEntries.length; i++) {
                    const [_groupId, messageId] = sharedEntries[i];
                    const gSnap = groupDocs[i];
                    const mSnap = msgDocs[i];
                    const meta = queryMetadata[i];
                    if (!gSnap.exists || !mSnap.exists) continue;

                    const updatePayload: Record<string, any> = {};

                    // Handle lastNote recovery
                    if (meta.needsNextNote) {
                        const notesSnap = querySnaps[snapIdx++];
                        const nextNote = notesSnap.docs.find(doc => doc.id !== messageId);
                        if (nextNote) {
                            const nData = nextNote.data();
                            updatePayload.lastNoteAt = nData.createdAt;
                            updatePayload.lastNoteByNickname = nData.senderNickname || 'Member';
                            updatePayload.lastNoteByUid = nData.senderId;
                        } else {
                            updatePayload.lastNoteAt = null;
                            updatePayload.lastNoteByNickname = null;
                            updatePayload.lastNoteByUid = null;
                        }
                    }

                    // Handle Daily Activity Update
                    if (meta.needsTodayNotes) {
                        const todayNotesSnap = querySnaps[snapIdx++];
                        const otherNotesToday = todayNotesSnap.docs.filter(doc => doc.id !== messageId);
                        if (otherNotesToday.length === 0) {
                            updatePayload['dailyActivity.activeMembers'] = admin.firestore.FieldValue.arrayRemove(uid);
                        }
                    }

                    updatePayload.noteCount = admin.firestore.FieldValue.increment(-1);
                    updatePayload.messageCount = admin.firestore.FieldValue.increment(-1);

                    transaction.update(gSnap.ref, updatePayload);
                    transaction.delete(mSnap.ref);
                }
            });
            return { success: true };
        } catch (error) {
            console.error('[NoteService] DeleteNote Transaction Error:', error);
            throw error;
        }
    }
}
