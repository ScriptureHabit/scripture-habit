/* eslint-disable no-restricted-properties */
import express, { Request, Response } from 'express';
import { admin, db } from '../lib/firebase-admin.js';
import { verifyAppCheck, authenticate, requireEmailVerified, AuthenticatedRequest } from '../lib/middleware.js';
import { runPhasedTransaction } from '../lib/phased-transaction.js';
import { joinGroupSchema, updateKickThresholdSchema, leaveGroupSchema, deleteGroupSchema, updateReadStatusSchema, announceUnitySchema, updateGroupSchema, regenerateInviteCodeSchema, kickMemberSchema, createGroupSchema, createAiGroupSchema } from '../lib/schemas.js';
import { GroupDocument, UserDocument, MemberPreview as PreviewItem, GroupMemberDocument, FirestoreTimestamp } from '../../types/firestore.js';
import { MAX_GROUPS_PER_USER } from '../lib/constants.js';
import { removeMemberFromGroup } from '../lib/membership-utils.js';
import { AppError, AuthenticationError, ForbiddenError, NotFoundError, ValidationError, sendErrorResponse } from '../lib/errors.js';
import { getMessageExpireAt, getDemoExpireAt } from '../lib/ttl-utils.js';
import { MessageService } from '../services/message-service.js';
import { t, getDemoGroupTranslations } from '../lib/i18n.js';
import { AiDailyNoteService } from '../services/ai-daily-note-service.js';

const router = express.Router();

function getTimestampMillis(ts?: FirestoreTimestamp | null): number {
    if (!ts) return 0;
    if (typeof ts === 'number') return ts;
    if (typeof ts === 'string') {
        const parsed = Date.parse(ts);
        return isNaN(parsed) ? 0 : parsed;
    }
    if (ts instanceof Date) return ts.getTime();
    if (typeof (ts as { toDate?: () => Date }).toDate === 'function') {
        return (ts as { toDate: () => Date }).toDate().getTime();
    }
    if (typeof (ts as { seconds?: number }).seconds === 'number') {
        return (ts as { seconds: number }).seconds * 1000;
    }
    if (typeof (ts as { _seconds?: number })._seconds === 'number') {
        return (ts as { _seconds: number })._seconds * 1000;
    }
    return 0;
}

/**
 * GET /api/groups
 * Retrieves public groups for the join group screen.
 * For demo users, automatically ensures their isolated Daily Bread group is available.
 */
