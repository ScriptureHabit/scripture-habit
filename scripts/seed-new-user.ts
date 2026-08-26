import { db, auth, admin } from '../api_internal/lib/firebase-admin.js';

async function seedNewUser() {
    console.log('🌱 Starting new user database seeding sequence (Fresh User / New Onboarding state)...');

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

    const newUser = {
        uid: 'seeder-new-user',
        email: 'new-user@example.com',
        nickname: 'new-user',
        photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=new-user',
        streakCount: 0,
        highestStreak: 0,
        totalNotes: 0,
        language: 'ja'
    };

    // 1. Purge existing new user and legacy solo seed user for idempotency
    console.log('🧹 Purging existing new user and previous test data...');
    const uidsToClean = [newUser.uid, 'seeder-solo-user'];
    for (const uid of uidsToClean) {
        try {
            await auth.deleteUser(uid);
        } catch {
            // Ignore if user does not exist
        }

        try {
            const userDocRef = db.collection('users').doc(uid);
            await db.recursiveDelete(userDocRef);
        } catch (e) {
            console.warn(`Warning deleting user document for ${uid}:`, e);
        }

        try {
            const userNotesSnapshot = await db.collection('notes').where('userId', '==', uid).get();
            const batch = db.batch();
            userNotesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
            if (!userNotesSnapshot.empty) {
                await batch.commit();
            }
        } catch (e) {
            console.warn(`Warning deleting notes for ${uid}:`, e);
        }

        try {
            const groupsSnapshot = await db.collection('groups').where('memberUids', 'array-contains', uid).get();
            for (const groupDoc of groupsSnapshot.docs) {
                await db.recursiveDelete(groupDoc.ref);
            }
        } catch (e) {
            console.warn(`Warning deleting groups for ${uid}:`, e);
        }
    }

    // Also clean up any orphan AI partner groups if any remain
    try {
        const aiGroupsSnapshot = await db.collection('groups').where('aiCompanionUid', '==', 'ai-partner-bot').get();
        for (const groupDoc of aiGroupsSnapshot.docs) {
            await db.recursiveDelete(groupDoc.ref);
        }
    } catch (e) {
        console.warn('Warning deleting AI companion groups:', e);
    }

    // Delete dailyStats collection for complete reset
    try {
        const statsSnap = await db.collection('dailyStats').get();
        for (const doc of statsSnap.docs) {
            await db.recursiveDelete(doc.ref);
        }
    } catch (e) {
        console.warn('Warning deleting dailyStats:', e);
    }

    // Delete translation_cache collection for complete cache reset
    try {
        const transCacheSnap = await db.collection('translation_cache').get();
        for (const doc of transCacheSnap.docs) {
            await db.recursiveDelete(doc.ref);
        }
    } catch (e) {
        console.warn('Warning deleting translation_cache:', e);
    }

    // 2. Create Auth Account & Firestore User Profile for New User (No groups, uncompleted onboarding)
    console.log('👤 Creating Auth account and Firestore user document (no groups, fresh onboarding)...');
    const now = admin.firestore.Timestamp.now();

    await auth.createUser({
        uid: newUser.uid,
        email: newUser.email,
        password: 'password123',
        displayName: newUser.nickname,
        emailVerified: true
    });

    await db.collection('users').doc(newUser.uid).set({
        uid: newUser.uid,
        nickname: newUser.nickname,
        photoURL: newUser.photoURL,
        groupIds: [], // Completely fresh / no groups joined
        groupId: null,
        streakCount: newUser.streakCount,
        highestStreak: newUser.highestStreak,
        totalNotes: newUser.totalNotes,
        language: newUser.language,
        createdAt: now,
        hasCompletedOnboarding: false, // Fresh onboarding experience
        hasSeenWelcomeStory: false,
        hasSetKickThreshold: false,
        hasSeenTour: false
    });

    // Seed Developer Welcome Letter in user's letterbox
    const welcomeLetterContent = newUser.language === 'ja'
        ? `${newUser.nickname}さんを心から歓迎いたします。\n\n普段、忙しい生活を送る中で聖典を開き、聖文に心を向ける習慣を持つことは、時に小さな挑戦のように感じられるかもしれません。たとえ1日1節でも、短い感想を書き残すだけでも、その小さな積み重ねはあなたの生活に確かな平安と光をもたらします。\n\nノートを2回投稿すると、あなたの気づきや学びをふり返る「特別な手紙」が届くようになります。ぜひ、今日感じたことを最初のノートに綴ってみてくださいね。\n\nあなたのこれからの人生が、豊かな祝福と喜びにみたされますように。\n\nScripture Habit 開発者より`
        : `A warm welcome to you, ${newUser.nickname}.\n\nIn our busy daily lives, opening the scriptures and turning our hearts to the sacred word can sometimes feel like a small challenge. Yet, even reading just one verse a day or writing down a short reflection, that small accumulation will surely bring true peace and light into your life.\n\nOnce you post 2 notes, you will receive a special reflection letter looking back on your insights and learning. We encourage you to write down what you felt today in your very first note!\n\nMay your life ahead be filled with abundant blessings and joy.\n\n— Scripture Habit Developer`;

    await db.collection('users').doc(newUser.uid).collection('letters').doc('seed-welcome-letter').set({
        title: newUser.language === 'ja' ? 'ようこそ、Scripture Habitへ' : 'Welcome to Scripture Habit',
        content: welcomeLetterContent,
        type: 'developer_welcome',
        createdAt: now,
        read: false
    });

    console.log('\n==================================================');
    console.log('🌱 [New User] 新規ユーザー環境をセットアップしました');
    console.log('--------------------------------------------------');
    console.log('🔐 Login Credentials:');
    console.log(`   Email:    ${newUser.email}`);
    console.log('   Password: password123');
    console.log(`   Nickname: ${newUser.nickname}`);
    console.log('📖 状態: 未所属 / ストリーク0 / オンボーディング未完了（初回登録直後）');
    console.log('==================================================\n');
}

seedNewUser().catch(err => {
    console.error('❌ New user seeding failed with error:', err);
    process.exit(1);
});
