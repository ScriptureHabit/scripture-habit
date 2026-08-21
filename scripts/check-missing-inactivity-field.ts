import { db } from '../api_internal/lib/firebase-admin.js';

async function checkMissingFields() {
    const groupsSnap = await db.collection('groups').get();
    let missingCount = 0;
    
    console.log(`📊 Total groups in production: ${groupsSnap.size}`);
    
    groupsSnap.docs.forEach(doc => {
        const data = doc.data();
        if (!data.lastInactivityCheckedAt) {
            missingCount++;
            console.log(`❌ Group missing 'lastInactivityCheckedAt': "${data.name}" (ID: ${doc.id})`);
        }
    });
    
    console.log(`-----------------------------------`);
    console.log(`⚠️ Total groups missing the field: ${missingCount}`);
}

checkMissingFields().catch(console.error);
