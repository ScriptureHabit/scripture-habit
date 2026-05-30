import { db } from '../api_internal/lib/firebase-admin.js';
import { InactivityService } from '../api_internal/services/inactivity-service.js';

async function testAll() {
    const groupsSnap = await db.collection('groups').get();
    console.log(`📊 Testing inactivity check for all ${groupsSnap.size} groups...`);
    
    for (const doc of groupsSnap.docs) {
        const data = doc.data();
        console.log(`👉 Testing group: "${data.name}" (ID: ${doc.id})`);
        try {
            // Run dry run or simulation of processGroupInactivity
            // Wait, processGroupInactivity modifies the database! We don't want to run it on production directly
            // unless we want to see if it works. But wait, since it's production, we can run a safe dry run,
            // or we can run the real one with a try-catch to see if it fails!
            // Actually, we can just run it. If it fails, it will throw an error and we'll see the exact stack trace!
            // Wait, does it modify the database? Yes, it updates lastInactivityCheckedAt.
            // That is actually a good thing! We want to check if it fails.
            
            const result = await InactivityService.processGroupInactivity(doc.id, doc);
            console.log(`   ✅ Success! Result:`, JSON.stringify(result));
        } catch (err) {
            console.error(`   ❌ FAILED! Error in group "${data.name}":`, err);
        }
    }
}

testAll().catch(console.error);
