import { db, auth, admin } from '../api_internal/lib/firebase-admin.js';

async function seed() {
    console.log('🌱 Starting local database seeding sequence...');

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
            uid: 'seeder-demo-user',
            email: 'demo-user@example.com',
            nickname: 'demo-user',
            photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=demo-user',
            streakCount: 3,
            highestStreak: 5,
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
    const usersToClean = [...users.map(u => u.uid), 'seeder-dev-user'];
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

        const studiedDates = u.uid === 'seeder-demo-user'
            ? [getDateStr(3), getDateStr(2), getDateStr(1)]
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
            kickThreshold: 3
        });

        // Seed demo notes for demo-user so "My Notes" and calendar feel rich and alive
        if (u.uid === 'seeder-demo-user') {
            const demoNotes = [
                {
                    id: 'seed-demo-note-1',
                    scripture: 'Book of Mormon',
                    chapter: 'ニーファイ第一書 1:1',
                    comment: '「わたし、ニーファイは、善良な両親から生まれたので...」聖典学習の第一歩を踏み出しました！',
                    createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 3 * 24 * 60 * 60 * 1000),
                    sharedWithGroups: [groupId]
                },
                {
                    id: 'seed-demo-note-2',
                    scripture: 'Book of Mormon',
                    chapter: 'ニーファイ第一書 2:16',
                    comment: '「わたしは神の奥義を知りたいと強く望んだので、主に叫び求めた」祈りの大切さを感じました。',
                    createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 2 * 24 * 60 * 60 * 1000),
                    sharedWithGroups: [groupId]
                },
                {
                    id: 'seed-demo-note-3',
                    scripture: 'Book of Mormon',
                    chapter: 'ニーファイ第一書 3:7',
                    comment: '「主が命じられることには、それを成し遂げる道を備えてくださる」勇気をもらいました。',
                    createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 1 * 24 * 60 * 60 * 1000),
                    sharedWithGroups: [groupId]
                }
            ];

            for (const note of demoNotes) {
                await db.collection('users').doc(u.uid).collection('notes').doc(note.id).set(note);
            }
        }

        console.log(`   Created User: ${u.nickname} (${u.email}) with ${studiedDates.length} studied dates`);
    }

    // 3. Create Group Document
    console.log(`📦 Seeding group: "${groupName}"...`);
    const joinedAtMap: Record<string, admin.firestore.Timestamp> = {};
    const memberLastActiveMap: Record<string, admin.firestore.Timestamp> = {};
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
        ownerUserId: 'seeder-demo-user',
        messageCount: 0,
        lastMessageAt: now,
        lastMessageText: 'Seed database setup complete!',
        lastMessageByNickname: 'System',
        lastMessageByUid: 'system',
        dailyActivity: {
            activeMembers: ['seeder-demo-user', 'seeder-alice', 'seeder-bob'],
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

    console.log('🎉 Seeding successfully completed!');
    console.log('--------------------------------------------------');
    console.log('🔐 Demo login credentials:');
    console.log('   Email:    demo-user@example.com');
    console.log('   Password: password123');
    console.log('   Nickname: demo-user');
    console.log('--------------------------------------------------');
}

seed().catch(err => {
    console.error('❌ Seeding failed with error:', err);
    process.exit(1);
});