router.get('/', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const uid = req.user?.uid;
        const limitCount = Math.min(Number(req.query.limit) || 20, 50);

        let userDoc: UserDocument | null = null;
        if (uid) {
            const userSnap = await db.collection('users').doc(uid).get();
            if (userSnap.exists) {
                userDoc = userSnap.data() as UserDocument;
            }
        }

        const isDemo = userDoc?.isAnonymousDemo || req.user?.firebase?.sign_in_provider === 'anonymous';

        // Auto-seed demo group if demo user doesn't have it yet
        if (isDemo && uid) {
            // Ensure demo user has all 999 days of studiedDates filled
            const now = Date.now();
            const existingDates = userDoc?.studiedDates || [];
            if (existingDates.length < 100) {
                const getDateStr = (daysAgo: number) => {
                    const d = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
                    return d.toLocaleDateString('sv-SE');
                };
                const fullDates: string[] = [];
                for (let i = 999; i >= 1; i--) {
                    fullDates.push(getDateStr(i));
                }
                // If user posted today, preserve today as well
                const todayStr = new Date(now).toLocaleDateString('sv-SE');
                if (existingDates.includes(todayStr)) {
                    fullDates.push(todayStr);
                }
                await db.collection('users').doc(uid).update({
                    studiedDates: fullDates,
                    daysStudiedCount: Math.max(userDoc?.daysStudiedCount || 999, fullDates.length)
                });
            }

            const demoGroupId = `demo-group-${uid}`;
            const demoGroupDoc = await db.collection('groups').doc(demoGroupId).get();
            if (!demoGroupDoc.exists) {
                const language = userDoc?.language || 'ja';
                const getDateStr = (daysAgo: number) => {
                    const d = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
                    return d.toLocaleDateString('sv-SE');
                };

                const groupData: GroupDocument = {
                    name: t(language, 'onboardingQuest.demoGroupName') || '日々の糧 📖',
                    description: t(language, 'onboardingQuest.demoGroupDesc') || '毎日一緒に聖典を読み合う、温かい学習グループです！✨',
                    translations: getDemoGroupTranslations(),
                    members: ['bot-alice', 'bot-bob', 'bot-charlie'],
                    membersCount: 3,
                    ownerUserId: 'bot-alice',
                    maxMembers: 5,
                    isPrivate: false,
                    isPublic: true,
                    isDemoGroup: true,
                    groupStreak: 7,
                    unityPercentage: 67,
                    inviteCode: `DEMO${uid.slice(0, 4).toUpperCase()}`,
                    memberPreviews: [
                        { uid: 'bot-alice', nickname: 'Alice 📖' },
                        { uid: 'bot-bob', nickname: 'Bob 🔥' },
                        { uid: 'bot-charlie', nickname: 'Charlie 💤' }
                    ],
                    memberJoinedAt: {
                        'bot-alice': admin.firestore.Timestamp.fromMillis(now - 14 * 24 * 60 * 60 * 1000),
                        'bot-bob': admin.firestore.Timestamp.fromMillis(now - 20 * 24 * 60 * 60 * 1000),
                        'bot-charlie': admin.firestore.Timestamp.fromMillis(now - 5 * 24 * 60 * 60 * 1000)
                    },
                    memberLastActive: {
                        'bot-alice': admin.firestore.Timestamp.fromMillis(now - 4 * 60 * 60 * 1000),
                        'bot-bob': admin.firestore.Timestamp.fromMillis(now - 2 * 60 * 60 * 1000),
                        'bot-charlie': admin.firestore.Timestamp.fromMillis(now - 2 * 24 * 60 * 60 * 1000)
                    },
                    memberLastReadAt: {
                        'bot-alice': admin.firestore.Timestamp.fromMillis(now - 4 * 60 * 60 * 1000),
                        'bot-bob': admin.firestore.Timestamp.fromMillis(now - 2 * 60 * 60 * 1000),
                        'bot-charlie': admin.firestore.Timestamp.fromMillis(now - 2 * 24 * 60 * 60 * 1000)
                    },
                    dailyActivity: {
                        date: getDateStr(0),
                        activeMembers: ['bot-alice', 'bot-bob']
                    },
                    lastMessageAt: admin.firestore.Timestamp.fromMillis(now - 2 * 60 * 60 * 1000),
                    lastMessageByUid: 'bot-bob',
                    lastMessageByNickname: 'Bob 🔥',
                    lastNoteAt: admin.firestore.Timestamp.fromMillis(now - 2 * 60 * 60 * 1000),
                    lastNoteByUid: 'bot-bob',
                    lastNoteByNickname: 'Bob 🔥',
                    createdAt: admin.firestore.Timestamp.fromMillis(now - 14 * 24 * 60 * 60 * 1000),
                    timeZone: 'Asia/Tokyo',
                    expireAt: getDemoExpireAt()
                };

                const batch = db.batch();
                const demoGroupRef = db.collection('groups').doc(demoGroupId);
                batch.set(demoGroupRef, groupData, { merge: true });

                const seedMessages = [
                    {
                        id: `demo-msg-1-${uid}`,
                        text: language === 'ja'
                            ? '日々の糧へようこそ！みんなで毎日聖典を学んで励まし合いましょう🎉'
                            : 'Welcome to Daily Bread! Let us support each other in our daily scripture habit 🎉',
                        senderId: 'bot-alice',
                        senderNickname: 'Alice 📖',
                        userPhotoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=Alice',
                        createdAt: admin.firestore.Timestamp.fromMillis(now - 24 * 60 * 60 * 1000),
                        expireAt: getDemoExpireAt()
                    },
                    {
                        id: `demo-msg-2-${uid}`,
                        text: '**Book of Mormon 1 Nephi 1**\n\nStarting 1 Nephi today! Loved the reflection on God\'s tender mercies.',
                        senderId: 'bot-bob',
                        senderNickname: 'Bob 🔥',
                        userPhotoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=Bob',
                        createdAt: admin.firestore.Timestamp.fromMillis(now - 20 * 60 * 60 * 1000),
                        isNote: true,
                        scripture: 'Book of Mormon',
                        chapter: '1 Nephi 1',
                        comment: 'Starting 1 Nephi today! Loved the reflection on God\'s tender mercies.',
                        expireAt: getDemoExpireAt()
                    },
                    {
                        id: `demo-msg-3-${uid}`,
                        text: '**Book of Mormon 1 Nephi 3:7**\n\n"I will go and do the things which the Lord hath commanded." Let us move forward with faith.',
                        senderId: 'bot-bob',
                        senderNickname: 'Bob 🔥',
                        userPhotoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=Bob',
                        createdAt: admin.firestore.Timestamp.fromMillis(now - 2 * 60 * 60 * 1000),
                        isNote: true,
                        scripture: 'Book of Mormon',
                        chapter: '1 Nephi 3:7',
                        comment: '"I will go and do the things which the Lord hath commanded." Let us move forward with faith.',
                        expireAt: getDemoExpireAt()
                    }
                ];

                for (const msg of seedMessages) {
                    batch.set(demoGroupRef.collection('messages').doc(msg.id), msg, { merge: true });
                }

                // Also initialize messages_latest/latest
                const latestDocRef = demoGroupRef.collection('messages_latest').doc('latest');
                batch.set(latestDocRef, {
                    groupId: demoGroupId,
                    messages: seedMessages,
                    lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });

                await batch.commit();
            } else {
                const demoData = demoGroupDoc.data() as GroupDocument;
                const updateFields: Partial<GroupDocument> = {};
                if (demoData?.maxMembers !== 5) {
                    updateFields.maxMembers = 5;
                }
                if (!demoData?.translations || Object.keys(demoData.translations).length < 10) {
                    updateFields.translations = getDemoGroupTranslations();
                }
                if (Object.keys(updateFields).length > 0) {
                    await db.collection('groups').doc(demoGroupId).update(updateFields);
                }

                // If demo user has joined the group, ensure messages_latest/latest has the bot welcome messages
                const latestDocRef = db.collection('groups').doc(demoGroupId).collection('messages_latest').doc('latest');
                const latestSnap = await latestDocRef.get();
                const latestMsgs = (latestSnap.data()?.messages || []) as Record<string, unknown>[];
                
                const hasBotWelcome = latestMsgs.some(m => typeof m.id === 'string' && m.id.startsWith('demo-welcome-'));
                const isMember = (demoData?.members || []).includes(uid);

                if (isMember && !hasBotWelcome) {
                    // Fetch recent messages from subcollection and sync to messages_latest
                    const msgsSnap = await db.collection('groups').doc(demoGroupId).collection('messages')
                        .orderBy('createdAt', 'asc')
                        .limit(25)
                        .get();

                    let allMsgs = msgsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                    // If bot celebrations don't exist yet in subcollection, generate and insert them
                    const hasBotCelebrationInSub = allMsgs.some(m => typeof m.id === 'string' && m.id.startsWith('demo-welcome-'));
                    if (!hasBotCelebrationInSub) {
                        const nickname = userDoc?.nickname || 'Demo User';
                        const userLang = userDoc?.language || 'ja';
                        const nowMs = Date.now();
                        const botCelebrations = [
                            {
                                id: `demo-welcome-alice-${nowMs}`,
                                senderId: 'bot-alice',
                                senderNickname: 'Alice 📖',
                                userPhotoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=Alice',
                                text: t(userLang, 'onboardingQuest.demoWelcomeAlice', { nickname }),
                                createdAt: admin.firestore.Timestamp.fromMillis(nowMs + 100),
                                expireAt: getDemoExpireAt()
                            },
                            {
                                id: `demo-welcome-bob-${nowMs}`,
                                senderId: 'bot-bob',
                                senderNickname: 'Bob 🔥',
                                userPhotoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=Bob',
                                text: t(userLang, 'onboardingQuest.demoWelcomeBob', { nickname }),
                                createdAt: admin.firestore.Timestamp.fromMillis(nowMs + 200),
                                expireAt: getDemoExpireAt()
                            },
                            {
                                id: `demo-welcome-charlie-${nowMs}`,
                                senderId: 'bot-charlie',
                                senderNickname: 'Charlie 💤',
                                userPhotoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=Charlie',
                                text: t(userLang, 'onboardingQuest.demoWelcomeCharlie', { nickname }),
                                createdAt: admin.firestore.Timestamp.fromMillis(nowMs + 300),
                                expireAt: getDemoExpireAt()
                            }
                        ];

                        const repairBatch = db.batch();
                        for (const bMsg of botCelebrations) {
                            repairBatch.set(db.collection('groups').doc(demoGroupId).collection('messages').doc(bMsg.id), bMsg, { merge: true });
                        }
                        await repairBatch.commit();
                        allMsgs = [...allMsgs, ...botCelebrations];
                    }

                    // Filter out any premature unityAnnouncement messages before demo user has posted
                    const isUserActive = (demoData?.dailyActivity?.activeMembers || []).includes(uid);
                    if (!isUserActive) {
                        allMsgs = allMsgs.filter(m => (m as Record<string, unknown>).messageType !== 'unityAnnouncement');
                    }

                    await latestDocRef.set({
                        groupId: demoGroupId,
                        messages: allMsgs.slice(-25),
                        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                } else if (isMember) {
                    // Also clean up unityAnnouncement if present before user posted
                    const isUserActive = (demoData?.dailyActivity?.activeMembers || []).includes(uid);
                    if (!isUserActive && latestMsgs.some(m => (m as Record<string, unknown>).messageType === 'unityAnnouncement')) {
                        const cleanedMsgs = latestMsgs.filter(m => (m as Record<string, unknown>).messageType !== 'unityAnnouncement');
                        await latestDocRef.update({ messages: cleanedMsgs });
                    }
                }
            }
        }

        if (isDemo && uid) {
            const demoGroupId = `demo-group-${uid}`;
            const demoGroupDoc = await db.collection('groups').doc(demoGroupId).get();
            if (demoGroupDoc.exists) {
                return res.json([{
                    id: demoGroupDoc.id,
                    ...(demoGroupDoc.data() as GroupDocument)
                }]);
            }
            return res.json([]);
        }

        const groupsSnap = await db.collection('groups')
            .where('isPublic', '==', true)
            .limit(limitCount + 30)
            .get();

        const groups = groupsSnap.docs
            .map(doc => ({
                id: doc.id,
                ...(doc.data() as GroupDocument)
            }))
            .filter(g => !g.isDemoGroup && !g.id.startsWith('demo-group-'))
            .slice(0, limitCount);

        // Sort by lastMessageAt / createdAt
        groups.sort((a: Partial<GroupDocument>, b: Partial<GroupDocument>) => {
            const timeA = getTimestampMillis(a.lastMessageAt || a.createdAt);
            const timeB = getTimestampMillis(b.lastMessageAt || b.createdAt);
            return timeB - timeA;
        });

        res.json(groups);
    } catch (err) {
        console.error('[GetPublicGroups] Error fetching public groups:', err);
        sendErrorResponse(res, err, 'Failed to fetch public groups.');
    }
});

