import { db, admin } from '../api_internal/lib/firebase-admin.js';

async function aggregateNotesByDate(daysLimit = 30) {
    // 1. Calculate the start date (e.g. 30 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysLimit);
    cutoffDate.setHours(0, 0, 0, 0);
    
    console.log(`📊 Aggregating daily study activity for the past ${daysLimit} days...`);
    console.log(`📅 Start Date: ${cutoffDate.toLocaleDateString()}`);
    
    const startTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);

    // 2. Query all personal study notes in the date range
    const notesSnapshot = await db.collectionGroup('notes')
        .where('createdAt', '>=', startTimestamp)
        .get();

    // 3. Group and aggregate by date in memory
    const dailyStats: Record<string, { totalNotes: number; uniqueUsers: Set<string> }> = {};

    notesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const createdAt = data.createdAt as admin.firestore.Timestamp;
        if (!createdAt) return;

        // Convert to local YYYY-MM-DD string in Tokyo time
        const dateStr = createdAt.toDate().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
        const userUid = doc.ref.parent?.parent?.id;

        if (!dailyStats[dateStr]) {
            dailyStats[dateStr] = { totalNotes: 0, uniqueUsers: new Set<string>() };
        }

        dailyStats[dateStr].totalNotes++;
        if (userUid) {
            dailyStats[dateStr].uniqueUsers.add(userUid);
        }
    });

    // 4. Sort dates chronologically and print a clean ASCII report
    const sortedDates = Object.keys(dailyStats).sort();

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(` 📅 Date          │ 📝 Total Notes        │ 👥 Active Users`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    if (sortedDates.length === 0) {
        console.log(`   No data found.`);
    } else {
        sortedDates.forEach(date => {
            const stats = dailyStats[date];
            const notesStr = String(stats.totalNotes).padStart(5);
            const usersStr = String(stats.uniqueUsers.size).padStart(5);
            console.log(` 📅 ${date}  │      ${notesStr} notes       │      ${usersStr} users`);
        });
    }
    
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✨ Total Notes Retrieved: ${notesSnapshot.size} (Read operations: ${notesSnapshot.size})`);
}

// Default to past 30 days, can be overridden by CLI args if needed
const daysArg = process.argv[2] ? parseInt(process.argv[2], 10) : 30;
aggregateNotesByDate(daysArg).catch(console.error);
