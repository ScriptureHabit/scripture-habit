import { db, auth, admin } from '../api_internal/lib/firebase-admin.js';
import type { Timestamp } from 'firebase-admin/firestore';
import { buildNoteSearchTokens } from '../src/utils/search-token-utils.js';
import { formatNoteText } from '../src/utils/note-logic.js';

async function seedExistingUser() {
    console.log('🌱 Starting local database seeding sequence (Existing User with Group & Streak)...');

    // 1. Strict verification of Emulator environment
    const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
    const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;

    const isLocalHost = (host?: string) => {
        if (!host) return false;
        return host.includes('127.0.0.1') || host.includes('localhost') || host.includes('::1');
    };

    if (!firestoreHost || !authHost || !isLocalHost(firestoreHost) || !isLocalHost(authHost)) {
        console.error('❌ CRITICAL SECURITY ERROR: Database seeding aborted.');
        console.error('Seeding is only allowed against a local emulator loopback (127.0.0.1 or localhost).');
        console.error(`Firestore Host: ${firestoreHost}`);
        console.error(`Auth Host:      ${authHost}`);
        process.exit(1);
    }

    // 2. Double safeguard check on resolved Project ID to prevent targeting production database
    const resolvedProjectId = admin.app().options.projectId;
    const isProdProject = resolvedProjectId === 'scripture-habit' || resolvedProjectId?.endsWith('-prod') || process.env.NODE_ENV === 'production';

    if (isProdProject) {
        console.error('❌ CRITICAL SECURITY ERROR: Seeding script blocked!');
        console.error(`The resolved Project ID "${resolvedProjectId}" indicates a production or remote database.`);
        console.error('To protect production data, database seeding is strictly forbidden on this project.');
        process.exit(1);
    }

    console.log(`Firestore Emulator: ${process.env.FIRESTORE_EMULATOR_HOST}`);
    console.log(`Auth Emulator:      ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);

    const users = [
        {
            uid: 'seeder-existing-user',
            email: 'existing-user@example.com',
            nickname: 'existing-user',
            photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=existing-user',
            streakCount: 8,
            highestStreak: 8,
            totalNotes: 8,
            language: 'ja'
        },
        {
            uid: 'seeder-alice',
            email: 'alice@example.com',
            nickname: 'Alice 📖',
            photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=Alice',
            streakCount: 5,
            highestStreak: 12,
            totalNotes: 24,
            language: 'en'
        },
        {
            uid: 'seeder-bob',
            email: 'bob@example.com',
            nickname: 'Bob 🔥',
            photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=Bob',
            streakCount: 14,
            highestStreak: 14,
            totalNotes: 42,
            language: 'en'
        },
        {
            uid: 'seeder-charlie',
            email: 'charlie@example.com',
            nickname: 'Charlie 💤',
            photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=Charlie',
            streakCount: 0,
            highestStreak: 2,
            totalNotes: 2,
            language: 'en'
        }
    ];

    const groupId = 'seed-group-daily-bread';
    const groupName = 'Daily Bread 📖';
    const inviteCode = 'BREAD123';

    // 1. Delete existing seed users from Auth and Firestore to keep seeding idempotent
    console.log('🧹 Purging old seed users for idempotency...');
    const usersToClean = [...users.map(u => u.uid), 'seeder-demo-user', 'seeder-dev-user'];
    for (const uid of usersToClean) {
        try {
            await auth.deleteUser(uid);
        } catch {
            // Ignore if user does not exist
        }
        try {
            await db.recursiveDelete(db.collection('users').doc(uid));
        } catch {
            await db.collection('users').doc(uid).delete();
        }
    }

    // Delete group if exists
    try {
        await db.recursiveDelete(db.collection('groups').doc(groupId));
        console.log(`🧹 Purged existing seed group: ${groupId}`);
    } catch {
        // Ignore
    }

    // 2. Create Auth Accounts & Firestore User Profiles
    console.log('👥 Creating Auth accounts and Firestore user documents...');
    const uids = users.map(u => u.uid);
    const now = admin.firestore.Timestamp.now();
    const threeDaysAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const getDateStr = (daysAgo: number) => {
        const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
        return d.toLocaleDateString('sv-SE'); // YYYY-MM-DD
    };

    for (const u of users) {
        await auth.createUser({
            uid: u.uid,
            email: u.email,
            password: 'password123',
            displayName: u.nickname,
            emailVerified: true
        });

        const studiedDates = u.uid === 'seeder-existing-user'
            ? [getDateStr(7), getDateStr(6), getDateStr(5), getDateStr(4), getDateStr(3), getDateStr(2), getDateStr(1), getDateStr(0)]
            : u.uid === 'seeder-alice'
                ? [getDateStr(5), getDateStr(4), getDateStr(3), getDateStr(2), getDateStr(1)]
                : u.uid === 'seeder-bob'
                    ? [getDateStr(3), getDateStr(2), getDateStr(1)]
                    : [];

        await db.collection('users').doc(u.uid).set({
            uid: u.uid,
            nickname: u.nickname,
            photoURL: u.photoURL,
            groupIds: [groupId],
            groupId: groupId,
            streakCount: u.streakCount,
            highestStreak: u.highestStreak,
            daysStudiedCount: u.streakCount,
            studiedDates: studiedDates,
            totalNotes: u.totalNotes,
            language: u.language,
            lastPostAt: admin.firestore.Timestamp.fromMillis(Date.now() - 1 * 24 * 60 * 60 * 1000),
            createdAt: threeDaysAgo,
            hasSetKickThreshold: true,
            kickThreshold: 3,
            hasCompletedOnboarding: true,
            questCreatedGroup: true,
            questPostedNote: true
        });

        // Seed demo notes for existing-user so "My Notes" and calendar feel rich and alive
        if (u.uid === 'seeder-existing-user') {
            interface DemoNote {
                id: string;
                scripture: string;
                chapter: string;
                comment: string;
                title?: string;
                speaker?: string;
                createdAt: Timestamp;
                sharedWithGroups: string[];
            }

            const demoNotes: DemoNote[] = [
                {
                    id: 'seed-demo-note-1',
                    scripture: 'Book of Mormon',
                    chapter: 'ニーファイ第一書 1:1',
                    comment: '「わたし、ニーファイは、善良な両親から生まれたので...」聖典学習の第一歩を踏み出しました！日々の小さな積み重ねを大切にしていきたいです。',
                    createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000),
                    sharedWithGroups: [groupId]
                },
                {
                    id: 'seed-demo-note-2',
                    scripture: 'Book of Mormon',
                    chapter: 'ニーファイ第一書 3:7',
                    comment: '「主が命じられることには、それを成し遂げる道を備えてくださる」困難な仕事や課題に直面したとき、いつもこの聖句が勇気と行動力を与えてくれます。',
                    createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 6 * 24 * 60 * 60 * 1000),
                    sharedWithGroups: [groupId]
                },
                {
                    id: 'seed-demo-note-3',
                    scripture: 'Old Testament',
                    chapter: '創世記 1:1-3',
                    comment: '「初めに、神は天地を創造された...光あれ」暗闇の中に秩序と希望をもたらす神の御力を深く味わいました。今日一日を光の心で過ごしたいです。',
                    createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 5 * 24 * 60 * 60 * 1000),
                    sharedWithGroups: [groupId]
                },
                {
                    id: 'seed-demo-note-4',
                    scripture: 'New Testament',
                    chapter: 'ヨハネによる福音書 14:27',
                    comment: '「わたしは平安をあなたがたに残す。わたしの平安をあなたがたに与える」世の中の不安や忙しさに囲まれても、キリストに心を向けることで真の心の静けさを得られると学びました。',
                    createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 4 * 24 * 60 * 60 * 1000),
                    sharedWithGroups: [groupId]
                },
                {
                    id: 'seed-demo-note-5',
                    scripture: 'Doctrine and Covenants',
                    chapter: '第6編 36節',
                    comment: '「あらゆる思いの中でわたしを仰ぎ見なさい。疑ってはならない。恐れてはならない」迷いや不安が頭をよぎった時、すぐに祈りによって主を見上げる習慣をつけたいと思います。',
                    createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 3 * 24 * 60 * 60 * 1000),
                    sharedWithGroups: [groupId]
                },
                {
                    id: 'seed-demo-note-6',
                    scripture: 'General Conference',
                    chapter: '2024年4月総大会',
                    title: '主の導きに従う信仰',
                    speaker: 'ラッセル・M・ネルソン大管長',
                    comment: '日々の小さな善い選択が、長い年月をかけて私たちの人格と霊性を形作るというメッセージに深く感銘を受けました。聖典学習もその大切な一部です。',
                    createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 2 * 24 * 60 * 60 * 1000),
                    sharedWithGroups: [groupId]
                },
                {
                    id: 'seed-demo-note-7',
                    scripture: 'Pearl of Great Price',
                    chapter: 'モーセ書 1:39',
                    comment: '「人の不死不滅と永遠の命をもたらすこと、これがわたしの業であり、栄光である」神様の御計画の中心に私たちがいることを思い起こし、感謝と畏敬の念で満たされました。',
                    createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 1 * 24 * 60 * 60 * 1000),
                    sharedWithGroups: [groupId]
                },
                {
                    id: 'seed-demo-note-8',
                    scripture: 'Book of Mormon',
                    chapter: 'アルマ書 32:28',
                    comment: '「信仰を試すために、み言葉の種を心に植えなさい」み言葉が心の中で膨らみ、理解が明るくなり、霊的な喜びが芽生えてくるのを実感しています。今日も一歩前進！',
                    createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 1 * 60 * 60 * 1000),
                    sharedWithGroups: [groupId]
                }
            ];

            for (const note of demoNotes) {
                const text = formatNoteText(note.scripture, note.chapter, note.comment);
                const searchTokens = buildNoteSearchTokens({
                    scripture: note.scripture,
                    chapter: note.chapter,
                    comment: note.comment,
                    title: note.title,
                    speaker: note.speaker
                });
                await db.collection('users').doc(u.uid).collection('notes').doc(note.id).set({
                    ...note,
                    text,
                    searchTokens
                });
            }
        }

        // Seed Developer Welcome Letter in user's letterbox
        const welcomeLetterContent = u.language === 'ja'
            ? `${u.nickname}さんを心から歓迎いたします。\n\n普段、忙しい生活を送る中で聖典を開き、聖文に心を向ける習慣を持つことは、時に小さな挑戦のように感じられるかもしれません。たとえ1日1節でも、短い感想を書き残すだけでも、その小さな積み重ねはあなたの生活に確かな平安と光をもたらします。\n\nノートを2回投稿すると、あなたの気づきや学びをふり返る「特別な手紙」が届くようになります。ぜひ、今日感じたことを最初のノートに綴ってみてくださいね。\n\nあなたのこれからの人生が、豊かな祝福と喜びにみたされますように。\n\nScripture Habit 開発者より`
            : `A warm welcome to you, ${u.nickname}.\n\nIn our busy daily lives, opening the scriptures and turning our hearts to the sacred word can sometimes feel like a small challenge. Yet, even reading just one verse a day or writing down a short reflection, that small accumulation will surely bring true peace and light into your life.\n\nOnce you post 2 notes, you will receive a special reflection letter looking back on your insights and learning. We encourage you to write down what you felt today in your very first note!\n\nMay your life ahead be filled with abundant blessings and joy.\n\n— Scripture Habit Developer`;

        await db.collection('users').doc(u.uid).collection('letters').doc('seed-welcome-letter').set({
            title: u.language === 'ja' ? 'ようこそ、Scripture Habitへ' : 'Welcome to Scripture Habit',
            content: welcomeLetterContent,
            type: 'developer_welcome',
            createdAt: threeDaysAgo,
            read: false
        });

        console.log(`   Created User: ${u.nickname} (${u.email}) with ${studiedDates.length} studied dates`);
    }

    // 3. Create Group Document
    console.log(`📦 Seeding group: "${groupName}"...`);
    const joinedAtMap: Record<string, Timestamp> = {};
    const memberLastActiveMap: Record<string, Timestamp> = {};
    const memberKickThresholds: Record<string, number> = {};

    for (const uid of uids) {
        joinedAtMap[uid] = threeDaysAgo;
        memberLastActiveMap[uid] = now;
        memberKickThresholds[uid] = uid === 'seeder-charlie' ? 1 : 3; // Charlie has a 1-day threshold
    }

    // Simulate Charlie last active 2 days ago (which triggers kick logic during sweeps)
    memberLastActiveMap['seeder-charlie'] = admin.firestore.Timestamp.fromMillis(Date.now() - 2 * 24 * 60 * 60 * 1000);

    await db.collection('groups').doc(groupId).set({
        name: groupName,
        inviteCode: inviteCode,
        inviteCodeExpiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000), // Expires in 30 days
        members: uids,
        membersCount: uids.length,
        isPublic: true,
        ownerUserId: 'seeder-existing-user',
        messageCount: 0,
        lastMessageAt: now,
        lastMessageText: 'Seed database setup complete!',
        lastMessageByNickname: 'System',
        lastMessageByUid: 'system',
        dailyActivity: {
            activeMembers: ['seeder-existing-user', 'seeder-alice', 'seeder-bob'],
            date: new Date().toLocaleDateString('sv-SE') // Sweden format YYYY-MM-DD
        },
        memberJoinedAt: joinedAtMap,
        memberLastActive: memberLastActiveMap,
        memberKickThresholds: memberKickThresholds,
        timeZone: 'Asia/Tokyo'
    });

    // 4. Seed Subcollections: Members & Messages
    console.log('📥 Seeding group subcollections (members & messages)...');
    
    // Seed Members subcollection
    for (const u of users) {
        await db.collection('groups').doc(groupId).collection('members').doc(u.uid).set({
            uid: u.uid,
            nickname: u.nickname,
            photoURL: u.photoURL,
            joinedAt: joinedAtMap[u.uid] || now,
            lastActive: memberLastActiveMap[u.uid] || now,
            kickThreshold: memberKickThresholds[u.uid] || 3,
            status: u.streakCount > 0 ? 'active' : 'idle'
        });
    }

    // Seed Messages subcollection with authentic study note postings and system announcements
    const messages = [
        {
            id: 'msg-seed-1',
            text: 'Hello everyone! Welcome to our study habit group! Let’s keep up the daily readings. 📖🔥',
            senderId: 'seeder-alice',
            senderNickname: 'Alice 📖',
            userPhotoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=Alice',
            createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 2 * 24 * 60 * 60 * 1000),
            isNote: false
        },
        {
            id: 'msg-seed-2',
            text: '**Old Testament Genesis 1:1**\n\nAmen! I just finished my reading for today. The creation account is truly magnificent and uplifting.',
            senderId: 'seeder-bob',
            senderNickname: 'Bob 🔥',
            userPhotoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=Bob',
            createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 2 * 24 * 60 * 60 * 1000),
            isNote: true,
            scripture: 'Old Testament',
            chapter: 'Genesis 1:1',
            comment: 'Amen! I just finished my reading for today. The creation account is truly magnificent and uplifting.'
        },
        {
            id: 'msg-seed-2-ann',
            senderId: 'system',
            senderNickname: 'System',
            messageType: 'notePostedAnnouncement',
            messageData: {
                nickname: 'Bob 🔥',
                userId: 'seeder-bob'
            },
            createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 2 * 24 * 60 * 60 * 1000 + 1000)
        },
        {
            id: 'msg-seed-3',
            text: 'Great post, Bob! Keep it up! 👏',
            senderId: 'seeder-charlie',
            senderNickname: 'Charlie 💤',
            userPhotoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=Charlie',
            createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 2 * 24 * 60 * 60 * 1000 + 2000),
            isNote: false
        },
        {
            id: 'msg-seed-4',
            text: '**New Testament John 3:16**\n\nDay 2 for me! "For God so loved the world, that he gave his only begotten Son." Grateful for His endless love.',
            senderId: 'seeder-bob',
            senderNickname: 'Bob 🔥',
            userPhotoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=Bob',
            createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 1 * 24 * 60 * 60 * 1000),
            isNote: true,
            scripture: 'New Testament',
            chapter: 'John 3:16',
            comment: 'Day 2 for me! "For God so loved the world, that he gave his only begotten Son." Grateful for His endless love.'
        },
        {
            id: 'msg-seed-4-ann',
            senderId: 'system',
            senderNickname: 'System',
            messageType: 'notePostedAnnouncement',
            messageData: {
                nickname: 'Bob 🔥',
                userId: 'seeder-bob'
            },
            createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 1 * 24 * 60 * 60 * 1000 + 1000)
        },
        {
            id: 'msg-seed-5',
            text: '**New Testament Matthew 5:3**\n\n"Blessed are the poor in spirit: for theirs is the kingdom of heaven." Loved reflecting on the Beatitudes today!',
            senderId: 'seeder-alice',
            senderNickname: 'Alice 📖',
            userPhotoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=Alice',
            createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
            isNote: true,
            scripture: 'New Testament',
            chapter: 'Matthew 5:3',
            comment: '"Blessed are the poor in spirit: for theirs is the kingdom of heaven." Loved reflecting on the Beatitudes today!'
        },
        {
            id: 'msg-seed-5-ann',
            senderId: 'system',
            senderNickname: 'System',
            messageType: 'notePostedAnnouncement',
            messageData: {
                nickname: 'Alice 📖',
                userId: 'seeder-alice'
            },
            createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 4 * 60 * 60 * 1000 + 1000)
        },
        {
            id: 'msg-seed-6',
            text: '**Book of Mormon 1 Nephi 3:7**\n\nDay 3 consecutive! "I will go and do the things which the Lord hath commanded." Let us move forward with faith.',
            senderId: 'seeder-bob',
            senderNickname: 'Bob 🔥',
            userPhotoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=Bob',
            createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
            isNote: true,
            scripture: 'Book of Mormon',
            chapter: '1 Nephi 3:7',
            comment: 'Day 3 consecutive! "I will go and do the things which the Lord hath commanded." Let us move forward with faith.'
        },
        {
            id: 'msg-seed-6-ann',
            senderId: 'system',
            senderNickname: 'System',
            messageType: 'notePostedAnnouncement',
            messageData: {
                nickname: 'Bob 🔥',
                userId: 'seeder-bob'
            },
            createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 2 * 60 * 60 * 1000 + 1000)
        }
    ];

    const messageDocuments: Record<string, unknown>[] = [];
    for (const m of messages) {
        await db.collection('groups').doc(groupId).collection('messages').doc(m.id).set(m);
        messageDocuments.push(m);
    }

    // 5. Seed Strategy B cache aggregates: messages_latest/latest
    console.log('⚡ Seeding messages_latest/latest preview cache...');
    await db.collection('groups').doc(groupId).collection('messages_latest').doc('latest').set({
        groupId: groupId,
        messages: messageDocuments.slice(-5).reverse() // Latest 5 messages in reverse order
    });

    console.log('\n==================================================');
    console.log('👥 [Existing User] 既存ユーザー環境をセットアップしました');
    console.log('--------------------------------------------------');
    console.log('🔐 Login Credentials:');
    console.log('   Email:    existing-user@example.com');
    console.log('   Password: password123');
    console.log('   Nickname: existing-user');
    console.log('📖 状態: グループ「Daily Bread 📖」参加中 / ストリーク8日 / ノート8件');
    console.log('==================================================\n');
}

seedExistingUser().catch(err => {
    console.error('❌ Seeding failed with error:', err);
    process.exit(1);
});