/**
 * Create Group
 * Enforces MAX_GROUPS_PER_USER on the server to prevent bypasses.
 */
router.post('/create-group', authenticate, requireEmailVerified, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const validation = createGroupSchema.safeParse(req.body);
        if (!validation.success) {
            throw new ValidationError('Invalid input');
        }

        const { name, description, isPublic, timeZone } = validation.data;
        const uid = req.user?.uid;
        if (!uid) throw new ValidationError('Unauthorized');

        const result = await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(uid);
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) throw new NotFoundError('User not found.');
            const userData = userDoc.data()! as UserDocument;

            // 1. Enforce group limit
            const currentGroupIds = userData.groupIds || [];
            if (currentGroupIds.length >= MAX_GROUPS_PER_USER) {
                throw new ValidationError(`You have reached the maximum limit of ${MAX_GROUPS_PER_USER} groups. Please leave or delete an existing group before creating a new one.`);
            }

            // 2. Prepare Data
            const now = admin.firestore.Timestamp.now();
            const expiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1000); // 7 days default
            const inviteCode = await generateUniqueInviteCode(transaction);

            const userNick = userData.nickname || 'Owner';
            const groupRef = db.collection('groups').doc();
            const newGroupId = groupRef.id;

            const newGroupData: GroupDocument = {
                name,
                description: description || '',
                createdAt: now,
                groupStreak: 0,
                inviteCode,
                inviteCodeExpiresAt: expiresAt,
                isPublic: isPublic || false,
                isPrivate: !isPublic, // Legacy field
                maxMembers: 5,
                membersCount: 1,
                memberPreviews: [{ uid, nickname: userNick }],
                ownerUserId: uid,
                members: [uid],
                memberJoinedAt: { [uid]: now },
                memberKickThresholds: { [uid]: userData.kickThreshold || 3 },
                timeZone: timeZone || 'Asia/Tokyo',
                lastInactivityCheckedAt: now,
                lastMessageAt: now,
                lastMessageByNickname: userNick,
                lastMessageByUid: uid
            };

            const memberData: admin.firestore.WithFieldValue<GroupMemberDocument> = {
                uid,
                nickname: userNick,
                photoURL: userData.photoURL || '',
                joinedAt: now,
                lastActiveAt: now,
                lastReadAt: now,
                kickThreshold: userData.kickThreshold || 3,
                readMessageCount: 0
            };

            // 3. Execution Phase
            console.error(`[Groups] Creating group ${newGroupId} with data: ${JSON.stringify(newGroupData)}`);
            transaction.set(groupRef, newGroupData);
            transaction.set(groupRef.collection('members').doc(uid), memberData);

            transaction.set(userRef.collection('groupStates').doc(newGroupId), {
                readMessageCount: 0,
                lastReadAt: now,
                lastActiveAt: now
            });

            transaction.update(userRef, {
                groupIds: admin.firestore.FieldValue.arrayUnion(newGroupId),
                groupId: newGroupId,
                questCreatedGroup: true
            });

            const msgRef = groupRef.collection('messages').doc();
            const lang = userData.language || 'en';
            const welcomeMsg = {
                text: t(lang, 'notifications.group_created_welcome', { nickname: userNick }),
                createdAt: now,
                senderId: 'system',
                isSystemMessage: true,
                type: 'system',
                messageType: 'userJoined',
                messageData: { nickname: userNick },
                expireAt: getMessageExpireAt()
            };
            transaction.set(msgRef, welcomeMsg);

            // Seed empty/initial latest messages aggregate to prevent frontend historical queries fallback
            const latestRef = groupRef.collection('messages_latest').doc('latest');
            transaction.set(latestRef, {
                groupId: newGroupId,
                messages: [{ id: msgRef.id, ...welcomeMsg }],
                lastUpdatedAt: now
            });

            return { groupId: newGroupId, inviteCode };
        });

        res.status(200).json({ message: 'Success', ...result });
    } catch (error) {
        console.error('Error creating group:', error);
        sendErrorResponse(res, error, 'Create group failed');
    }
});

/**
 * Create AI Partner Group
 */
