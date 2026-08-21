import { db, admin } from '../api_internal/lib/firebase-admin.js';

async function backfillDailyStats() {
    console.log('🔄 Starting historical backfill of daily active user stats...');

    // 1. Fetch all study notes across all users
    const notesSnapshot = await db.collectionGroup('notes').get();
    console.log(`📝 Found a total of ${notesSnapshot.size} historical notes.`);

    // 2. Group UIDs by date in Asia/Tokyo time zone
    const dailyUsers: Record<string, Set<string>> = {};

    notesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const createdAt = data.createdAt as admin.firestore.Timestamp;
        if (!createdAt) return;

        const dateStr = createdAt.toDate().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
        const userUid = doc.ref.parent?.parent?.id; // Parent of notes subcollection is the user document

        if (userUid) {
            if (!dailyUsers[dateStr]) {
                dailyUsers[dateStr] = new Set<string>();
            }
            dailyUsers[dateStr].add(userUid);
        }
    });

    const dates = Object.keys(dailyUsers).sort();
    console.log(`📅 Prepared stats for ${dates.length} unique dates.`);

    // 3. Write stats to Firestore using batches
    let batch = db.batch();
    let opCount = 0;
    let writtenCount = 0;

    for (const date of dates) {
        const uidsArray = Array.from(dailyUsers[date]);
        const statsRef = db.collection('dailyStats').doc(date);

        batch.set(statsRef, {
            activeUsers: admin.firestore.FieldValue.arrayUnion(...uidsArray)
        }, { merge: true });

        opCount++;
        writtenCount++;

        if (opCount >= 400) {
            await batch.commit();
            console.log(`💾 Committed batch of ${opCount} operations...`);
            batch = db.batch();
            opCount = 0;
        }
    }

    if (opCount > 0) {
        await batch.commit();
        console.log(`💾 Committed final batch of ${opCount} operations.`);
    }

    console.log(`✅ Success! Backfilled stats for ${writtenCount} dates.`);
}

backfillDailyStats().catch(err => {
    console.error('❌ Error during backfill:', err);
    process.exit(1);
});
