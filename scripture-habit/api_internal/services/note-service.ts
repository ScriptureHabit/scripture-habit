import { admin, db } from '../lib/firebase-admin.js';
import { UserDocument, GroupDocument } from '../../types/firestore.js';
import { NotFoundError } from '../lib/errors.js';
import { buildNoteSearchTokens } from '../lib/search-utils.js';
import { t } from '../lib/i18n.js';
import { StreakEngine } from '../lib/streak-engine.js';
import { NotificationService } from './notification-service.js';
import { formatDateInTimeZone, normalizeDateString } from '../../src/utils/time-utils.js';
import { calculateUnityPercentage } from '../../src/utils/unity-utils.js';
import { Group } from '../../src/types/chat.js';

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
                const [userSnap, existingNoteSnap] = await Promise.all([
                    transaction.get(userRef),
                    optimisticId ? transaction.get(noteRef) : Promise.resolve(null)
                ]) as [admin.firestore.DocumentSnapshot<UserDocument>, admin.firestore.DocumentSnapshot | null];

                if (!userSnap.exists) throw new NotFoundError('User not found.');
                const userData = userSnap.data()!;
                const userGroupIds: string[] = userData.groupIds || (userData.groupId ? [userData.groupId] : []);

                // Target logic
                let groupsToPostTo: string[] = [];
                if (shareOption === 'all') groupsToPostTo = userGroupIds;
                else if (shareOption === 'specific') groupsToPostTo = selectedShareGroups || [];
                else if (shareOption === 'current' && userData.groupId) groupsToPostTo = [userData.groupId];
                
                groupsToPostTo = [...new Set(groupsToPostTo.filter(gid => !!gid))].slice(0, 20);

                // --- 2. CALCULATIONS (Pure Logic) ---
                const existingNote = existingNoteSnap ? existingNoteSnap.data() : undefined;
                const existingSharedIds = existingNote?.sharedMessageIds || {};
                const now = new Date();
                const timeZone = userData.timeZone || 'UTC';
                let lastPostAtDate: Date | null = null;
                const lastPostAtRaw = userData.lastPostAt;
                if (lastPostAtRaw) {
                    if (typeof lastPostAtRaw === 'object' && 'toDate' in lastPostAtRaw) {
                        lastPostAtDate = (lastPostAtRaw as { toDate: () => Date }).toDate();
                    } else if (typeof lastPostAtRaw === 'object' && 'seconds' in lastPostAtRaw) {
                        lastPostAtDate = new Date(lastPostAtRaw.seconds * 1000);
                    } else {
                        lastPostAtDate = new Date(lastPostAtRaw as string | number | Date);
                    }
                }

                const streakResult = StreakEngine.calculateNextStreak({
                    streakCount: Number(userData.streakCount || userData.streak || 0),
                    highestStreak: Number(userData.highestStreak || userData.streak || 0),
                    lastPostDate: userData.lastPostDate || null,
                    lastPostAt: lastPostAtDate,
                    timeZone
                }, { now, clientTimeZone });

                const { newStreak, currentHighest, today, streakUpdated } = streakResult;

                // --- 3. ALL WRITES START HERE ---
                const userUpdate: admin.firestore.UpdateData<UserDocument> = {
                    lastPostAt: admin.firestore.Timestamp.fromDate(now)
                };

                if (!existingNoteSnap || !existingNoteSnap.exists) {
                    userUpdate.totalNotes = admin.firestore.FieldValue.increment(1);
                }

                if (userData.streak !== undefined) {
                    userUpdate.streak = admin.firestore.FieldValue.delete();
                }

                if (streakUpdated) {
                    userUpdate.daysStudiedCount = admin.firestore.FieldValue.increment(1);
                    userUpdate.streakCount = newStreak;
                    userUpdate.lastPostDate = today;
                    userUpdate.studiedDates = admin.firestore.FieldValue.arrayUnion(today);
                    if (newStreak > currentHighest) userUpdate.highestStreak = newStreak;
                    if (clientTimeZone && (!userData.timeZone || userData.timeZone === 'UTC')) {
                        userUpdate.timeZone = clientTimeZone;
                    }
                }

                transaction.update(userRef, userUpdate);

                const sharedMessageIds: Record<string, string> = { ...existingSharedIds };

                // Group Writes
                const userNickname = userData.nickname || 'Member';
                const serverTime = admin.firestore.Timestamp.fromDate(now);

                for (const gid of groupsToPostTo) {
                    // Check membership via userGroupIds to avoid reading groupDoc in transaction
                    if (!userGroupIds.includes(gid) || existingSharedIds[gid]) continue;

                    const gRef = db.collection('groups').doc(gid);
                    const msgRef = gRef.collection('messages').doc();
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

                    // Blind updates on group documents without fetching them first
                    const groupUpdate = {
                        lastMessageAt: serverTime,
                        lastNoteAt: serverTime,
                        lastNoteByNickname: userNickname,
                        lastNoteByUid: uid,
                        [`memberLastActive.${uid}`]: serverTime,
                        [`memberLastReadAt.${uid}`]: serverTime,
                        messageCount: admin.firestore.FieldValue.increment(1),
                        noteCount: admin.firestore.FieldValue.increment(1),
                        'dailyActivity.activeMembers': admin.firestore.FieldValue.arrayUnion(uid)
                    } as admin.firestore.UpdateData<GroupDocument>;

                    transaction.update(gRef, groupUpdate);
                    
                    const memberRef = gRef.collection('members').doc(uid);
                    transaction.set(memberRef, { 
                        lastNoteAt: serverTime,
                        lastActiveAt: serverTime,
                        lastPostAt: serverTime,
                        lastReadAt: serverTime,
                        readMessageCount: admin.firestore.FieldValue.increment(1)
                    }, { merge: true });

                    const userGS = userRef.collection('groupStates').doc(gid);
                    transaction.set(userGS, { 
                        readMessageCount: admin.firestore.FieldValue.increment(1), 
                        lastReadAt: serverTime,
                        lastActiveAt: serverTime
                    }, { merge: true });
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
                        const gRef = db.collection('groups').doc(gid);
                        transaction.set(gRef.collection('messages').doc(), {
                            text: announceMsg,
                            senderId: 'system',
                            senderNickname: botName,
                            createdAt: announceTime,
                            isSystemMessage: true,
                            type: 'streakAnnouncement',
                            messageType: 'streakAnnouncement',
                            messageData: { nickname: userNickname, userId: uid, streakCount: newStreak }
                        });
                        
                        transaction.update(gRef, {
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
                    timeZone
                };
            }) as { 
                personalNoteId: string, 
                sharedMessageIds: Record<string, string>, 
                newStreak: number, 
                streakUpdated: boolean, 
                nickname: string,
                timeZone: string
            };

            // Post-transaction Async Operations (Reads outside transaction)
            const userToGroupEntries: [string, string][] = [];
            const groupsToSync = Object.keys(result.sharedMessageIds);
            
            let loadedGroupSnaps: admin.firestore.DocumentSnapshot<GroupDocument>[] = [];
            try {
                if (groupsToSync.length > 0) {
                    const groupDocs = await db.getAll(...groupsToSync.map(gid => db.collection('groups').doc(gid))) as admin.firestore.DocumentSnapshot<GroupDocument>[];
                    loadedGroupSnaps = groupDocs;
                    groupDocs.forEach(gSnap => {
                        if (gSnap.exists) {
                            const gData = gSnap.data()!;
                            const members = gData.members || [];
                            members.forEach((mUid: string) => {
                                if (mUid !== uid) userToGroupEntries.push([mUid, gSnap.id]);
                            });
                        }
                    });
                }
            } catch (err) {
                console.error('[NoteService] Error fetching group members for notification:', err);
            }

            // Async Background Sync for Unity and Date Reset
            const backgroundPromise = Promise.all(groupsToSync.map(async (gid) => {
                try {
                    const groupRef = db.collection('groups').doc(gid);
                    
                    // REUSE the already fetched snapshot if available
                    let gSnap = loadedGroupSnaps.find(snap => snap.id === gid);
                    if (!gSnap || !gSnap.exists) {
                        gSnap = await groupRef.get();
                    }
                    if (!gSnap.exists) return;

                    const gData = gSnap.data() as GroupDocument;
                    const groupTimeZone = gData.timeZone || result.timeZone || 'UTC';
                    const groupToday = formatDateInTimeZone(new Date(), groupTimeZone);
                    
                    const currentActivityDate = gData.dailyActivity?.date || '';
                    const normCurrent = normalizeDateString(currentActivityDate);
                    const normToday = normalizeDateString(groupToday);

                    const groupUpdate: Record<string, unknown> = {};
                    let activeMembers = gData.dailyActivity?.activeMembers || [];
                    if (!activeMembers.includes(uid)) {
                        activeMembers = [...activeMembers, uid];
                    }

                    if (normCurrent !== '' && normToday > normCurrent) {
                        groupUpdate.dailyActivity = { date: groupToday, activeMembers: [uid] };
                    } else if (normCurrent === '' || normToday === normCurrent) {
                        groupUpdate['dailyActivity.activeMembers'] = admin.firestore.FieldValue.arrayUnion(uid);
                        if (normCurrent === '') groupUpdate['dailyActivity.date'] = groupToday;
                    } else {
                        console.warn(`[NoteService] Future date detected for group ${gid}: ${normCurrent}. Resetting to ${normToday}.`);
                        groupUpdate.dailyActivity = { date: groupToday, activeMembers: [uid] };
                    }

                    // Simulate updated group state for unity calculation
                    const simulatedGroup = {
                        ...gData,
                        dailyActivity: {
                            date: groupUpdate.dailyActivity?.date || gData.dailyActivity?.date || groupToday,
                            activeMembers: groupUpdate.dailyActivity?.activeMembers || activeMembers
                        }
                    };
                    
                    groupUpdate.unityPercentage = calculateUnityPercentage(simulatedGroup as unknown as Group, [], new Date());
                    
                    await groupRef.update(groupUpdate);
                } catch (err) {
                    console.error(`[NoteService] Unity update failed for group ${gid}:`, err);
                }
            })).catch(err => {
                console.error('[NoteService] Background group updates failed:', err);
                return null;
            });

            // Push Notifications
            NotificationService.notifyNotePosted({
                groupIds: [...new Set(userToGroupEntries.map(e => e[1]))],
                senderUid: uid,
                senderNickname: result.nickname,
                language: language || 'en',
                userToGroupMapEntries: userToGroupEntries
            });

            return {
                personalNoteId: result.personalNoteId,
                sharedMessageIds: result.sharedMessageIds,
                newStreak: result.newStreak,
                streakUpdated: result.streakUpdated,
                nickname: result.nickname,
                backgroundPromise
            };

        } catch (error) {
            console.error('[NoteService] PostNote Transaction Error Detail:', {
                uid,
                shareOption,
                selectedGroupsCount: selectedShareGroups?.length || 0,
                errorMessage: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });
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

                // --- 2. BATCH READ: Groups and affected Messages ---
                let snapshotResults: admin.firestore.DocumentSnapshot[] = [];
                if (sharedEntries.length > 0) {
                    snapshotResults = typeof transaction.getAll === 'function'
                        ? await transaction.getAll(...groupRefs, ...msgRefs) as admin.firestore.DocumentSnapshot[]
                        : await Promise.all([...groupRefs, ...msgRefs].map(ref => transaction.get(ref)));
                }
                const groupDocs = snapshotResults.slice(0, sharedEntries.length) as admin.firestore.DocumentSnapshot<GroupDocument>[];
                const msgDocs = snapshotResults.slice(sharedEntries.length) as admin.firestore.DocumentSnapshot[];

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
                    const groupToday = formatDateInTimeZone(now, groupTimeZone);

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
                    const [, messageId] = sharedEntries[i];
                    const gSnap = groupDocs[i];
                    const mSnap = msgDocs[i];
                    const meta = queryMetadata[i];
                    if (!gSnap.exists || !mSnap.exists) continue;

                    const updatePayload: admin.firestore.UpdateData<GroupDocument> = {};

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
                    let updatedActiveMembers = [...(gSnap.data()?.dailyActivity?.activeMembers || [])];
                    if (meta.needsTodayNotes) {
                        const todayNotesSnap = querySnaps[snapIdx++];
                        const otherNotesToday = todayNotesSnap.docs.filter(doc => doc.id !== messageId);
                        if (otherNotesToday.length === 0) {
                            updatePayload['dailyActivity.activeMembers'] = admin.firestore.FieldValue.arrayRemove(uid);
                            updatedActiveMembers = updatedActiveMembers.filter(m => m !== uid);
                        }
                    }

                    // Recalculate unityPercentage after note deletion
                    const gDataForCalc = gSnap.data()!;
                    const now = new Date();
                    
                    const simulatedGroup = {
                        ...gDataForCalc,
                        dailyActivity: {
                            ...gDataForCalc.dailyActivity,
                            activeMembers: updatedActiveMembers
                        }
                    };
                    
                    updatePayload.unityPercentage = calculateUnityPercentage(simulatedGroup as unknown as Group, [], now);

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