router.post('/create-ai-group', authenticate, requireEmailVerified, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const validation = createAiGroupSchema.safeParse(req.body);
        if (!validation.success) {
            throw new ValidationError('Invalid input');
        }

        const { name, timeZone } = validation.data;
        const uid = req.user?.uid;
        if (!uid) throw new ValidationError('Unauthorized');

        const result = await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(uid);
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) throw new NotFoundError('User not found.');
            const userData = userDoc.data()! as UserDocument;

            const currentGroupIds = userData.groupIds || [];
            if (currentGroupIds.length >= MAX_GROUPS_PER_USER) {
                throw new ValidationError(`You have reached the maximum limit of ${MAX_GROUPS_PER_USER} groups.`);
            }

            const now = admin.firestore.Timestamp.now();
            const expiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + 365 * 24 * 60 * 60 * 1000);
            const inviteCode = await generateUniqueInviteCode(transaction);

            const userNick = userData.nickname || 'Member';
            const groupRef = db.collection('groups').doc();
            const newGroupId = groupRef.id;
            const lang = userData.language || 'en';

            const botNickname = t(lang, 'groupChat.aiGroupBotNickname') || (lang === 'ja' ? 'スクハビAI' : 'Scripture Habit AI');
            const defaultGroupName = name || t(lang, 'groupChat.aiGroupDefaultGroupName') || (lang === 'ja' ? 'スクハビAI' : 'Scripture Habit AI');

            const groupTz = timeZone || 'Asia/Tokyo';
            let todayStr: string;
            try {
                todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: groupTz });
            } catch {
                todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
            }

            const userAlreadyPostedToday = userData.lastPostDate === todayStr;
            const activeMembers = userAlreadyPostedToday ? ['ai-partner-bot', uid] : ['ai-partner-bot'];

            const AI_GROUP_PRE_TRANSLATIONS: Record<string, { name: string; description: string }> = {
                ja: { name: 'スクハビAI', description: 'スクハビAIと1対1で聖典を学ぶ専用グループ' },
                en: { name: 'Scripture Habit AI', description: '1-on-1 Scripture Study Group with Scripture Habit AI' },
                es: { name: 'Scripture Habit AI', description: 'Grupo 1-a-1 de estudio de las escrituras con Scripture Habit AI' },
                pt: { name: 'Scripture Habit AI', description: 'Grupo 1-a-1 de estudo das escrituras com Scripture Habit AI' },
                zho: { name: 'Scripture Habit AI', description: '與 Scripture Habit AI 一對一研讀經文的專屬群組' },
                ko: { name: 'Scripture Habit AI', description: 'Scripture Habit AI와 1대1로 성경을 공부하는 전용 그룹' },
                vi: { name: 'Scripture Habit AI', description: 'Nhóm học tập kinh thánh 1-on-1 với Scripture Habit AI' },
                th: { name: 'Scripture Habit AI', description: 'กลุ่มศึกษาพระคัมภีร์แบบตัวต่อตัวกับ Scripture Habit AI' },
                tl: { name: 'Scripture Habit AI', description: '1-on-1 Group para sa pag-aaral ng kasulatan kasama ang Scripture Habit AI' },
                sw: { name: 'Scripture Habit AI', description: 'Kikundi cha kujifunza maandiko 1-kwa-1 na Scripture Habit AI' }
            };

            const newGroupData: GroupDocument = {
                name: defaultGroupName,
                description: t(lang, 'groupChat.aiGroupDefaultGroupDesc') || '1-on-1 Scripture Study Group with Scripture Habit AI',
                translations: AI_GROUP_PRE_TRANSLATIONS,
                createdAt: now,
                groupStreak: 0,
                inviteCode,
                inviteCodeExpiresAt: expiresAt,
                isPublic: false,
                isPrivate: true,
                isAiGroup: true,
                aiCompanionUid: 'ai-partner-bot',
                maxMembers: 2,
                membersCount: 2,
                memberPreviews: [
                    { uid, nickname: userNick },
                    { uid: 'ai-partner-bot', nickname: botNickname }
                ],
                ownerUserId: uid,
                members: [uid, 'ai-partner-bot'],
                memberJoinedAt: { [uid]: now, 'ai-partner-bot': now },
                memberKickThresholds: { [uid]: userData.kickThreshold || 7, 'ai-partner-bot': 999 },
                timeZone: groupTz,
                dailyActivity: {
                    date: todayStr,
                    activeMembers
                },
                lastInactivityCheckedAt: now,
                lastMessageAt: now,
                lastMessageByNickname: botNickname,
                lastMessageByUid: 'ai-partner-bot'
            };

            transaction.set(groupRef, newGroupData);
            transaction.set(groupRef.collection('members').doc(uid), {
                uid,
                nickname: userNick,
                photoURL: userData.photoURL || '',
                joinedAt: now,
                lastActiveAt: now,
                lastReadAt: now,
                kickThreshold: userData.kickThreshold || 7,
                readMessageCount: 0
            });

            transaction.set(groupRef.collection('members').doc('ai-partner-bot'), {
                uid: 'ai-partner-bot',
                nickname: botNickname,
                photoURL: '/images/mascot.png',
                joinedAt: now,
                lastActiveAt: now,
                lastReadAt: now,
                kickThreshold: 999,
                readMessageCount: 0
            });

            // Upsert Bot User Profile Document so user lookup queries do not fail
            transaction.set(db.collection('users').doc('ai-partner-bot'), {
                uid: 'ai-partner-bot',
                nickname: botNickname,
                photoURL: '/images/mascot.png',
                isBot: true,
                createdAt: now
            }, { merge: true });

            transaction.set(userRef.collection('groupStates').doc(newGroupId), {
                readMessageCount: 0,
                lastReadAt: now,
                lastActiveAt: now
            });

            transaction.update(userRef, {
                groupIds: admin.firestore.FieldValue.arrayUnion(newGroupId),
                groupId: newGroupId,
                hasSetKickThreshold: true,
                questCreatedGroup: true
            });

            const welcomeMsgRef = groupRef.collection('messages').doc();
            const rawWelcome = t(lang, 'groupChat.aiGroupWelcomeMessage', { nickname: userNick });
            const welcomeMsgText = (rawWelcome && rawWelcome !== 'groupChat.aiGroupWelcomeMessage')
                ? rawWelcome.replace('{nickname}', userNick)
                : (lang === 'ja'
                    ? `スクハビAIグループへようこそ！毎日一緒に聖典を学び、気づきをシェアしましょう。応援しています！📖✨\n※AIは毎日ノートを投稿しますが、${userNick}さんへの直接返信は現段階ではできません。ご了承ください。`
                    : `Welcome to your Scripture Habit AI Group! I will study scriptures with you every day and share notes. Let's do our best together! 📖✨\n*Please note: While I post daily notes, I cannot directly reply to messages from ${userNick} at this time.`).replace('{nickname}', userNick);

            transaction.set(welcomeMsgRef, {
                text: welcomeMsgText,
                createdAt: now,
                senderId: 'ai-partner-bot',
                senderNickname: botNickname,
                senderPhotoURL: '/images/mascot.png',
                isSystemMessage: false,
                isNote: false,
                expireAt: getMessageExpireAt()
            });

            // If user already posted a note today before creating the AI group, auto-post AI congratulation response!
            if (userAlreadyPostedToday) {
                const congratText = t(lang, 'groupChat.aiGroupUserNoteCongratulation') || 'よくできました！🎉🎉 明日もお会いしましょう✨';
                const congratMsgRef = groupRef.collection('messages').doc(`ai_congrat_${todayStr}`);
                transaction.set(congratMsgRef, {
                    text: congratText,
                    senderId: 'ai-partner-bot',
                    senderNickname: botNickname,
                    senderPhotoURL: '/images/mascot.png',
                    createdAt: admin.firestore.Timestamp.fromMillis(now.toMillis() + 2000),
                    isSystemMessage: false,
                    isNote: false,
                    expireAt: getMessageExpireAt()
                }, { merge: true });
            }

            return { groupId: newGroupId, groupName: defaultGroupName, inviteCode, ownerUserId: uid, timeZone, lang };
        });

        // Simultaneously post today's AI daily note and send FCM push notification
        try {
            await AiDailyNoteService.postDailyNoteForGroup(
                result.groupId,
                { timeZone: result.timeZone, ownerUserId: result.ownerUserId },
                { isGroupCreation: true, langOverride: result.lang }
            );
        } catch (noteErr) {
            console.warn(`[Groups] Failed to post initial AI daily note for group ${result.groupId}:`, noteErr);
        }

        try {
            await MessageService.reconcileLatestMessages(result.groupId);
        } catch (reconcileErr) {
            console.warn(`[Groups] Failed to reconcile latest messages for new AI group ${result.groupId}:`, reconcileErr);
        }

        res.status(200).json({
            message: 'Success',
            groupId: result.groupId,
            groupName: result.groupName,
            inviteCode: result.inviteCode
        });
    } catch (error) {
        console.error('Error creating AI group:', error);
        sendErrorResponse(res, error, 'Create AI group failed');
    }
});

