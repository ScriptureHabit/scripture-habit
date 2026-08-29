import express, { Response } from 'express';
import { admin, db } from '../lib/firebase-admin.js';
import { verifyAppCheck, authenticate, demoInitLimiter, AuthenticatedRequest } from '../lib/middleware.js';
import { sendErrorResponse, ValidationError } from '../lib/errors.js';
import { z } from 'zod';
import { GroupDocument, UserDocument } from '../../types/firestore.js';
import { getDemoGroupTranslations, t } from '../lib/i18n.js';
import { getDemoExpireAt } from '../lib/ttl-utils.js';

const router = express.Router();

const initializeDemoSchema = z.object({
    language: z.string().optional().default('ja')
});

/**
 * POST /api/demo/initialize
 * Initializes an isolated sandbox environment for an anonymous user.
 */
router.post('/initialize', demoInitLimiter, authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const validation = initializeDemoSchema.safeParse(req.body);
        if (!validation.success) {
            throw new ValidationError('Invalid input');
        }

        const uid = req.user!.uid;
        const language = validation.data.language || 'ja';

        const demoUserNickname = t(language, 'demo.demoUser') || 'Demo User';
        const demoGroupName = t(language, 'onboardingQuest.demoGroupName') || 'Daily Bread 📖';
        const demoGroupDesc = t(language, 'onboardingQuest.demoGroupDesc') || 'A warm study group to read scriptures together daily! ✨';
        const demoSeedMessageText = t(language, 'onboardingQuest.demoSeedMessage1') || 'Welcome to Daily Bread! Let us support each other in our daily scripture habit 🎉';

        const now = Date.now();

        const getDateStr = (daysAgo: number) => {
            const d = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
            return d.toLocaleDateString('sv-SE'); // YYYY-MM-DD
        };

        const studiedDates: string[] = [];
        for (let i = 999; i >= 1; i--) {
            studiedDates.push(getDateStr(i));
        }

        const oneDayAgoTimestamp = admin.firestore.Timestamp.fromMillis(now - 1 * 24 * 60 * 60 * 1000);
        const currentTimestamp = admin.firestore.Timestamp.fromMillis(now);
        const demoGroupId = `demo-group-${uid}`;

        const batch = db.batch();

        // 1. User Document (999-day streak ready for the milestone 1,000th note post!)
        const userRef = db.collection('users').doc(uid);
        const userData: UserDocument = {
            uid: uid,
            nickname: demoUserNickname,
            photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}`,
            streakCount: 999,
            highestStreak: 999,
            totalNotes: 999,
            daysStudiedCount: 999,
            studiedDates: studiedDates,
            language: language,
            groupIds: [demoGroupId],
            groupId: demoGroupId,
            hasSeenWelcomeStory: true,
            hasSeenTour: true,
            hasCompletedOnboarding: false,
            questCreatedGroup: true,
            questPostedNote: false,
            isAnonymousDemo: true,
            createdAt: admin.firestore.Timestamp.fromMillis(now - 999 * 24 * 60 * 60 * 1000),
            lastActiveAt: currentTimestamp,
            lastPostAt: oneDayAgoTimestamp,
            kickThreshold: 7,
            hasSetKickThreshold: true,
            expireAt: getDemoExpireAt()
        };
        batch.set(userRef, userData, { merge: true });

        // 2. Demo Group (Daily Bread 📖) pre-joined by user
        const groupRef = db.collection('groups').doc(demoGroupId);
        const groupData: GroupDocument = {
            name: demoGroupName,
            description: demoGroupDesc,
            translations: getDemoGroupTranslations(language),
            members: ['bot-alice', 'bot-bob', 'bot-charlie', uid],
            membersCount: 4,
            ownerUserId: 'bot-alice',
            maxMembers: 5,
            isPrivate: true,
            isPublic: false,
            isDemoGroup: true,
            groupStreak: 7,
            unityPercentage: 67,
            inviteCode: `DEMO${uid.slice(0, 4).toUpperCase()}`,
            memberPreviews: [
                {
                    uid: 'bot-alice',
                    nickname: 'Alice 📖'
                },
                {
                    uid: 'bot-bob',
                    nickname: 'Bob 🔥'
                },
                {
                    uid: 'bot-charlie',
                    nickname: 'Charlie 💤'
                },
                {
                    uid: uid,
                    nickname: demoUserNickname
                }
            ],
            memberJoinedAt: {
                'bot-alice': admin.firestore.Timestamp.fromMillis(now - 14 * 24 * 60 * 60 * 1000),
                'bot-bob': admin.firestore.Timestamp.fromMillis(now - 20 * 24 * 60 * 60 * 1000),
                'bot-charlie': admin.firestore.Timestamp.fromMillis(now - 5 * 24 * 60 * 60 * 1000),
                [uid]: currentTimestamp
            },
            memberLastActive: {
                'bot-alice': admin.firestore.Timestamp.fromMillis(now - 4 * 60 * 60 * 1000),
                'bot-bob': admin.firestore.Timestamp.fromMillis(now - 2 * 60 * 60 * 1000),
                'bot-charlie': admin.firestore.Timestamp.fromMillis(now - 2 * 24 * 60 * 60 * 1000),
                [uid]: currentTimestamp
            },
            memberLastReadAt: {
                'bot-alice': admin.firestore.Timestamp.fromMillis(now - 4 * 60 * 60 * 1000),
                'bot-bob': admin.firestore.Timestamp.fromMillis(now - 2 * 60 * 60 * 1000),
                'bot-charlie': admin.firestore.Timestamp.fromMillis(now - 2 * 24 * 60 * 60 * 1000),
                [uid]: currentTimestamp
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
        batch.set(groupRef, groupData, { merge: true });

        // Add demo user to group members subcollection
        const userMemberRef = groupRef.collection('members').doc(uid);
        batch.set(userMemberRef, {
            joinedAt: currentTimestamp,
            lastActiveAt: currentTimestamp,
            kickThreshold: 7
        });

        // 3. Messages inside the Public Demo Group
        const seedMessages = [
            {
                id: `demo-msg-1-${uid}`,
                text: demoSeedMessageText,
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
            batch.set(groupRef.collection('messages').doc(msg.id), msg, { merge: true });
        }

        // Also initialize messages_latest/latest so group chat reads it immediately
        const latestDocRef = groupRef.collection('messages_latest').doc('latest');
        batch.set(latestDocRef, {
            groupId: demoGroupId,
            messages: seedMessages,
            lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        await batch.commit();

        res.json({
            success: true,
            groupId: demoGroupId,
            message: 'Sandbox demo environment initialized successfully.'
        });
    } catch (err) {
        console.error('[DemoInit] Failed to initialize demo sandbox:', err);
        sendErrorResponse(res, err, 'Failed to initialize demo sandbox.');
    }
});

export default router;
