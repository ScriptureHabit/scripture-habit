import { db, auth, admin } from '../api_internal/lib/firebase-admin.js';

async function seed() {
    console.log('🌱 Starting local database seeding sequence...');

    if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
        console.error('❌ ERROR: Emulator hosts are not set in the environment!');
        console.error('Please make sure FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST are defined.');
        process.exit(1);
    }

    console.log(`Firestore Emulator: ${process.env.FIRESTORE_EMULATOR_HOST}`);
    console.log(`Auth Emulator:      ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);

    const users = [
        {
            uid: 'seeder-dev-user',
            email: 'dev-user@example.com',
            nickname: 'Developer',
            photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=Developer',
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
    for (const u of users) {
        try {
            await auth.deleteUser(u.uid);
        } catch {
            // Ignore if user does not exist
        }
        await db.collection('users').doc(u.uid).delete();
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

    for (const u of users) {
        await auth.createUser({
            uid: u.uid,
            email: u.email,
            password: 'password123',
            displayName: u.nickname,
            emailVerified: true
        });

        await db.collection('users').doc(u.uid).set({
            uid: u.uid,
            nickname: u.nickname,
            photoURL: u.photoURL,
            groupIds: [groupId],
            groupId: groupId,
            streakCount: u.streakCount,
            highestStreak: u.highestStreak,
            totalNotes: u.totalNotes,
            language: u.language,
            lastPostAt: now,
            createdAt: now
        });
        console.log(`   Created User: ${u.nickname} (${u.email})`);
    }

    // 3. Create Group Document
    console.log(`📦 Seeding group: "${groupName}"...`);
    const threeDaysAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 3 * 24 * 60 * 60 * 1000);
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
        ownerUserId: 'seeder-alice',
        messageCount: 0,
        lastMessageAt: now,
        lastMessageText: 'Seed database setup complete!',
        lastMessageByNickname: 'System',
        lastMessageByUid: 'system',
        dailyActivity: {
            activeMembers: ['seeder-dev-user', 'seeder-alice', 'seeder-bob'],
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
            joinedAt: threeDaysAgo,
            lastActiveAt: memberLastActiveMap[u.uid],
            lastReadAt: now,
            kickThreshold: memberKickThresholds[u.uid]
        });
    }

    // Seed Messages subcollection
    const messages = [
        {
            id: 'msg-seed-1',
            text: 'Hello everyone! Welcome to our study habit group! Let’s keep up the daily readings. 📖🔥',
            senderId: 'seeder-alice',
            senderNickname: 'Alice 📖',
            createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 2 * 24 * 60 * 60 * 1000),
            isNote: false
        },
        {
            id: 'msg-seed-2',
            text: 'Amen! I just finished my reading for today. Genesis chapter 1. The creation account is so magnificent.',
            senderId: 'seeder-bob',
            senderNickname: 'Bob 🔥',
            createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 2 * 24 * 60 * 60 * 1000),
            isNote: true,
            scripture: 'Genesis 1:1',
            comment: 'In the beginning God created the heaven and the earth. Power of creation!'
        },
        {
            id: 'msg-seed-3',
            text: 'Great post, Bob! Keep it up!',
            senderId: 'seeder-charlie',
            senderNickname: 'Charlie 💤',
            createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 2 * 24 * 60 * 60 * 1000),
            isNote: false
        },
        {
            id: 'msg-seed-4',
            text: 'Day 2 for me! Read John chapter 3 today.',
            senderId: 'seeder-bob',
            senderNickname: 'Bob 🔥',
            createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 1 * 24 * 60 * 60 * 1000),
            isNote: true,
            scripture: 'John 3:16',
            comment: 'For God so loved the world, that he gave his only begotten Son.'
        },
        {
            id: 'msg-seed-5',
            text: 'Read Matthew 5 today. Loved the Beatitudes.',
            senderId: 'seeder-alice',
            senderNickname: 'Alice 📖',
            createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
            isNote: true,
            scripture: 'Matthew 5:3',
            comment: 'Blessed are the poor in spirit: for theirs is the kingdom of heaven.'
        },
        {
            id: 'msg-seed-6',
            text: 'Today is day 3 consecutive for me. Read Genesis 3. Challenging but wonderful study.',
            senderId: 'seeder-bob',
            senderNickname: 'Bob 🔥',
            createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
            isNote: true,
            scripture: 'Genesis 3:15',
            comment: 'A prophetic verse about the Savior overcoming sin.'
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
    console.log('🔐 Developer login credentials:');
    console.log('   Email:    dev-user@example.com');
    console.log('   Password: password123');
    console.log('--------------------------------------------------');
}

seed().catch(err => {
    console.error('❌ Seeding failed with error:', err);
    process.exit(1);
});