// Join Group
router.post('/join-group', authenticate, requireEmailVerified, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const validation = joinGroupSchema.safeParse(req.body);
        if (!validation.success) {
            throw new ValidationError('Invalid input');
        }

        const { inviteCode, groupId } = validation.data;
        const uid = req.user?.uid;
        if (!uid) throw new AuthenticationError('Unauthorized');

        const result = await runPhasedTransaction(db, {
            read: async (transaction) => {
                let groupRef;
                let groupDoc;
                if (groupId) {
                    groupRef = db.collection('groups').doc(groupId);
                    groupDoc = await transaction.get(groupRef);
                } else if (inviteCode) {
                    const groupQuery = db.collection('groups').where('inviteCode', '==', inviteCode).limit(1);
                    const querySnap = await transaction.get(groupQuery);
                    if (querySnap.empty) throw new ValidationError('Invalid invite code.', 'INVALID_INVITE_CODE');
                    groupDoc = querySnap.docs[0];
                    groupRef = groupDoc.ref;
                } else {
                    throw new ValidationError('Group ID or Invite Code is required.');
                }

                const userRef = db.collection('users').doc(uid);
                const userDoc = await transaction.get(userRef);

                const latestRef = groupRef.collection('messages_latest').doc('latest');
                const latestSnap = await transaction.get(latestRef);

                return { groupDoc, userDoc, groupRef, userRef, latestSnap };
            },
            write: async (transaction, { groupDoc, userDoc, groupRef, userRef, latestSnap }) => {
                if (!groupDoc.exists) throw new NotFoundError('Group not found.');
                if (!userDoc.exists) throw new NotFoundError('User not found.');

                const gid = groupDoc.id;
                const gData = groupDoc.data()! as GroupDocument;
                const userData = userDoc.data()! as UserDocument;

                const members = gData.members || [];
                const maxMembers = gData.maxMembers || 5;

                // 1. Validation Phase
                if (gData.isPrivate === true || gData.isPublic === false) {
                    if (inviteCode) {
                        if (gData.inviteCode !== inviteCode) {
                            throw new ValidationError('Invalid or expired invite code.', 'INVALID_INVITE_CODE');
                        }
                        if (gData.inviteCodeExpiresAt) {
                            const ts = gData.inviteCodeExpiresAt;
                            const expiresAt = (ts && typeof ts === 'object' && 'toDate' in ts && typeof ts.toDate === 'function')
                                ? ts.toDate()
                                : new Date(ts as string | number | Date);

                            if (expiresAt < new Date()) {
                                throw new ValidationError('This invite link has expired. Please ask the group owner for a new one.', 'EXPIRED_INVITE_LINK');
                            }
                        }
                    } else if (!gData.isPublic) {
                        throw new ForbiddenError('This is a private group. You need an invite code to join.');
                    }
                }

                const isUserDemo = userData.isAnonymousDemo || req.user?.firebase?.sign_in_provider === 'anonymous';
                if (isUserDemo && (!gData.isDemoGroup || gid !== `demo-group-${uid}`)) {
                    throw new ForbiddenError('Demo accounts can only join their dedicated demo group.');
                }
                if (!isUserDemo && gData.isDemoGroup) {
                    throw new ForbiddenError('Real accounts cannot join demo sandbox groups.');
                }

                if (members.includes(uid)) throw new ValidationError('You are already a member of this group.', 'ALREADY_MEMBER');
                if (members.length >= maxMembers) {
                    throw new ValidationError('This group is full.', 'GROUP_FULL');
                }

                const userGroupIds = userData.groupIds || [];
                if (userGroupIds.length >= MAX_GROUPS_PER_USER) {
                    throw new ValidationError(`You can only join up to ${MAX_GROUPS_PER_USER} groups. Please leave one before joining another.`, 'MAX_GROUPS_LIMIT');
                }

                // 2. Prepare Data
                const updatedMembers = [...members, uid];
                const newMemberPreview = { uid, nickname: userData.nickname || 'Member' };
                const existingPreviews = (gData.memberPreviews || []) as PreviewItem[];
                const updatedPreviews = [newMemberPreview, ...existingPreviews.filter((p) => p.uid !== uid)].slice(0, 15);

                const memberData: admin.firestore.WithFieldValue<GroupMemberDocument> = {
                    uid,
                    nickname: userData.nickname || 'Member',
                    photoURL: userData.photoURL || '',
                    joinedAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
                    kickThreshold: userData.kickThreshold || 3,
                    lastReadAt: admin.firestore.FieldValue.serverTimestamp(),
                    readMessageCount: 0
                };

                // 3. START WRITES (Execution Phase)
                transaction.update(groupRef, {
                    members: updatedMembers,
                    membersCount: updatedMembers.length,
                    memberPreviews: updatedPreviews,
                    [`memberJoinedAt.${uid}`]: admin.firestore.FieldValue.serverTimestamp(),
                    [`memberKickThresholds.${uid}`]: userData.kickThreshold || 3,
                    lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastMessageByNickname: userData.nickname || 'Member',
                    lastMessageByUid: uid,
                    lastInactivityCheckedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                const memberRef = groupRef.collection('members').doc(uid);
                transaction.set(memberRef, memberData);

                const userGS = userRef.collection('groupStates').doc(gid);
                transaction.set(userGS, {
                    readMessageCount: 0,
                    lastReadAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastActiveAt: admin.firestore.FieldValue.serverTimestamp()
                });

                transaction.update(userRef, {
                    groupIds: admin.firestore.FieldValue.arrayUnion(gid),
                    groupId: gid,
                    questCreatedGroup: true
                });

                const msgRef = groupRef.collection('messages').doc();
                const joinLang = userData.language || 'en';
                const nickname = userData.nickname || 'Someone';
                const systemMsg = {
                    text: t(joinLang, 'notifications.member_joined_welcome', { nickname }),
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    senderId: 'system',
                    isSystemMessage: true,
                    type: 'join',
                    messageType: 'userJoined',
                    messageData: { nickname },
                    expireAt: getMessageExpireAt()
                };
                transaction.set(msgRef, systemMsg);

                const messagesToAppend: Record<string, unknown>[] = [
                    { id: msgRef.id, ...systemMsg, createdAt: admin.firestore.Timestamp.now() }
                ];

                // For demo groups, add enthusiastic welcome messages from bot members anticipating the 1,000-day milestone!
                if (gData.isDemoGroup) {
                    const nowMs = Date.now();
                    const botCelebrations = [
                        {
                            id: `demo-welcome-alice-${nowMs}`,
                            senderId: 'bot-alice',
                            senderNickname: 'Alice 📖',
                            userPhotoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=Alice',
                            text: t(joinLang, 'onboardingQuest.demoWelcomeAlice', { nickname }),
                            createdAt: admin.firestore.Timestamp.fromMillis(nowMs + 100),
                            expireAt: getDemoExpireAt()
                        },
                        {
                            id: `demo-welcome-bob-${nowMs}`,
                            senderId: 'bot-bob',
                            senderNickname: 'Bob 🔥',
                            userPhotoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=Bob',
                            text: t(joinLang, 'onboardingQuest.demoWelcomeBob', { nickname }),
                            createdAt: admin.firestore.Timestamp.fromMillis(nowMs + 200),
                            expireAt: getDemoExpireAt()
                        },
                        {
                            id: `demo-welcome-charlie-${nowMs}`,
                            senderId: 'bot-charlie',
                            senderNickname: 'Charlie 💤',
                            userPhotoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=Charlie',
                            text: t(joinLang, 'onboardingQuest.demoWelcomeCharlie', { nickname }),
                            createdAt: admin.firestore.Timestamp.fromMillis(nowMs + 300),
                            expireAt: getDemoExpireAt()
                        }
                    ];

                    for (const bMsg of botCelebrations) {
                        const bRef = groupRef.collection('messages').doc(bMsg.id);
                        transaction.set(bRef, bMsg);
                        messagesToAppend.push({ ...bMsg });
                    }
                }

                // Update messages_latest/latest so real-time listener displays them immediately
                const currentMessages: Record<string, unknown>[] = (latestSnap && latestSnap.exists) 
                    ? (latestSnap.data()?.messages || []) 
                    : [];
                const updatedMessages = [...currentMessages, ...messagesToAppend].slice(-25);

                const latestRef = groupRef.collection('messages_latest').doc('latest');
                transaction.set(latestRef, {
                    groupId: gid,
                    messages: updatedMessages,
                    lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });

                const ownerPreview = (gData.memberPreviews || []).find((p: PreviewItem) => p.uid === gData.ownerUserId);
                const ownerName = ownerPreview ? ownerPreview.nickname : 'Owner';

                return { gid, groupName: gData.name, ownerName };
            }
        });

        res.status(200).json({ message: 'Success', ...result });
    } catch (error) {
        console.error('Error joining group:', error);
        sendErrorResponse(res, error, 'Join group failed');
    }
});

