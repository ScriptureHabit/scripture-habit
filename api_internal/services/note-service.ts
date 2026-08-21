/* eslint-disable no-restricted-properties */
import { admin, db } from '../lib/firebase-admin.js';
import { UserDocument, GroupDocument } from '../../types/firestore.js';
import { NotFoundError } from '../lib/errors.js';
import { buildNoteSearchTokens } from '../lib/search-utils.js';
import { t } from '../lib/i18n.js';
import { StreakEngine, StreakResult } from '../lib/streak-engine.js';
import { NotificationService } from './notification-service.js';
import { formatDateInTimeZone, normalizeDateString } from '../../src/utils/time-utils.js';
import { calculateUnityPercentage } from '../../src/utils/unity-utils.js';
import { Group } from '../../src/types/chat.js';
import { getMessageExpireAt, getDemoExpireAt } from '../lib/ttl-utils.js';

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

interface PostNoteReadContext {
    uid: string;
    userData: UserDocument;
    userNickname: string;
    userGroupIds: string[];
    groupsToPostTo: string[];
    existingSharedIds: Record<string, string>;
    now: Date;
    streakResult: StreakResult;
    messagesInGroup: Record<string, Record<string, unknown>[]>;
    existingNoteExists: boolean;
    groupDocsMap: Record<string, GroupDocument>;
}

interface PostNoteTransactionResult {
    personalNoteId: string;
    sharedMessageIds: Record<string, string>;
    newStreak: number;
    streakUpdated: boolean;
    nickname: string;
    timeZone: string;
    todayStr: string;
}

interface DeleteNoteReadContext {
    sharedEntries: [string, string][];
    groupDocs: admin.firestore.DocumentSnapshot<GroupDocument>[];
    msgDocs: admin.firestore.DocumentSnapshot[];
    latestDocs: admin.firestore.DocumentSnapshot[];
    queryMetadata: {
        groupId: string;
        messageId: string;
        needsNextNote: boolean;
        needsTodayNotes: boolean;
    }[];
    querySnaps: admin.firestore.QuerySnapshot[];
}

// --- Utility Helpers ---

function parseFirestoreDate(raw: unknown): Date | null {
    if (!raw) return null;
    if (typeof raw === 'object' && raw !== null) {
        if ('toDate' in raw && typeof (raw as { toDate: () => unknown }).toDate === 'function') {
            return (raw as { toDate: () => Date }).toDate();
        }
        if ('seconds' in raw && typeof (raw as { seconds: number }).seconds === 'number') {
            return new Date((raw as { seconds: number }).seconds * 1000);
        }
    }
    return new Date(raw as string | number | Date);
}

function isStreakMilestone(days: number): boolean {
    const fixedMilestones = [3, 7, 10, 21, 30, 50, 100];
    if (fixedMilestones.includes(days)) return true;
    if (days > 100 && days % 50 === 0) return true;
    return false;
}

function appendLatestMessage(
    messagesInGroup: Record<string, Record<string, unknown>[]>,
    gid: string,
    msg: Record<string, unknown>,
    limit = 25
): void {
    messagesInGroup[gid] = [...(messagesInGroup[gid] || []), msg].slice(-limit);
}

export class NoteService {
    private static escapeMarkdown(text: string) {
        return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
    }

    // ==========================================
    // POST NOTE
    // ==========================================

