/* eslint-disable no-restricted-properties */
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
import { getMessageExpireAt } from '../lib/ttl-utils.js';

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
    clientTimestamp?: number;
}

export class NoteService {
    private static escapeMarkdown(text: string) {
        return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
    }

    static async postNote(input: PostNoteInput) {
        const { uid, messageText, comment, title, speaker, shareOption, selectedShareGroups, language, timeZone: clientTimeZone, optimisticId, clientTimestamp } = input;
        
        const scripture = input.scripture.trim();
        const chapter = input.chapter?.trim().replace(/^0+/, '') || "";

        try {
            const result = await db.runTransaction(async (transaction) => {
                const userRef = db.collection('users').doc(uid);
                const noteRef = optimisticId 
                    ? userRef.collection('notes').doc(optimisticId) 
                    : userRef.collection('notes').doc();

                // --- PHASE 1: READ & CALCULATION PHASE (Strict Read-before-Write) ---
                const {
                    userData,
                    userGroupIds,
                    groupsToPostTo,
                    existingSharedIds,
                    now,
                    streakResult,
                    messagesInGroup,
                    existingNoteExists,
                    allLatestGids
                } = await (async () => {
                    const [userSnap, existingNoteSnap] = await Promise.all([
                        transaction.get(userRef),
                        optimisticId ? transaction.get(noteRef) : Promise.resolve(null)
                    ]) as [admin.firestore.DocumentSnapshot<UserDocument>, admin.firestore.DocumentSnapshot | null];

                    if (!userSnap.exists) throw new NotFoundError('User not found.');
                    const uData = userSnap.data()!;
                    const uGroupIds: string[] = uData.groupIds || (uData.groupId ? [uData.groupId] : []);

                    let groupsToPost: string[] = [];
                    if (shareOption === 'all') groupsToPost = uGroupIds;
                    else if (shareOption === 'specific') groupsToPost = selectedShareGroups || [];
                    else if (shareOption === 'current' && uData.groupId) groupsToPost = [uData.groupId];
                    
                    groupsToPost = [...new Set(groupsToPost.filter(gid => !!gid))].slice(0, 20);

                    const extNote = existingNoteSnap ? existingNoteSnap.data() : undefined;
                    const extSharedIds = extNote?.sharedMessageIds || {};
                    const currentNow = new Date();
                    const tz = uData.timeZone || 'UTC';
                    let lastPostAtDt: Date | null = null;
                    const lastPostAtRw = uData.lastPostAt;
                    if (lastPostAtRw) {
                        if (typeof lastPostAtRw === 'object' && 'toDate' in lastPostAtRw) {
                            lastPostAtDt = (lastPostAtRw as { toDate: () => Date }).toDate();
                        } else if (typeof lastPostAtRw === 'object' && 'seconds' in lastPostAtRw) {
                            lastPostAtDt = new Date(lastPostAtRw.seconds * 1000);
                        } else {
                            lastPostAtDt = new Date(lastPostAtRw as string | number | Date);
                        }
                    }

                    const streakRes = StreakEngine.calculateNextStreak({
                        streakCount: Number(uData.streakCount || uData.streak || 0),
                        highestStreak: Number(uData.highestStreak || uData.streak || 0),
                        lastPostDate: uData.lastPostDate || null,
                        lastPostAt: lastPostAtDt,
                        timeZone: tz
                    }, { now: currentNow, clientTimeZone });

                    const { newStreak: streakCountNew, streakUpdated: hasStreakUpdated } = streakRes;

                    const allLatestGids = [...new Set([...groupsToPost, ...(hasStreakUpdated && streakCountNew > 0 ? uGroupIds : [])])];
                    const latRefs = allLatestGids.map(gid => db.collection('groups').doc(gid).collection('messages_latest').doc('latest'));
                    
                    let latSnaps: admin.firestore.DocumentSnapshot[] = [];
                    if (allLatestGids.length > 0) {
                        latSnaps = await transaction.getAll(...latRefs);
                    }


                    const bootStamps: Record<string, Record<string, unknown>[]> = {};
                    for (let i = 0; i < allLatestGids.length; i++) {
                        const gid = allLatestGids[i];
                        const latestSnap = latSnaps[i];
                        if (!latestSnap || !latestSnap.exists) {
                            const bootSnap = await transaction.get(
                                db.collection('groups').doc(gid).collection('messages')
                                    .orderBy('createdAt', 'desc')
                                    .limit(24)
                            );
                            bootStamps[gid] = bootSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse();
                        } else {
                            bootStamps[gid] = latestSnap.data()?.messages || [];
                        }
                    }

                    return {
                        userData: uData,
                        userGroupIds: uGroupIds,
                        groupsToPostTo: groupsToPost,
                        existingSharedIds: extSharedIds,
                        now: currentNow,
                        streakResult: streakRes,
                        messagesInGroup: bootStamps,
                        existingNoteExists: !!(existingNoteSnap && existingNoteSnap.exists),
                        allLatestGids
                    };
                })();

                const { newStreak, currentHighest, today, streakUpdated } = streakResult;
                const timeZone = userData.timeZone || 'UTC';

                // --- PHASE 2: WRITE PHASE ---
                const userUpdate: admin.firestore.UpdateData<UserDocument> = {
                    lastPostAt: admin.firestore.Timestamp.fromDate(now),
                    questPostedNote: true
                };

                if (!existingNoteExists) {
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
                    if (!userGroupIds.includes(gid) || existingSharedIds[gid]) continue;

                    const gRef = db.collection('groups').doc(gid);
                    const msgRef = gRef.collection('messages').doc();
                    sharedMessageIds[gid] = msgRef.id;

                    const msgData = {
                        text: messageText,
                        senderId: uid,
                        senderNickname: userNickname,
                        senderPhotoURL: userData.photoURL || null,
                        createdAt: serverTime,
                        isNote: true,
                        originalNoteId: noteRef.id,
                        scripture,
                        chapter: chapter || "",
                        ...(clientTimestamp ? { clientTimestamp } : {}),
                        expireAt: getMessageExpireAt()
                    };

                    transaction.set(msgRef, msgData);

                    // Update local aggregate messages array
                    const arrayMsg = {
                        id: msgRef.id,
                        ...msgData,
                        createdAt: admin.firestore.Timestamp.now()
                    };
                    messagesInGroup[gid] = [...(messagesInGroup[gid] || []), arrayMsg].slice(-25);



                    const groupUpdate = {
                        lastMessageAt: serverTime,
                        lastNoteAt: serverTime,
                        lastNoteByNickname: userNickname,
                        lastNoteByUid: uid,
                        [`memberLastActive.${uid}`]: serverTime,
                        [`memberLastReadAt.${uid}`]: serverTime,
                        'dailyActivity.activeMembers': admin.firestore.FieldValue.arrayUnion(uid)
                    } as unknown as admin.firestore.UpdateData<GroupDocument>;

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

                // Daily Active User Stats (Moved outside transaction to avoid Read billing & contention)

                // Streak / Total Milestone Announcements
                const newTotal = (userData.daysStudiedCount || 0) + 1;
                const isMilestone = (days: number): boolean => {
                    const fixedMilestones = [3, 7, 10, 21, 30, 50, 100];
                    if (fixedMilestones.includes(days)) return true;
                    if (days > 100 && days % 50 === 0) return true;
                    return false;
                };

                if (streakUpdated) {
                    const safeNickname = this.escapeMarkdown(userNickname);
                    const isMs = isMilestone(newTotal);
                    const announceMsg = isMs
                        ? t(language || 'en', 'notifications.streak_announcement', { nickname: safeNickname, streak: newTotal })
                        : t(language || 'en', 'notifications.note_posted_announcement', { nickname: safeNickname });
                    const botName = t(language || 'en', 'notifications.bot_name');
                    const announceTime = admin.firestore.Timestamp.fromMillis(now.getTime() + 1000);

                    [...new Set(userGroupIds)].forEach(gid => {
                        const gRef = db.collection('groups').doc(gid);
                        const msgRef = gRef.collection('messages').doc();

                        const announceMsgData = {
                            text: announceMsg,
                            senderId: 'system',
                            senderNickname: botName,
                            createdAt: announceTime,
                            isSystemMessage: true,
                            type: isMs ? 'streakAnnouncement' : 'notePostedAnnouncement',
                            messageType: isMs ? 'streakAnnouncement' : 'notePostedAnnouncement',
                            messageData: isMs
                                ? { nickname: userNickname, userId: uid, streakCount: newTotal, isCumulative: true }
                                : { nickname: userNickname, userId: uid },
                            expireAt: getMessageExpireAt()
                        };

                        transaction.set(msgRef, announceMsgData);

                        // Update local aggregate array
                        const arrayAnnounce = {
                            id: msgRef.id,
                            ...announceMsgData,
                            createdAt: admin.firestore.Timestamp.now()
                        };
                        messagesInGroup[gid] = [...(messagesInGroup[gid] || []), arrayAnnounce].slice(-25);


                        transaction.update(gRef, {
                            lastMessageAt: announceTime,
                            lastMessageByNickname: botName,
                            lastMessageByUid: 'system'
                        });
                    });
                }

                // Write final aggregated latest message arrays to Firestore
                for (const gid of allLatestGids) {
                    const latestRef = db.collection('groups').doc(gid).collection('messages_latest').doc('latest');
                    transaction.set(latestRef, {
                        groupId: gid,
                        messages: messagesInGroup[gid] || [],
                        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                }

                return { 
                    personalNoteId: noteRef.id, 
                    sharedMessageIds,
                    newStreak, 
                    streakUpdated, 
                    nickname: userNickname,
                    timeZone,
                    todayStr: today
                };
            }) as { 
                personalNoteId: string, 
                sharedMessageIds: Record<string, string>, 
                newStreak: number, 
                streakUpdated: boolean, 
                nickname: string,
                timeZone: string,
                todayStr: string
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

            // Async Background Sync for Unity, Date Reset and Daily Active User Stats Write
            const backgroundPromise = Promise.all([
                ...groupsToSync.map(async (gid) => {
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

                        const groupUpdate: {
                            dailyActivity?: { date: string; activeMembers: string[] };
                            'dailyActivity.activeMembers'?: admin.firestore.FieldValue;
                            'dailyActivity.date'?: string;
                            unityPercentage?: number;
                        } = {};
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
                }),
                // Daily Active User Stats Write (Outside transaction to avoid Read billing & contention)
                db.collection('dailyStats').doc(result.todayStr).set({
                    activeUsers: admin.firestore.FieldValue.arrayUnion(uid)
                }, { merge: true }).catch(err => {
                    console.error('[NoteService] Failed to write dailyStats in background:', err);
                }),
                // Push Notifications (Now part of the background promise)
                NotificationService.notifyNotePosted({
                    groupIds: [...new Set(userToGroupEntries.map(e => e[1]))],
                    senderUid: uid,
                    senderNickname: result.nickname,
                    language: language || 'en',
                    userToGroupMapEntries: userToGroupEntries
                })
            ]).catch(err => {
                console.error('[NoteService] Background updates failed:', err);
                return null;
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
                const latestRefs = sharedEntries.map(([gid]) => db.collection('groups').doc(gid).collection('messages_latest').doc('latest'));

                // --- 2. BATCH READ: Groups, affected Messages, and latest message arrays ---
                let snapshotResults: admin.firestore.DocumentSnapshot[] = [];
                if (sharedEntries.length > 0) {
                    snapshotResults = typeof transaction.getAll === 'function'
                        ? await transaction.getAll(...groupRefs, ...msgRefs, ...latestRefs) as admin.firestore.DocumentSnapshot[]
                        : await Promise.all([...groupRefs, ...msgRefs, ...latestRefs].map(ref => transaction.get(ref)));
                }
                const groupDocs = snapshotResults.slice(0, sharedEntries.length) as admin.firestore.DocumentSnapshot<GroupDocument>[];
                const msgDocs = snapshotResults.slice(sharedEntries.length, sharedEntries.length * 2) as admin.firestore.DocumentSnapshot[];
                const latestDocs = snapshotResults.slice(sharedEntries.length * 2) as admin.firestore.DocumentSnapshot[];

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
                    const [groupId, messageId] = sharedEntries[i];
                    const gSnap = groupDocs[i];
                    const mSnap = msgDocs[i];
                    const meta = queryMetadata[i];
                    if (!gSnap.exists || !mSnap.exists) continue;

                    const updatePayload: admin.firestore.UpdateData<GroupDocument> = {};

                    // Update latest aggregate document
                    const latestSnap = latestDocs[i];
                    if (latestSnap && latestSnap.exists) {
                        const messages = (latestSnap.data()?.messages || []) as Record<string, unknown>[];
                        const updatedMessages = messages.filter(m => m.id !== messageId);
                        const latestRef = db.collection('groups').doc(groupId).collection('messages_latest').doc('latest');
                        transaction.update(latestRef, { messages: updatedMessages });
                    }

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