// Leave Group
router.post('/leave-group', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const validation = leaveGroupSchema.safeParse(req.body);
        if (!validation.success) throw new ValidationError('Invalid input');

        const { groupId } = validation.data;
        if (!groupId) throw new ValidationError('groupId is required');
        const uid = req.user?.uid;
        if (!uid) throw new AuthenticationError('Unauthorized');

        await runPhasedTransaction(db, {
            read: async (transaction) => {
                const userRef = db.collection('users').doc(uid);
                const uSnap = await transaction.get(userRef);
                return { uSnap };
            },
            write: async (transaction, { uSnap }) => {
                if (!uSnap.exists) throw new NotFoundError('User not found.');
                const uData = uSnap.data()! as UserDocument;

                // Use centralized utility for the heavy lifting
                await removeMemberFromGroup(transaction, groupId, uid, {
                    removeFromUserDoc: true,
                    clearUserGroupId: true,
                    removeGroupState: true,
                    transferOwnership: true,
                    preferredLanguage: uData.language || 'en',
                    systemMessage: {
                        type: 'leave',
                        nickname: uData.nickname || 'Someone'
                    },
                    userDoc: uSnap
                });
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Leave group failed:', error);
        sendErrorResponse(res, error, 'Leave group failed');
    }
});

router.post('/update-read-status', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const validation = updateReadStatusSchema.safeParse(req.body);
        if (!validation.success) throw new ValidationError('Invalid input');

        const { groupId } = validation.data;
        const uid = req.user?.uid;
        if (!uid) throw new ValidationError('Unauthorized');

        const groupRef = db.collection('groups').doc(groupId);
        const userRef = db.collection('users').doc(uid);
        const groupSnap = await groupRef.get();
        if (!groupSnap.exists) throw new NotFoundError('Group not found');

        const groupData = groupSnap.data()! as GroupDocument;
        if (!groupData) throw new NotFoundError('Group not found');
        const members = groupData.members || [];
        const ownerUserId = groupData.ownerUserId || '';
        if (!members.includes(uid) && ownerUserId !== uid) {
            throw new ForbiddenError('Forbidden');
        }

        const totalMessages = validation.data.readMessageCount;

        const batch = db.batch();
        batch.set(userRef.collection('groupStates').doc(groupId), {
            readMessageCount: totalMessages,
            lastReadAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Update memberLastReadAt for immediate UI sync.
        batch.update(groupRef, {
            [`memberLastReadAt.${uid}`]: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update the member's private document for deep history/archiving.
        batch.set(groupRef.collection('members').doc(uid), {
            lastReadAt: admin.firestore.FieldValue.serverTimestamp(),
            lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
            readMessageCount: totalMessages
        }, { merge: true });

        console.log(`[API] Updating read status: uid=${uid}, groupId=${groupId}, readCount=${totalMessages}`);
        await batch.commit();

        res.json({ success: true });
    } catch (error) {
        console.error('Update read status failed:', error);
        sendErrorResponse(res, error, 'Update read status failed');
    }
});

router.post('/announce-unity', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const validation = announceUnitySchema.safeParse(req.body);
        if (!validation.success) throw new ValidationError('Invalid input');

        const { groupId } = validation.data;
        const uid = req.user?.uid;
        if (!uid) throw new ValidationError('Unauthorized');

        const groupRef = db.collection('groups').doc(groupId);

        await db.runTransaction(async (transaction) => {
            const groupDoc = await transaction.get(groupRef);
            if (!groupDoc.exists) throw new NotFoundError('Group not found');

            const latestRef = groupRef.collection('messages_latest').doc('latest');
            const latestSnap = await transaction.get(latestRef);

            const groupData = groupDoc.data()! as GroupDocument;
            const members = groupData.members || [];
            const ownerUserId = groupData.ownerUserId || '';
            if (!members.includes(uid) && ownerUserId !== uid) {
                throw new ForbiddenError('Forbidden');
            }

            if (groupData.isAiGroup || groupData.aiCompanionUid === 'ai-partner-bot') {
                return;
            }

            if (groupData.isDemoGroup) {
                const active = groupData.dailyActivity?.activeMembers || [];
                if (!active.includes(uid)) {
                    return;
                }
            }

            const effectiveTimeZone = groupData.timeZone || 'UTC';
            let todayStr;
            try {
                todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: effectiveTimeZone });
            } catch {
                todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'UTC' });
            }

            const lastAnnouncementDate = groupData.lastUnityAnnouncementDate;
            if (lastAnnouncementDate === todayStr) {
                return;
            }

            transaction.update(groupRef, {
                lastUnityAnnouncementDate: todayStr
            });

            const messageRef = groupRef.collection('messages').doc();
            const unityMsg = {
                senderId: 'system',
                isSystemMessage: true,
                messageType: 'unityAnnouncement',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };
            transaction.set(messageRef, unityMsg);
            await MessageService.appendToLatest(transaction, groupId, { id: messageRef.id, ...unityMsg, createdAt: admin.firestore.Timestamp.now() }, latestSnap);
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Announce unity failed:', error);
        sendErrorResponse(res, error, 'Announce unity failed');
    }
});

