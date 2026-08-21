import { db, admin } from '../api_internal/lib/firebase-admin.js';

async function testQuery() {
    const groupsRef = db.collection('groups');
    
    // Exact query from cron job:
    const twentyFourHoursAgo = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const query = groupsRef
        .where('lastInactivityCheckedAt', '<', twentyFourHoursAgo)
        .orderBy('lastInactivityCheckedAt', 'asc')
        .limit(100);
        
    const snap = await query.get();
    
    console.log(`🔍 Total groups returned by stale query: ${snap.size}`);
    
    let found = false;
    snap.docs.forEach(doc => {
        const data = doc.data();
        const checkedAt = data.lastInactivityCheckedAt?.toDate?.()?.toLocaleString() || data.lastInactivityCheckedAt;
        console.log(`- Group in queue: "${data.name}" (lastInactivityCheckedAt: ${checkedAt})`);
        if (data.name === '桐生ステーク') {
            found = true;
        }
    });
    
    if (found) {
        console.log(`✅ Success: "桐生ステーク" IS returned by the cron query!`);
    } else {
        console.log(`❌ Fail: "桐生ステーク" is NOT returned by the cron query!`);
        // Let's print the actual lastInactivityCheckedAt of 桐生ステーク
        const targetQuery = await db.collection('groups').where('name', '==', '桐生ステーク').limit(1).get();
        if (!targetQuery.empty) {
            const data = targetQuery.docs[0].data();
            const checkedAt = data.lastInactivityCheckedAt?.toDate?.()?.toLocaleString() || data.lastInactivityCheckedAt;
            const created = data.createdAt?.toDate?.()?.toLocaleString() || data.createdAt;
            console.log(`ℹ️ Real lastInactivityCheckedAt: ${checkedAt}`);
            console.log(`ℹ️ Real createdAt: ${created}`);
            console.log(`ℹ️ 24 hours ago cutoff: ${twentyFourHoursAgo.toDate().toLocaleString()}`);
            if (data.lastInactivityCheckedAt?.toDate?.() > twentyFourHoursAgo.toDate()) {
                console.log(`ℹ️ Reason: It was checked recently (less than 24 hours ago)!`);
            }
        }
    }
}

testQuery().catch(console.error);