    static async postNote(input: PostNoteInput) {
        const { uid, shareOption, selectedShareGroups, language, timeZone: clientTimeZone, optimisticId } = input;
        const scripture = input.scripture.trim();
        const chapter = input.chapter?.trim().replace(/^0+/, '') || "";

        console.log(`[NoteService] postNote called by uid=${uid}, shareOption=${shareOption}, selectedShareGroups=${JSON.stringify(selectedShareGroups)}`);

        try {
            const result = await db.runTransaction(async (transaction) => {
                const userRef = db.collection('users').doc(uid);
                const noteRef = optimisticId
                    ? userRef.collection('notes').doc(optimisticId)
                    : userRef.collection('notes').doc();

                // --- PHASE 1: READ & CALCULATION PHASE (Strict Read-before-Write) ---
                const context = await this.fetchPostNoteReadContext(transaction, userRef, noteRef, input);

                // --- PHASE 2: WRITE PHASE ---
                this.applyUserDocUpdates(transaction, userRef, context, clientTimeZone);

                const sharedMessageIds = this.applyGroupNoteMessages(
                    transaction,
                    userRef,
                    noteRef,
                    context,
                    input,
                    scripture,
                    chapter
                );

                this.applyPersonalNote(
                    transaction,
                    noteRef,
                    input,
                    scripture,
                    chapter,
                    sharedMessageIds,
                    context.now
                );

                this.applyStreakAnnouncements(transaction, userRef, context, language);

                this.applyAiPartnerCongratulation(transaction, context);

                this.applyDemoGroupBotCongratulations(transaction, context);

                this.applyLatestMessagesCache(transaction, context);

                return {
                    personalNoteId: noteRef.id,
                    sharedMessageIds,
                    newStreak: context.streakResult.newStreak,
                    streakUpdated: context.streakResult.streakUpdated,
                    nickname: context.userNickname,
                    timeZone: context.userData.timeZone || 'UTC',
                    todayStr: context.streakResult.today
                } satisfies PostNoteTransactionResult;
            });

            // Post-transaction Async Operations (Reads & writes outside transaction)
            const backgroundPromise = this.executePostNoteBackgroundTasks(result, uid, language);

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

    private static async fetchPostNoteReadContext(
        transaction: admin.firestore.Transaction,
        userRef: admin.firestore.DocumentReference,
        noteRef: admin.firestore.DocumentReference,
        input: PostNoteInput
    ): Promise<PostNoteReadContext> {
        const { shareOption, selectedShareGroups, timeZone: clientTimeZone, optimisticId } = input;

        const [userSnap, existingNoteSnap] = await Promise.all([
            transaction.get(userRef),
            optimisticId ? transaction.get(noteRef) : Promise.resolve(null)
        ]) as [admin.firestore.DocumentSnapshot<UserDocument>, admin.firestore.DocumentSnapshot | null];

        if (!userSnap.exists) throw new NotFoundError('User not found.');
        const uData = userSnap.data()!;
        const uGroupIds: string[] = uData.groupIds || (uData.groupId ? [uData.groupId] : []);

        let groupsToPostTo: string[] = [];
        if (shareOption === 'all') groupsToPostTo = uGroupIds;
        else if (shareOption === 'specific') groupsToPostTo = (selectedShareGroups || []).filter(gid => uGroupIds.includes(gid));
        else if (shareOption === 'current' && uData.groupId && uGroupIds.includes(uData.groupId)) groupsToPostTo = [uData.groupId];

        groupsToPostTo = [...new Set(groupsToPostTo.filter(gid => !!gid))].slice(0, 20);
        console.log(`[NoteService] User uGroupIds=${JSON.stringify(uGroupIds)}, activeGroupId=${uData.groupId}, calculated groupsToPostTo=${JSON.stringify(groupsToPostTo)}`);

        const extNote = existingNoteSnap ? existingNoteSnap.data() : undefined;
        const extSharedIds = extNote?.sharedMessageIds || {};
        const currentNow = new Date();
        const tz = uData.timeZone || 'UTC';
        const lastPostAtDt = parseFirestoreDate(uData.lastPostAt);

        const streakRes = StreakEngine.calculateNextStreak({
            streakCount: Number(uData.streakCount || uData.streak || 0),
            highestStreak: Number(uData.highestStreak || uData.streak || 0),
            lastPostDate: uData.lastPostDate || null,
            lastPostAt: lastPostAtDt,
            timeZone: tz
        }, { now: currentNow, clientTimeZone });

        const latRefs = groupsToPostTo.map(gid => db.collection('groups').doc(gid).collection('messages_latest').doc('latest'));

        let latSnaps: admin.firestore.DocumentSnapshot[] = [];
        if (groupsToPostTo.length > 0) {
            latSnaps = await transaction.getAll(...latRefs);
        }

        const bootStamps: Record<string, Record<string, unknown>[]> = {};
        for (let i = 0; i < groupsToPostTo.length; i++) {
            const gid = groupsToPostTo[i];
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

        const groupDocSnaps = groupsToPostTo.length > 0
            ? await transaction.getAll(...groupsToPostTo.map(gid => db.collection('groups').doc(gid)))
            : [];
        const groupDocsMap: Record<string, GroupDocument> = {};
        groupDocSnaps.forEach(gsnap => {
            if (gsnap.exists) {
                groupDocsMap[gsnap.id] = gsnap.data() as GroupDocument;
            }
        });

        return {
            uid: input.uid,
            userData: uData,
            userNickname: uData.nickname || 'Member',
            userGroupIds: uGroupIds,
            groupsToPostTo,
            existingSharedIds: extSharedIds,
            now: currentNow,
            streakResult: streakRes,
            messagesInGroup: bootStamps,
            existingNoteExists: !!(existingNoteSnap && existingNoteSnap.exists),
            groupDocsMap
        };
    }

    private static applyUserDocUpdates(
        transaction: admin.firestore.Transaction,
        userRef: admin.firestore.DocumentReference,
        context: PostNoteReadContext,
        clientTimeZone?: string | null
    ): void {
        const { userData, now, existingNoteExists, streakResult } = context;
        const { newStreak, currentHighest, today, streakUpdated } = streakResult;

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
    }

    private static applyGroupNoteMessages(
        transaction: admin.firestore.Transaction,
        userRef: admin.firestore.DocumentReference,
        noteRef: admin.firestore.DocumentReference,
        context: PostNoteReadContext,
        input: PostNoteInput,
        scripture: string,
        chapter: string
    ): Record<string, string> {
        const { uid, messageText, clientTimestamp } = input;
        const { groupsToPostTo, userGroupIds, existingSharedIds, userNickname, userData, now, messagesInGroup } = context;
        const sharedMessageIds: Record<string, string> = { ...existingSharedIds };
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
            appendLatestMessage(messagesInGroup, gid, arrayMsg);

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

        return sharedMessageIds;
    }

    private static applyPersonalNote(
        transaction: admin.firestore.Transaction,
        noteRef: admin.firestore.DocumentReference,
        input: PostNoteInput,
        scripture: string,
        chapter: string,
        sharedMessageIds: Record<string, string>,
        now: Date
    ): void {
        const { messageText, comment, title, speaker, shareOption } = input;
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
    }

    private static applyStreakAnnouncements(
        transaction: admin.firestore.Transaction,
        userRef: admin.firestore.DocumentReference,
        context: PostNoteReadContext,
        language?: string | null
    ): void {
        const { streakResult, userData, userNickname, now, groupsToPostTo, messagesInGroup, uid } = context;
        const { streakUpdated } = streakResult;

        if (!streakUpdated) return;

        const newTotal = (userData.daysStudiedCount || 0) + 1;
        const safeNickname = this.escapeMarkdown(userNickname);
        const isMs = isStreakMilestone(newTotal);
        const announceMsg = isMs
            ? t(language || 'en', 'notifications.streak_announcement', { nickname: safeNickname, streak: newTotal })
            : t(language || 'en', 'notifications.note_posted_announcement', { nickname: safeNickname });
        const botName = t(language || 'en', 'notifications.bot_name');
        const announceTime = admin.firestore.Timestamp.fromMillis(now.getTime() + 500);

        [...new Set(groupsToPostTo)].forEach(gid => {
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

            const arrayAnnounce = {
                id: msgRef.id,
                ...announceMsgData,
                createdAt: announceTime
            };
            appendLatestMessage(messagesInGroup, gid, arrayAnnounce);

            transaction.update(gRef, {
                lastMessageAt: announceTime,
                lastMessageByNickname: botName,
                lastMessageByUid: 'system',
                [`memberLastReadAt.${uid}`]: announceTime
            });

            const userGS = userRef.collection('groupStates').doc(gid);
            transaction.set(userGS, {
                lastReadAt: announceTime
            }, { merge: true });
        });
    }

    private static applyAiPartnerCongratulation(
        transaction: admin.firestore.Transaction,
        context: PostNoteReadContext
    ): void {
        const { uid, groupsToPostTo, userGroupIds, existingSharedIds, groupDocsMap, userData, now, messagesInGroup } = context;

        for (const gid of groupsToPostTo) {
            if (!userGroupIds.includes(gid) || existingSharedIds[gid]) continue;

            const gData = groupDocsMap[gid];
            const isAiGroup = Boolean(gData?.isAiGroup || gData?.aiCompanionUid === 'ai-partner-bot');
            console.log(`[NoteService AI Check] Group ID: ${gid}, gDataExists: ${!!gData}, isAiGroup: ${isAiGroup}, aiCompanionUid: ${gData?.aiCompanionUid}`);

            if (isAiGroup) {
                const userLang = userData.language || 'ja';
                const gTz = gData?.timeZone || userData.timeZone || 'Asia/Tokyo';
                const todayStr = formatDateInTimeZone(now, gTz);

                const botNickname = t(userLang, 'groupChat.aiGroupBotNickname');
                const congratText = t(userLang, 'groupChat.aiGroupUserNoteCongratulation');

                const congratDocId = `ai_congrat_${todayStr}`;
                const gRef = db.collection('groups').doc(gid);
                const aiCongratMsgRef = gRef.collection('messages').doc(congratDocId);
                const congratTime = admin.firestore.Timestamp.fromMillis(now.getTime() + 1000);

                console.log(`[NoteService AI Congratulation] Posting AI response to group ${gid}: "${congratText}" (Doc ID: ${congratDocId})`);

                const aiMsgData = {
                    id: congratDocId,
                    text: congratText,
                    senderId: 'ai-partner-bot',
                    senderNickname: botNickname,
                    senderPhotoURL: '/images/mascot.webp',
                    createdAt: congratTime,
                    isSystemMessage: false,
                    isNote: false,
                    expireAt: getMessageExpireAt()
                };

                transaction.set(aiCongratMsgRef, aiMsgData, { merge: true });

                appendLatestMessage(messagesInGroup, gid, aiMsgData);

                transaction.update(gRef, {
                    lastMessageAt: congratTime,
                    lastMessageByNickname: botNickname,
                    lastMessageByUid: 'ai-partner-bot',
                    'dailyActivity.date': todayStr,
                    'dailyActivity.activeMembers': admin.firestore.FieldValue.arrayUnion(uid, 'ai-partner-bot')
                });
            }
        }
    }

    private static applyDemoGroupBotCongratulations(
        transaction: admin.firestore.Transaction,
        context: PostNoteReadContext
    ): void {
        const { groupsToPostTo, userGroupIds, existingSharedIds, groupDocsMap, userData, userNickname, now, messagesInGroup } = context;

        for (const gid of groupsToPostTo) {
            if (!userGroupIds.includes(gid) || existingSharedIds[gid]) continue;

            const gData = groupDocsMap[gid];
            const isDemoGroup = Boolean(gData?.isDemoGroup);

            if (isDemoGroup) {
                const userLang = userData.language || 'ja';
                const baseTimeMs = now.getTime() + 1500;
                const safeNickname = userNickname;

                const botCelebrations = [
                    {
                        id: `demo-celeb-alice-${now.getTime()}`,
                        senderId: 'bot-alice',
                        senderNickname: 'Alice 📖',
                        userPhotoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=Alice',
                        text: t(userLang, 'onboardingQuest.demoCelebrateAlice', { nickname: safeNickname }),
                        createdAt: admin.firestore.Timestamp.fromMillis(baseTimeMs + 200),
                        isSystemMessage: false,
                        isNote: false,
                        expireAt: getDemoExpireAt()
                    },
                    {
                        id: `demo-celeb-bob-${now.getTime()}`,
                        senderId: 'bot-bob',
                        senderNickname: 'Bob 🔥',
                        userPhotoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=Bob',
                        text: t(userLang, 'onboardingQuest.demoCelebrateBob', { nickname: safeNickname }),
                        createdAt: admin.firestore.Timestamp.fromMillis(baseTimeMs + 400),
                        isSystemMessage: false,
                        isNote: false,
                        expireAt: getDemoExpireAt()
                    },
                    {
                        id: `demo-celeb-charlie-${now.getTime()}`,
                        senderId: 'bot-charlie',
                        senderNickname: 'Charlie 💤',
                        userPhotoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=Charlie',
                        text: t(userLang, 'onboardingQuest.demoCelebrateCharlie', { nickname: safeNickname }),
                        createdAt: admin.firestore.Timestamp.fromMillis(baseTimeMs + 600),
                        isSystemMessage: false,
                        isNote: false,
                        expireAt: getDemoExpireAt()
                    }
                ];

                const gRef = db.collection('groups').doc(gid);
                for (const bMsg of botCelebrations) {
                    const msgRef = gRef.collection('messages').doc(bMsg.id);
                    transaction.set(msgRef, bMsg, { merge: true });
                    appendLatestMessage(messagesInGroup, gid, bMsg);
                }

                transaction.update(gRef, {
                    lastMessageAt: admin.firestore.Timestamp.fromMillis(baseTimeMs + 600),
                    lastMessageByNickname: 'Charlie 💤',
                    lastMessageByUid: 'bot-charlie'
                });
            }
        }
    }

    private static applyLatestMessagesCache(
        transaction: admin.firestore.Transaction,
        context: PostNoteReadContext
    ): void {
        for (const gid of context.groupsToPostTo) {
            const latestRef = db.collection('groups').doc(gid).collection('messages_latest').doc('latest');
            transaction.set(latestRef, {
                groupId: gid,
                messages: context.messagesInGroup[gid] || [],
                lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
    }

    private static async executePostNoteBackgroundTasks(
        result: PostNoteTransactionResult,
        uid: string,
        language?: string | null
    ): Promise<unknown> {
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

        return Promise.all([
            ...groupsToSync.map(async (gid) => {
                try {
                    const groupRef = db.collection('groups').doc(gid);

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
            // Daily Active User Stats Write
            db.collection('dailyStats').doc(result.todayStr).set({
                activeUsers: admin.firestore.FieldValue.arrayUnion(uid)
            }, { merge: true }).catch(err => {
                console.error('[NoteService] Failed to write dailyStats in background:', err);
            }),
            // Push Notifications (only if shared to groups)
            groupsToSync.length > 0
                ? NotificationService.notifyNotePosted({
                    groupIds: [...new Set(userToGroupEntries.map(e => e[1]))],
                    senderUid: uid,
                    senderNickname: result.nickname,
                    language: language || 'en',
                    userToGroupMapEntries: userToGroupEntries
                })
                : Promise.resolve(null)
        ]).catch(err => {
            console.error('[NoteService] Background updates failed:', err);
            return null;
        });
    }

    // ==========================================
    // DELETE NOTE
    // ==========================================

    static async deleteNote(uid: string, noteId: string) {
        const userRef = db.collection('users').doc(uid);
        const noteRef = userRef.collection('notes').doc(noteId);

        try {
            await db.runTransaction(async (transaction) => {
                const readContext = await this.fetchDeleteNoteReadContext(transaction, noteRef, uid);
                await this.applyDeleteNoteWrites(transaction, userRef, noteRef, uid, readContext);
            });
            return { success: true };
        } catch (error) {
            console.error('[NoteService] DeleteNote Transaction Error:', error);
            throw error;
        }
    }

    private static async fetchDeleteNoteReadContext(
        transaction: admin.firestore.Transaction,
        noteRef: admin.firestore.DocumentReference,
        uid: string
    ): Promise<DeleteNoteReadContext> {
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
        const queryMetadata: DeleteNoteReadContext['queryMetadata'] = [];
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
                        .limit(5)
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

        return {
            sharedEntries,
            groupDocs,
            msgDocs,
            latestDocs,
            queryMetadata,
            querySnaps
        };
    }

    private static applyDeleteNoteWrites(
        transaction: admin.firestore.Transaction,
        userRef: admin.firestore.DocumentReference,
        noteRef: admin.firestore.DocumentReference,
        uid: string,
        readContext: DeleteNoteReadContext
    ): void {
        const { sharedEntries, groupDocs, msgDocs, latestDocs, queryMetadata, querySnaps } = readContext;
        let snapIdx = 0;

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
    }
}