router.post('/kick-member', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const validation = kickMemberSchema.safeParse(req.body);
        if (!validation.success) throw new ValidationError('Invalid input');

        const { groupId, targetUid } = validation.data;
        const uid = req.user!.uid;

        await runPhasedTransaction(db, {
            read: async (transaction) => {
                const groupRef = db.collection('groups').doc(groupId);
                const userRef = db.collection('users').doc(targetUid);
                const [gSnap, uSnap] = await Promise.all([
                    transaction.get(groupRef),
                    transaction.get(userRef)
                ]);
                return { gSnap, uSnap };
            },
            write: async (transaction, { gSnap, uSnap }) => {
                const gData = gSnap.data()! as GroupDocument;
                const uData = uSnap.data() as UserDocument | undefined;

                // 1. Validation: Only owner can kick
                if (gData.ownerUserId !== uid) {
                    throw new ForbiddenError('Only the group owner can kick members.');
                }

                // 2. Validation: Cannot kick yourself
                if (targetUid === uid) {
                    throw new ValidationError('You cannot kick yourself. Please use the leave group option if you wish to exit.');
                }

                // 3. Validation: Group/User existence
                if (!gSnap.exists) throw new NotFoundError('Group not found.');
                if (!uSnap.exists) throw new NotFoundError('Target user not found.');
                if (!uData) throw new NotFoundError('Target user data unavailable.');

                // 4. Validation: Must be a member
                if (!(gData.members || []).includes(targetUid)) {
                    throw new ValidationError('Target user is not a member of this group.');
                }

                // 5. USE CENTRALIZED UTILITY
                await removeMemberFromGroup(transaction, groupId, targetUid, {
                    removeFromUserDoc: true,
                    clearUserGroupId: true,
                    removeGroupState: true,
                    preferredLanguage: uData.language || 'en',
                    systemMessage: {
                        type: 'kick',
                        nickname: uData.nickname || 'Someone'
                    },
                    groupDoc: gSnap,
                    userDoc: uSnap
                });
            }
        });

        res.json({ success: true });
    } catch (err) {
        console.error('Kick member failed:', err);
        sendErrorResponse(res, err, 'Kick failed');
    }
});

// Update Kick Threshold
router.post('/update-kick-threshold', authenticate, requireEmailVerified, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const validation = updateKickThresholdSchema.safeParse(req.body);
        if (!validation.success) {
            throw new ValidationError('Invalid input');
        }

        const { threshold } = validation.data;
        const uid = req.user?.uid;
        if (!uid) throw new ValidationError('Unauthorized');

        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            console.error(`UserDoc not found for UID: ${uid}`);
            throw new NotFoundError('User not found');
        }

        const userData = userDoc.data()! as UserDocument;
        const groupIds = userData.groupIds || (userData.groupId ? [userData.groupId] : []);

        const userUpdate: admin.firestore.UpdateData<UserDocument> = {
            kickThreshold: threshold,
            hasSetKickThreshold: true
        };

        await userRef.update(userUpdate);

        if (groupIds.length > 0) {
            const batch = db.batch();
            groupIds.forEach((gid: string) => {
                const gRef = db.collection('groups').doc(gid);

                // Update the new scalable subcollection
                batch.set(gRef.collection('members').doc(uid), {
                    kickThreshold: threshold
                }, { merge: true });

                // Also update the legacy map for backward compatibility in dashboards
                batch.set(gRef, {
                    memberKickThresholds: {
                        [uid]: threshold
                    }
                }, { merge: true });
            });
            await batch.commit();
        }

        res.json({ success: true, cleanedUpGroups: [] });
    } catch (error) {
        console.error('Update threshold failed:', error);
        sendErrorResponse(res, error, 'Update threshold failed');
    }
});

// Delete Group
router.post('/delete-group', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const validation = deleteGroupSchema.safeParse(req.body);
        if (!validation.success) throw new ValidationError('Invalid input');

        const { groupId } = validation.data;
        const uid = req.user?.uid;
        if (!uid) throw new ValidationError('Unauthorized');

        const groupRef = db.collection('groups').doc(groupId);
        const groupDoc = await groupRef.get();

        if (!groupDoc.exists) throw new NotFoundError('Group not found');
        const groupData = groupDoc.data()! as GroupDocument;

        if (groupData.ownerUserId !== uid) {
            throw new ForbiddenError('Forbidden: Only owner can delete group');
        }

        const members = groupData.members || [];
        const userRefs = members.map((mUid: string) => db.collection('users').doc(mUid));

        // TRUTH: Process user updates in chunks of 200 to stay within Firestore's 500-write limit.
        // Each user needs 2 writes (UserDoc update + groupState delete).
        const CHUNK_SIZE = 200;
        for (let i = 0; i < userRefs.length; i += CHUNK_SIZE) {
            const batch = db.batch();
            const chunkRefs = userRefs.slice(i, i + CHUNK_SIZE);
            const userDocs = await db.getAll(...chunkRefs);

            userDocs.forEach((userDoc) => {
                if (!userDoc.exists) return;
                const uRef = userDoc.ref;
                const userData = userDoc.data()! as UserDocument;
                const updatePayload: admin.firestore.UpdateData<UserDocument> = {
                    groupIds: admin.firestore.FieldValue.arrayRemove(groupId)
                };

                if (userData.groupId === groupId) {
                    updatePayload.groupId = admin.firestore.FieldValue.delete();
                }

                batch.update(uRef, updatePayload);
                const gsRef = uRef.collection('groupStates').doc(groupId);
                batch.delete(gsRef);
            });
            await batch.commit();
        }

        // Final cleanup of the group and its subcollections
        await db.recursiveDelete(groupRef);

        res.json({ success: true });
    } catch (error) {
        console.error('Group deletion failed:', error);
        sendErrorResponse(res, error, 'Group deletion failed');
    }
});

