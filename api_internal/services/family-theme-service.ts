/* eslint-disable no-restricted-properties */
import { admin, db } from '../lib/firebase-admin.js';
import { UserDocument, GroupDocument, FamilyThemeSession } from '../../types/firestore.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../lib/errors.js';
import { t } from '../lib/i18n.js';
import { StreakEngine } from '../lib/streak-engine.js';
import { formatDateInTimeZone } from '../../src/utils/time-utils.js';
import { getMessageExpireAt } from '../lib/ttl-utils.js';
import { buildNoteSearchTokens } from '../lib/search-utils.js';

export interface SelectThemeInput {
    groupId: string;
    uid: string;
    themeId: string;
    clientTimeZone?: string | null;
}

export interface SelectThemeResult {
    matched: boolean;
    matchedTheme?: string | null;
    completedAt?: string | null;
    selections: Record<string, string>;
    completedBy?: string[];
    streakUpdated?: boolean;
    newStreak?: number;
    daysStudiedCount?: number;
}

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

export class FamilyThemeService {
    /**
     * Select a theme for family synchronous study check-in.
     */
    static async selectTheme(input: SelectThemeInput): Promise<SelectThemeResult> {
        const { groupId, uid, themeId, clientTimeZone } = input;

        return await db.runTransaction(async (transaction) => {
            // =========================================================================
            // PHASE 1: READ PHASE (Strict: All reads before any writes)
            // =========================================================================

            // 1. Read target group
            const groupRef = db.collection('groups').doc(groupId);
            const groupDoc = await transaction.get(groupRef);

            if (!groupDoc.exists || groupDoc.data()?.isDeleted) {
                throw new NotFoundError('Group not found');
            }

            const groupData = groupDoc.data() as GroupDocument;

            if (!groupData.isFamilySyncEnabled) {
                throw new ValidationError('Family sync mode is not enabled for this group');
            }

            const members = groupData.members || [];
            if (!members.includes(uid)) {
                throw new ForbiddenError('You are not a member of this group');
            }

            const groupTimeZone = groupData.timeZone || clientTimeZone || 'Asia/Tokyo';
            const now = new Date();
            const groupToday = formatDateInTimeZone(now, groupTimeZone);

            const session = groupData.familyThemeSession;

            // Check if already matched and completed today (Idempotent return)
            if (session && session.date === groupToday && session.matchedTheme && session.completedAt) {
                const completedAtDate = parseFirestoreDate(session.completedAt) || new Date();
                return {
                    matched: true,
                    matchedTheme: session.matchedTheme,
                    completedAt: completedAtDate.toISOString(),
                    selections: session.selections || {},
                    completedBy: session.completedBy || [],
                    streakUpdated: false
                };
            }

            // Prepare selections
            const selections: Record<string, string> =
                session && session.date === groupToday && session.selections
                    ? { ...session.selections }
                    : {};

            selections[uid] = themeId;

            // Evaluate match (2 or more members select the same theme)
            const themeCounts: Record<string, string[]> = {};
            for (const [u, tId] of Object.entries(selections)) {
                if (!themeCounts[tId]) themeCounts[tId] = [];
                themeCounts[tId].push(u);
            }

            let matchedThemeId: string | null = null;
            let matchedUsers: string[] = [];

            for (const [tId, uids] of Object.entries(themeCounts)) {
                if (uids.length >= 2) {
                    matchedThemeId = tId;
                    matchedUsers = uids;
                    break;
                }
            }

            // Case A: Not matched yet -> no further reads needed
            if (!matchedThemeId) {
                const updatedSession: FamilyThemeSession = {
                    date: groupToday,
                    selections,
                    matchedTheme: null,
                    completedAt: null,
                    completedBy: []
                };

                // Single write
                transaction.update(groupRef, { familyThemeSession: updatedSession });

                return {
                    matched: false,
                    matchedTheme: null,
                    selections,
                    completedBy: [],
                    streakUpdated: false
                };
            }

            // Case B: MATCHED! Read member users & potential other groups
            const userDocs = await Promise.all(
                members.map((mUid) => transaction.get(db.collection('users').doc(mUid)))
            );

            const userMap: Record<string, UserDocument> = {};
            const otherGidSet = new Set<string>();

            for (const uDoc of userDocs) {
                if (uDoc.exists) {
                    const uData = uDoc.data() as UserDocument;
                    userMap[uDoc.id] = uData;
                    if (matchedUsers.includes(uDoc.id)) {
                        (uData.groupIds || []).forEach((gid) => {
                            if (gid !== groupId) otherGidSet.add(gid);
                        });
                    }
                }
            }

            // Read all other groups before any writes
            const otherGidList = Array.from(otherGidSet);
            const otherGroupDocs = await Promise.all(
                otherGidList.map((gid) => transaction.get(db.collection('groups').doc(gid)))
            );

            const otherGroupMap: Record<string, GroupDocument> = {};
            for (const gDoc of otherGroupDocs) {
                if (gDoc.exists && !gDoc.data()?.isDeleted) {
                    otherGroupMap[gDoc.id] = gDoc.data() as GroupDocument;
                }
            }

            // Read latest messages aggregates for all other groups (family group receives no chat messages)
            const otherLatestRefs = otherGidList.map((gid) =>
                db.collection('groups').doc(gid).collection('messages_latest').doc('latest')
            );

            const otherLatestSnaps = await Promise.all(
                otherLatestRefs.map((ref) => transaction.get(ref))
            );

            const otherLatestSnapMap: Record<string, admin.firestore.DocumentSnapshot> = {};
            otherGidList.forEach((gid, idx) => {
                otherLatestSnapMap[gid] = otherLatestSnaps[idx];
            });

            // =========================================================================
            // PHASE 2: WRITE PHASE (All writes executed here)
            // =========================================================================
            const serverTime = admin.firestore.Timestamp.fromDate(now);

            const updatedSession: FamilyThemeSession = {
                date: groupToday,
                selections,
                matchedTheme: matchedThemeId,
                completedAt: serverTime,
                completedBy: matchedUsers
            };

            // 1. Update family group session & activity (Family chat remains quiet/clean)
            transaction.update(groupRef, {
                familyThemeSession: updatedSession,
                'dailyActivity.date': groupToday,
                'dailyActivity.activeMembers': admin.firestore.FieldValue.arrayUnion(...members) as unknown as string[],
                unityPercentage: 100
            });

            // 3. Update each family member's streak, total days, studied dates
            let callerStreakUpdated = false;
            let callerNewStreak = userMap[uid]?.streakCount || 0;
            let callerNewDays = userMap[uid]?.daysStudiedCount || 0;

            for (const mUid of members) {
                const uData = userMap[mUid];
                if (!uData) continue;

                const userRef = db.collection('users').doc(mUid);
                const userTz = uData.timeZone || clientTimeZone || 'Asia/Tokyo';
                const userToday = formatDateInTimeZone(now, userTz);
                const studiedDates = (uData.studiedDates || []) as string[];

                if (!studiedDates.includes(userToday)) {
                    const streakResult = StreakEngine.calculateNextStreak(
                        {
                            streakCount: uData.streakCount || 0,
                            highestStreak: uData.highestStreak || 0,
                            lastPostDate: uData.lastPostDate || null,
                            lastPostAt: parseFirestoreDate(uData.lastPostAt),
                            timeZone: userTz
                        },
                        { now, clientTimeZone: userTz }
                    );

                    const userUpdate: admin.firestore.UpdateData<UserDocument> = {
                        daysStudiedCount: admin.firestore.FieldValue.increment(1),
                        streakCount: streakResult.newStreak,
                        lastPostDate: userToday,
                        lastPostAt: serverTime,
                        studiedDates: admin.firestore.FieldValue.arrayUnion(userToday) as unknown as string[]
                    };

                    if (streakResult.newStreak > (uData.highestStreak || 0)) {
                        userUpdate.highestStreak = streakResult.newStreak;
                    }

                    transaction.update(userRef, userUpdate);

                    if (mUid === uid) {
                        callerStreakUpdated = true;
                        callerNewStreak = streakResult.newStreak;
                        callerNewDays = (uData.daysStudiedCount || 0) + 1;
                    }
                }
            }

            // 4. Propagate to other groups of matched users
            const otherGroupMessagesToAppend: Record<string, Record<string, unknown>[]> = {};
            for (const gid of otherGidList) {
                otherGroupMessagesToAppend[gid] = [];
            }

            for (const mUid of matchedUsers) {
                const uData = userMap[mUid];
                if (!uData) continue;

                const userNickname = uData.nickname || 'Member';
                const userLang = (uData as Record<string, unknown>).language as string || 'ja';
                const otherGroupIds = (uData.groupIds || []).filter((gid) => gid !== groupId);

                const categoryName = t(userLang, 'familyTheme.categoryFamilyStudy') || '家族学習';
                const themeName = t(userLang, `familyTheme.themes.${matchedThemeId}`) || matchedThemeId;
                const noteComment = t(userLang, 'familyTheme.familyStudyNoteBody', {
                    theme: themeName
                });
                const noteText = `**${categoryName} ${themeName}**\n\n${noteComment}`;

                // 1. Prepare personal note reference & tracking
                const noteRef = db.collection('users').doc(mUid).collection('notes').doc();
                const sharedMessageIds: Record<string, string> = {};

                for (const otherGid of otherGroupIds) {
                    const otherGData = otherGroupMap[otherGid];
                    if (!otherGData) continue;

                    const otherGRef = db.collection('groups').doc(otherGid);
                    const isAiGroup = Boolean(
                        otherGData.isAiGroup || otherGData.aiCompanionUid === 'ai-partner-bot'
                    );

                    // Add member to dailyActivity of other group & update last note / last message
                    transaction.update(otherGRef, {
                        lastMessageAt: serverTime,
                        lastMessageByNickname: userNickname,
                        lastMessageByUid: mUid,
                        lastNoteAt: serverTime,
                        lastNoteByNickname: userNickname,
                        lastNoteByUid: mUid,
                        [`memberLastActive.${mUid}`]: serverTime,
                        [`memberLastReadAt.${mUid}`]: serverTime,
                        'dailyActivity.activeMembers': admin.firestore.FieldValue.arrayUnion(mUid) as unknown as string[]
                    });

                    // Post family study note as regular note message
                    const otherMsgRef = otherGRef.collection('messages').doc();
                    sharedMessageIds[otherGid] = otherMsgRef.id;

                    const otherMsgData = {
                        id: otherMsgRef.id,
                        text: noteText,
                        senderId: mUid,
                        senderNickname: userNickname,
                        senderPhotoURL: uData.photoURL || null,
                        createdAt: serverTime,
                        isSystemMessage: false,
                        isNote: true,
                        originalNoteId: noteRef.id,
                        scripture: 'familyStudy',
                        chapter: matchedThemeId,
                        comment: noteComment,
                        expireAt: getMessageExpireAt()
                    };
                    transaction.set(otherMsgRef, otherMsgData);
                    otherGroupMessagesToAppend[otherGid]?.push({
                        ...otherMsgData,
                        createdAt: admin.firestore.Timestamp.now()
                    });

                    // Send note posted announcement to group chat
                    const safeNickname = userNickname.replace(/([\\`*_{}[\]()#+\-.!])/g, '\\$1');
                    const announceText = t('ja', 'notifications.note_posted_announcement', {
                        nickname: safeNickname
                    });
                    const botName = t('ja', 'notifications.bot_name') || 'Scripture Habit';
                    const announceTime = admin.firestore.Timestamp.fromMillis(now.getTime() + 500);

                    const announceMsgRef = otherGRef.collection('messages').doc();
                    const announceMsgData = {
                        id: announceMsgRef.id,
                        text: announceText,
                        senderId: 'system',
                        senderNickname: botName,
                        createdAt: announceTime,
                        isSystemMessage: true,
                        type: 'notePostedAnnouncement',
                        messageType: 'notePostedAnnouncement',
                        messageData: { nickname: userNickname, userId: mUid },
                        expireAt: getMessageExpireAt()
                    };
                    transaction.set(announceMsgRef, announceMsgData);
                    otherGroupMessagesToAppend[otherGid]?.push({
                        ...announceMsgData,
                        createdAt: admin.firestore.Timestamp.now()
                    });

                    // If AI Group, AI partner bot posts a warm congratulation
                    if (isAiGroup) {
                        const botNickname = t('ja', 'groupChat.aiGroupBotNickname') || 'AI Companion';
                        const aiCongratText = t('ja', 'familyTheme.aiBotCongratulation', {
                            nickname: userNickname
                        });

                        const aiMsgTime = admin.firestore.Timestamp.fromMillis(now.getTime() + 1000);
                        const aiMsgRef = otherGRef.collection('messages').doc();
                        const aiMsgData = {
                            id: aiMsgRef.id,
                            text: aiCongratText,
                            senderId: 'ai-partner-bot',
                            senderNickname: botNickname,
                            senderPhotoURL: '/images/ai-mascot.webp',
                            createdAt: aiMsgTime,
                            isSystemMessage: false,
                            isNote: false,
                            expireAt: getMessageExpireAt()
                        };

                        transaction.set(aiMsgRef, aiMsgData);
                        otherGroupMessagesToAppend[otherGid]?.push({
                            ...aiMsgData,
                            createdAt: admin.firestore.Timestamp.now()
                        });

                        transaction.update(otherGRef, {
                            lastMessageAt: aiMsgTime,
                            unityPercentage: 100
                        });
                    }
                }

                // Save personal note to user's notes collection
                const personalNoteData = {
                    id: noteRef.id,
                    text: noteText,
                    createdAt: serverTime,
                    scripture: 'familyStudy',
                    chapter: matchedThemeId,
                    title: null,
                    speaker: null,
                    comment: noteComment,
                    shareOption: otherGroupIds.length > 0 ? 'groups' : 'private',
                    sharedWithGroups: Object.keys(sharedMessageIds),
                    sharedMessageIds,
                    searchTokens: buildNoteSearchTokens({
                        scripture: 'familyStudy',
                        chapter: matchedThemeId,
                        comment: noteComment
                    })
                };
                transaction.set(noteRef, personalNoteData);
            }

            // Flush messages_latest updates for other groups
            for (let i = 0; i < otherGidList.length; i++) {
                const otherGid = otherGidList[i];
                const msgsToAppend = otherGroupMessagesToAppend[otherGid] || [];
                if (msgsToAppend.length === 0) continue;

                const otherLatestSnap = otherLatestSnaps[i];
                const otherLatestRef = otherLatestRefs[i];
                const currentOtherMessages: Record<string, unknown>[] =
                    otherLatestSnap && otherLatestSnap.exists
                        ? (otherLatestSnap.data()?.messages || [])
                        : [];
                const updatedOtherMessages = [...currentOtherMessages, ...msgsToAppend].slice(-25);

                transaction.set(otherLatestRef, {
                    groupId: otherGid,
                    messages: updatedOtherMessages,
                    lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }

            return {
                matched: true,
                matchedTheme: matchedThemeId,
                completedAt: serverTime.toDate().toISOString(),
                selections,
                completedBy: matchedUsers,
                streakUpdated: callerStreakUpdated,
                newStreak: callerNewStreak,
                daysStudiedCount: callerNewDays
            };
        });
    }

    /**
     * Toggle family sync mode on a group.
     * Enforces the rule: 1 user can have family sync enabled on at most 1 group.
     */
    static async toggleFamilySync(groupId: string, uid: string, enabled: boolean): Promise<boolean> {
        const groupRef = db.collection('groups').doc(groupId);
        const groupDoc = await groupRef.get();

        if (!groupDoc.exists || groupDoc.data()?.isDeleted) {
            throw new NotFoundError('Group not found');
        }

        const groupData = groupDoc.data() as GroupDocument;
        const members = groupData.members || [];

        if (!members.includes(uid)) {
            throw new ForbiddenError('You are not a member of this group');
        }

        if (enabled) {
            const existingGroupsSnap = await db
                .collection('groups')
                .where('members', 'array-contains', uid)
                .where('isFamilySyncEnabled', '==', true)
                .get();

            const otherEnabled = existingGroupsSnap.docs.filter((d) => d.id !== groupId && !d.data().isDeleted);

            if (otherEnabled.length > 0) {
                throw new ValidationError('familyTheme.alreadyEnabledInOtherGroup');
            }
        }

        await groupRef.update({
            isFamilySyncEnabled: enabled
        });

        return enabled;
    }
}
