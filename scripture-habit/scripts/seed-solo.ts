import { db, auth, admin } from '../api_internal/lib/firebase-admin.js';

async function seedSolo() {
    console.log('🌱 Starting solo database seeding sequence (Friendless / Solo User state)...');

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

    const soloUser = {
        uid: 'seeder-solo-user',
        email: 'solo@example.com',
        nickname: 'Solo Learner 📖',
        photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=Solo',
        streakCount: 0,
        highestStreak: 0,
        totalNotes: 0,
        language: 'ja'
    };

    // 1. Purge existing solo seed user and all subcollections (notes, groupStates, etc.) for idempotency
    console.log('🧹 Purging existing solo seed user and user data...');
    try {
        await auth.deleteUser(soloUser.uid);
    } catch {
        // Ignore if user does not exist
    }

    // Delete user document AND all subcollections recursively (notes, groupStates, etc.)
    try {
        const userDocRef = db.collection('users').doc(soloUser.uid);
        await db.recursiveDelete(userDocRef);
        console.log(`🧹 Recursively deleted user document and subcollections for ${soloUser.uid}`);
    } catch (e) {
        console.warn('Warning deleting user document recursively:', e);
    }

    // Delete any top-level notes belonging to the solo user (if any exist)
    try {
        const userNotesSnapshot = await db.collection('notes').where('userId', '==', soloUser.uid).get();
        const batch = db.batch();
        userNotesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
        if (!userNotesSnapshot.empty) {
            await batch.commit();
            console.log(`🧹 Deleted ${userNotesSnapshot.size} top-level notes for ${soloUser.uid}`);
        }
    } catch (e) {
        console.warn('Warning deleting top-level user notes:', e);
    }

    // Delete any AI partner groups or groups where solo user is a member
    try {
        const groupsSnapshot = await db.collection('groups').where('memberUids', 'array-contains', soloUser.uid).get();
        for (const groupDoc of groupsSnapshot.docs) {
            await db.recursiveDelete(groupDoc.ref);
        }
        if (!groupsSnapshot.empty) {
            console.log(`🧹 Deleted ${groupsSnapshot.size} groups containing member ${soloUser.uid}`);
        }
        
        // Also clean up any orphan AI partner groups if any remain
        const aiGroupsSnapshot = await db.collection('groups').where('aiCompanionUid', '==', 'ai-partner-bot').get();
        for (const groupDoc of aiGroupsSnapshot.docs) {
            await db.recursiveDelete(groupDoc.ref);
        }
        if (!aiGroupsSnapshot.empty) {
            console.log(`🧹 Deleted ${aiGroupsSnapshot.size} AI companion groups`);
        }
    } catch (e) {
        console.warn('Warning deleting solo user groups:', e);
    }

    // Delete dailyStats collection for complete reset
    try {
        const statsSnap = await db.collection('dailyStats').get();
        for (const doc of statsSnap.docs) {
            await db.recursiveDelete(doc.ref);
        }
        if (!statsSnap.empty) {
            console.log(`🧹 Deleted ${statsSnap.size} dailyStats records`);
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
        if (!transCacheSnap.empty) {
            console.log(`🧹 Deleted ${transCacheSnap.size} translation_cache documents`);
        }
    } catch (e) {
        console.warn('Warning deleting translation_cache:', e);
    }

    // 2. Create Auth Account & Firestore User Profile for Solo User (No groups, uncompleted onboarding)
    console.log('👤 Creating Auth account and Firestore user document (no groups, no friends)...');
    const now = admin.firestore.Timestamp.now();

    await auth.createUser({
        uid: soloUser.uid,
        email: soloUser.email,
        password: 'password123',
        displayName: soloUser.nickname,
        emailVerified: true
    });

    await db.collection('users').doc(soloUser.uid).set({
        uid: soloUser.uid,
        nickname: soloUser.nickname,
        photoURL: soloUser.photoURL,
        groupIds: [], // Completely friendless / no groups joined
        groupId: null,
        streakCount: soloUser.streakCount,
        highestStreak: soloUser.highestStreak,
        totalNotes: soloUser.totalNotes,
        language: soloUser.language,
        createdAt: now,
        hasCompletedOnboarding: false, // Fresh onboarding experience
        hasSeenWelcomeStory: false,
        hasSetKickThreshold: false,
        hasSeenTour: false
    });

    console.log('🎉 Solo user seeding successfully completed!');
    console.log('--------------------------------------------------');
    console.log('🔐 Solo User Login Credentials:');
    console.log(`   Email:    ${soloUser.email}`);
    console.log('   Password: password123');
    console.log('--------------------------------------------------');
}

seedSolo().catch(err => {
    console.error('❌ Solo seeding failed with error:', err);
    process.exit(1);
});