router.post('/update-group', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const validation = updateGroupSchema.safeParse(req.body);
        if (!validation.success) {
            throw new ValidationError('Invalid input');
        }

        const { groupId, name, description, isPublic, isPrivate, timeZone, translations } = validation.data;
        const uid = req.user?.uid;
        if (!uid) throw new ValidationError('Unauthorized');

        const groupRef = db.collection('groups').doc(groupId);
        const groupDoc = await groupRef.get();

        if (!groupDoc.exists) throw new NotFoundError('Group not found');
        const groupData = groupDoc.data()! as GroupDocument;

        if (groupData.ownerUserId !== uid) {
            throw new ForbiddenError('Forbidden: Only owner can update group');
        }

        const updatePayload: Partial<GroupDocument> = {};
        if (name !== undefined) updatePayload.name = name;
        if (description !== undefined) updatePayload.description = description;
        if (isPublic !== undefined) updatePayload.isPublic = isPublic;
        if (isPrivate !== undefined) updatePayload.isPrivate = isPrivate;
        if (timeZone !== undefined) updatePayload.timeZone = timeZone;
        if (translations !== undefined) updatePayload.translations = translations as GroupDocument['translations'];

        if (Object.keys(updatePayload).length === 0) {
            throw new ValidationError('No updates provided');
        }

        await groupRef.update(updatePayload as admin.firestore.UpdateData<GroupDocument>);
        res.json({ success: true });
    } catch (error) {
        console.error('Update group failed:', error);
        sendErrorResponse(res, error, 'Update group failed');
    }
});

/**
 * Helper to generate a unique 6-character alphanumeric invite code.
 */
async function generateUniqueInviteCode(transaction?: admin.firestore.Transaction): Promise<string> {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars O, 0, I, 1
    const groupsRef = db.collection('groups');
    let code = '';
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
        code = '';
        for (let i = 0; i < 6; i++) {
            code += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        
        // Use the provided transaction if available, otherwise use regular get()
        let existing;
        if (transaction) {
            existing = await transaction.get(groupsRef.where('inviteCode', '==', code).limit(1));
        } else {
            existing = await groupsRef.where('inviteCode', '==', code).limit(1).get();
        }
        
        if (existing.empty) {
            isUnique = true;
        }
        attempts++;
    }
    return code;
}

/**
 * Generate/Refresh Invite Code
 */
router.post('/regenerate-invite-code', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const validation = regenerateInviteCodeSchema.safeParse(req.body);
        if (!validation.success) throw new ValidationError('Invalid input');

        const { groupId, expiryDays = 7 } = validation.data;
        const uid = req.user!.uid;

        const groupRef = db.collection('groups').doc(groupId);
        const { inviteCode, inviteCodeExpiresAt } = await db.runTransaction(async (transaction) => {
            const gSnap = await transaction.get(groupRef);
            if (!gSnap.exists) throw new NotFoundError('Group not found');
            const gData = gSnap.data()! as GroupDocument;
            if (gData.ownerUserId !== uid) throw new ForbiddenError('Only owner can regenerate codes');

            const code = await generateUniqueInviteCode(transaction);
            const expires = admin.firestore.Timestamp.fromDate(new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000));

            transaction.update(groupRef, {
                inviteCode: code,
                inviteCodeExpiresAt: expires
            });
            
            return { inviteCode: code, inviteCodeExpiresAt: expires };
        });

        res.status(200).json({ success: true, inviteCode, expiresAt: inviteCodeExpiresAt.toDate().toISOString() });
    } catch (err) {
        console.error('Error regenerating invite code:', err);
        sendErrorResponse(res, err, 'Failed to generate invite code');
    }
});

// Fetch Public Groups
router.get('/', async (req: Request, res: Response) => {
    try {
        const limitAmount = Math.min(parseInt(req.query.limit as string) || 20, 100);
        const lastId = req.query.lastId as string;

        let query = db.collection('groups')
            .where('isPublic', '==', true)
            .orderBy('lastMessageAt', 'desc')
            .orderBy(admin.firestore.FieldPath.documentId(), 'desc');

        if (lastId) {
            // ALWAYS fetch the doc if lastId is provided for 100% reliable pagination
            const lastDoc = await db.collection('groups').doc(lastId).get();
            if (lastDoc.exists) {
                // Using the document snapshot directly is the most reliable way to handle composite cursors
                query = query.startAfter(lastDoc);
            }
        }

        const snapshot = await query.limit(limitAmount).get();

        const groups = snapshot.docs.map(doc => {
            const data = doc.data() as GroupDocument;
            return {
                id: doc.id,
                name: data.name,
                description: data.description,
                membersCount: data.membersCount || 0,
                memberPreviews: data.memberPreviews || [],
                lastNoteByNickname: data.lastNoteByNickname || '',
                lastNoteAt: data.lastNoteAt ? (data.lastNoteAt as admin.firestore.Timestamp).toDate().toISOString() : null,
                lastMessageAt: data.lastMessageAt ? (data.lastMessageAt as admin.firestore.Timestamp).toDate().toISOString() : null,
                isPublic: true,
                createdAt: data.createdAt ? (data.createdAt as admin.firestore.Timestamp).toDate().toISOString() : null,
                translations: data.translations
            };
        });

        res.json(groups);
    } catch (error: unknown) {
        console.error('Error fetching groups:', error);
        sendErrorResponse(res, error, 'Search failed');
    }
});

// Group Preview
router.get('/group-preview/:inviteCode', async (req: Request, res: Response) => {
    const { inviteCode } = req.params;

    try {
        const snapshot = await db.collection('groups').where('inviteCode', '==', inviteCode).limit(1).get();
        if (snapshot.empty) throw new NotFoundError('Group not found');

        const groupData = snapshot.docs[0].data();

        if (groupData.inviteCodeExpiresAt) {
            const expiresAt = groupData.inviteCodeExpiresAt.toDate();
            if (expiresAt < new Date()) {
                throw new AppError('Invite link expired', 410, 'EXPIRED_INVITE_LINK');
            }
        }

        const language = (req.query.language as string) || (req.query.lang as string) || 'en';
        const translation = groupData.translations?.[language] || groupData.translations?.['en'];

        res.json({
            name: translation?.name || groupData.name,
            description: translation?.description || groupData.description,
            membersCount: (groupData.members || []).length,
            isPrivate: groupData.isPrivate || false
        });
    } catch (error: unknown) {
        console.error('Group preview failed:', error);
        sendErrorResponse(res, error, 'Fetch failed');
    }
});

export default router;
