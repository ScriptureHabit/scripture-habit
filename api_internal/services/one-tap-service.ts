/* eslint-disable no-restricted-properties */
import { admin, db } from '../lib/firebase-admin.js';
import { UserDocument, GroupDocument } from '../../types/firestore.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import { t } from '../lib/i18n.js';
import { StreakEngine } from '../lib/streak-engine.js';
import { formatDateInTimeZone } from '../../src/utils/time-utils.js';
import { getMessageExpireAt, getDemoExpireAt } from '../lib/ttl-utils.js';
import { buildNoteSearchTokens } from '../lib/search-utils.js';
import { calculateUnityPercentage } from '../../src/utils/unity-utils.js';
import { Group } from '../../src/types/chat.js';
import { formatNoteText } from '../../src/utils/note-logic.js';
import { NotificationService } from './notification-service.js';


export const VALID_THEMES = [
    'faith',
    'hope',
    'charity',
    'gratitude',
    'prayer',
    'patience',
    'repentance',
    'guidance'
] as const;

export type ThemeId = typeof VALID_THEMES[number];

export interface OneTapStudyInput {
    uid: string;
    themeId: string;
    clientTimeZone?: string | null;
}

export interface OneTapStudyResult {
    success: boolean;
    themeId: string;
    streakCount: number;
    daysStudiedCount: number;
    streakUpdated: boolean;
    todayStr: string;
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

function escapeMarkdown(text: string): string {
    return text.replace(/([\\`*_{}[\]()#+\-.!~>|])/g, '\\$1');
}

function isStreakMilestone(days: number): boolean {
    if (!days || days <= 0) return false;
    return days === 10 || days % 25 === 0;
}

export class OneTapService {
    /**
     * Complete today's scripture study in one tap by selecting a theme.
     */
    static async completeStudy(input: OneTapStudyInput): Promise<OneTapStudyResult> {
        const { uid, themeId, clientTimeZone } = input;

        if (!VALID_THEMES.includes(themeId as ThemeId)) {
            throw new ValidationError(`Invalid theme: ${themeId}`);
        }

        const result = await db.runTransaction(async (transaction) => {
            // =========================================================================
            // PHASE 1: READ PHASE
            // =========================================================================
            const userRef = db.collection('users').doc(uid);
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) {
                throw new NotFoundError('User not found');
            }

            const userData = userDoc.data() as UserDocument;
            const now = new Date();
            const userTz = userData.timeZone || clientTimeZone || 'Asia/Tokyo';
            const todayStr = formatDateInTimeZone(now, userTz);

            if (userData.todayThemeDate === todayStr) {
                throw new ValidationError('One-tap study already completed today', 'CONFLICT');
            }

            const userGroupIds = (userData.groupIds && userData.groupIds.length > 0)
                ? userData.groupIds.filter(Boolean)
                : (userData.groupId ? [userData.groupId] : []);

            const groupDocs = await Promise.all(
                userGroupIds.map((gid) => transaction.get(db.collection('groups').doc(gid)))
            );

            const validGroups: { id: string; data: GroupDocument; ref: admin.firestore.DocumentReference }[] = [];
            for (let i = 0; i < groupDocs.length; i++) {
                const gDoc = groupDocs[i];
                if (gDoc.exists && !gDoc.data()?.isDeleted) {
                    validGroups.push({
                        id: userGroupIds[i],
                        data: gDoc.data() as GroupDocument,
                        ref: db.collection('groups').doc(userGroupIds[i])
                    });
                }
            }

            // Read latest aggregate documents for active groups
            const latestSnaps = await Promise.all(
                validGroups.map((g) =>
                    transaction.get(g.ref.collection('messages_latest').doc('latest'))
                )
            );

            // =========================================================================
            // PHASE 2: WRITE PHASE
            // =========================================================================
            const serverTime = admin.firestore.Timestamp.fromDate(now);
            const studiedDates = (userData.studiedDates || []) as string[];
            const alreadyStudiedToday = studiedDates.includes(todayStr);

            let streakUpdated = false;
            let newStreak = userData.streakCount || 0;
            let newDaysCount = userData.daysStudiedCount || 0;

            const userUpdatePayload: admin.firestore.UpdateData<UserDocument> & {
                todayTheme?: string;
                todayThemeDate?: string;
            } = {
                todayTheme: themeId,
                todayThemeDate: todayStr
            };

            if (!alreadyStudiedToday) {
                const streakResult = StreakEngine.calculateNextStreak(
                    {
                        streakCount: userData.streakCount || 0,
                        highestStreak: userData.highestStreak || 0,
                        lastPostDate: userData.lastPostDate || null,
                        lastPostAt: parseFirestoreDate(userData.lastPostAt),
                        timeZone: userTz
                    },
                    { now, clientTimeZone: userTz }
                );

                streakUpdated = true;
                newStreak = streakResult.newStreak;
                newDaysCount = (userData.daysStudiedCount || 0) + 1;

                userUpdatePayload.daysStudiedCount = admin.firestore.FieldValue.increment(1);
                userUpdatePayload.streakCount = newStreak;
                userUpdatePayload.lastPostDate = todayStr;
                userUpdatePayload.lastPostAt = serverTime;
                userUpdatePayload.studiedDates = admin.firestore.FieldValue.arrayUnion(todayStr) as unknown as string[];

                if (newStreak > (userData.highestStreak || 0)) {
                    userUpdatePayload.highestStreak = newStreak;
                }
            }

            transaction.update(userRef, userUpdatePayload);

            // 2. Prepare personal note entry
            const userLang = ((userData as Record<string, unknown>).language as string) || 'ja';
            const userNickname = userData.nickname || 'Member';

            const categoryName = t(userLang, 'oneTapStudy.categoryOneTap') || t('en', 'oneTapStudy.categoryOneTap') || 'One-Tap';
            const themeName = t(userLang, `oneTapStudy.themes.${themeId}`) || t('en', `oneTapStudy.themes.${themeId}`) || themeId;
            const noteComment = t(userLang, 'oneTapStudy.noteBody', { theme: themeName }) || t('en', 'oneTapStudy.noteBody', { theme: themeName }) || '';
            const noteText = formatNoteText(categoryName, themeName, noteComment);

            const noteRef = db.collection('users').doc(uid).collection('notes').doc();
            const noteSearchTokens = buildNoteSearchTokens({
                scripture: categoryName,
                chapter: themeName,
                comment: noteComment
            });

            // Map shared message IDs for each group
            const sharedMessageIds: Record<string, string> = {};
            const groupMsgRefs: Record<string, admin.firestore.DocumentReference> = {};
            for (const group of validGroups) {
                const mRef = group.ref.collection('messages').doc();
                sharedMessageIds[group.id] = mRef.id;
                groupMsgRefs[group.id] = mRef;
            }

            const noteData = {
                id: noteRef.id,
                userId: uid,
                scripture: categoryName,
                chapter: themeName,
                comment: noteComment,
                text: noteText,
                content: noteText,
                category: 'oneTap',
                themeId: themeId,
                createdAt: serverTime,
                updatedAt: serverTime,
                sharedWithGroups: validGroups.map((g) => g.id),
                sharedMessageIds,
                searchTokens: noteSearchTokens
            };
            transaction.set(noteRef, noteData);

            // Prepare announcement data
            const newTotal = newDaysCount;
            const safeNickname = escapeMarkdown(userNickname);
            const isMs = streakUpdated && isStreakMilestone(newTotal);
            const announceMsg = isMs
                ? t(userLang, 'notifications.streak_announcement', { nickname: safeNickname, streak: newTotal })
                : t(userLang, 'notifications.note_posted_announcement', { nickname: safeNickname });
            const botName = t(userLang, 'notifications.bot_name') || 'Scripture Habit Bot';
            const announceTime = admin.firestore.Timestamp.fromMillis(now.getTime() + 500);

            // 3. Post to member groups
            for (let i = 0; i < validGroups.length; i++) {
                const group = validGroups[i];
                const latestSnap = latestSnaps[i];

                const groupTz = group.data.timeZone || userTz;
                const groupToday = formatDateInTimeZone(now, groupTz);

                const currentActDate = group.data.dailyActivity?.date;
                const currentActiveMembers = group.data.dailyActivity?.activeMembers || [];

                let activeMembersToSet: string[];
                if (currentActDate === groupToday) {
                    activeMembersToSet = currentActiveMembers.includes(uid)
                        ? currentActiveMembers
                        : [...currentActiveMembers, uid];
                } else {
                    activeMembersToSet = [uid];
                }

                const isAiGroup = Boolean(group.data?.isAiGroup || group.data?.aiCompanionUid === 'ai-partner-bot');
                if (isAiGroup && !activeMembersToSet.includes('ai-partner-bot')) {
                    activeMembersToSet.push('ai-partner-bot');
                }

                const simulatedGroup = {
                    ...group.data,
                    dailyActivity: {
                        date: groupToday,
                        activeMembers: activeMembersToSet
                    }
                };

                const unity = calculateUnityPercentage(simulatedGroup as unknown as Group, [], now);

                // Post standard note card message in group chat
                const msgRef = groupMsgRefs[group.id];
                const msgData = {
                    id: msgRef.id,
                    text: noteText,
                    senderId: uid,
                    senderNickname: userNickname,
                    senderPhotoURL: userData.photoURL || null,
                    createdAt: serverTime,
                    isSystemMessage: false,
                    isNote: true,
                    originalNoteId: noteRef.id,
                    scripture: categoryName,
                    chapter: themeName,
                    comment: noteComment,
                    expireAt: getMessageExpireAt()
                };
                transaction.set(msgRef, msgData);

                // Post system announcement message (streak or note posted)
                const announceRef = group.ref.collection('messages').doc();
                const announceMsgData = {
                    id: announceRef.id,
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
                transaction.set(announceRef, announceMsgData);

                const messagesToAdd: Record<string, unknown>[] = [msgData, announceMsgData];

                let finalLastMessageAt = announceTime;
                let finalLastMessageByNickname = botName;
                let finalLastMessageByUid = 'system';

                // AI partner congratulation if AI group
                if (isAiGroup) {
                    const botNickname = t(userLang, 'groupChat.aiGroupBotNickname') || 'AI Partner';
                    const congratText = t(userLang, 'groupChat.aiGroupUserNoteCongratulation') || 'よくできました！🎉🎉 明日もお会いしましょう✨';
                    const congratDocId = `ai_congrat_${groupToday}`;
                    const aiCongratMsgRef = group.ref.collection('messages').doc(congratDocId);
                    const congratTime = admin.firestore.Timestamp.fromMillis(now.getTime() + 1000);

                    const aiMsgData = {
                        id: congratDocId,
                        text: congratText,
                        senderId: 'ai-partner-bot',
                        senderNickname: botNickname,
                        senderPhotoURL: '/images/ai-mascot.webp',
                        createdAt: congratTime,
                        isSystemMessage: false,
                        isNote: false,
                        expireAt: getMessageExpireAt()
                    };
                    transaction.set(aiCongratMsgRef, aiMsgData, { merge: true });
                    messagesToAdd.push(aiMsgData);

                    finalLastMessageAt = congratTime;
                    finalLastMessageByNickname = botNickname;
                    finalLastMessageByUid = 'ai-partner-bot';
                }

                // Demo group bot celebrations if demo group
                const isDemoGroup = Boolean(group.data?.isDemoGroup);
                if (isDemoGroup) {
                    const baseTimeMs = now.getTime() + 1500;
                    const demoCelebrations = [
                        {
                            id: `demo-celeb-alice-${now.getTime()}`,
                            senderId: 'bot-alice',
                            senderNickname: 'Alice 📖',
                            userPhotoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=Alice',
                            text: t(userLang, 'onboardingQuest.demoCelebrateAlice', { nickname: userNickname }),
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
                            text: t(userLang, 'onboardingQuest.demoCelebrateBob', { nickname: userNickname }),
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
                            text: t(userLang, 'onboardingQuest.demoCelebrateCharlie', { nickname: userNickname }),
                            createdAt: admin.firestore.Timestamp.fromMillis(baseTimeMs + 600),
                            isSystemMessage: false,
                            isNote: false,
                            expireAt: getDemoExpireAt()
                        }
                    ];
                    for (const bMsg of demoCelebrations) {
                        const bRef = group.ref.collection('messages').doc(bMsg.id);
                        transaction.set(bRef, bMsg, { merge: true });
                        messagesToAdd.push(bMsg);
                    }
                    finalLastMessageAt = admin.firestore.Timestamp.fromMillis(baseTimeMs + 600);
                    finalLastMessageByNickname = 'Charlie 💤';
                    finalLastMessageByUid = 'bot-charlie';
                }

                transaction.update(group.ref, {
                    lastMessageAt: finalLastMessageAt,
                    lastMessageByNickname: finalLastMessageByNickname,
                    lastMessageByUid: finalLastMessageByUid,
                    lastNoteAt: serverTime,
                    lastNoteByNickname: userNickname,
                    lastNoteByUid: uid,
                    [`memberLastActive.${uid}`]: serverTime,
                    [`memberLastReadAt.${uid}`]: finalLastMessageAt,
                    'dailyActivity.date': groupToday,
                    'dailyActivity.activeMembers': activeMembersToSet,
                    unityPercentage: unity
                });

                // Update messages_latest aggregate
                const latestRef = group.ref.collection('messages_latest').doc('latest');
                const snapData = latestSnap.exists ? latestSnap.data() : null;
                const existingMessages = (snapData?.messages || snapData?.recentMessages || []) as Record<string, unknown>[];
                const updatedMessages = [...existingMessages, ...messagesToAdd].slice(-50);

                transaction.set(latestRef, {
                    groupId: group.id,
                    messages: updatedMessages,
                    lastUpdatedAt: serverTime
                }, { merge: true });

                // Update group member state and user groupState
                const memberRef = group.ref.collection('members').doc(uid);
                transaction.set(memberRef, {
                    lastNoteAt: serverTime,
                    lastActiveAt: serverTime,
                    lastPostAt: serverTime,
                    lastReadAt: finalLastMessageAt,
                    readMessageCount: admin.firestore.FieldValue.increment(messagesToAdd.length)
                }, { merge: true });

                const userGS = userRef.collection('groupStates').doc(group.id);
                transaction.set(userGS, {
                    readMessageCount: admin.firestore.FieldValue.increment(messagesToAdd.length),
                    lastReadAt: finalLastMessageAt,
                    lastActiveAt: serverTime
                }, { merge: true });
            }

            return {
                success: true,
                themeId,
                streakCount: newStreak,
                daysStudiedCount: newDaysCount,
                streakUpdated,
                todayStr,
                groupsInfo: validGroups.map((g) => ({ id: g.id, members: g.data.members || [] })),
                userNickname,
                userLang
            };
        });

        // Background push notifications and stats
        if (result.groupsInfo.length > 0) {
            const userToGroupEntries: [string, string][] = [];
            for (const group of result.groupsInfo) {
                for (const mUid of group.members) {
                    if (mUid !== uid) {
                        userToGroupEntries.push([mUid, group.id]);
                    }
                }
            }

            NotificationService.notifyNotePosted({
                groupIds: result.groupsInfo.map((g) => g.id),
                senderUid: uid,
                senderNickname: result.userNickname,
                language: result.userLang,
                userToGroupMapEntries: userToGroupEntries
            }).catch((err) => {
                console.error('[OneTapService] Background notification failed:', err);
            });
        }

        db.collection('dailyStats').doc(result.todayStr).set({
            activeUsers: admin.firestore.FieldValue.arrayUnion(uid)
        }, { merge: true }).catch((err) => {
            console.error('[OneTapService] Failed to write dailyStats in background:', err);
        });

        return {
            success: result.success,
            themeId: result.themeId,
            streakCount: result.streakCount,
            daysStudiedCount: result.daysStudiedCount,
            streakUpdated: result.streakUpdated,
            todayStr: result.todayStr
        };
    }
}
