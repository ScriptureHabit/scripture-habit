import { db } from '../api_internal/lib/firebase-admin.js';

async function migrateMaxMembers() {
    console.log('Starting migration for maxMembers (5-member limit) on existing groups...');
    
    try {
        // 1. Fetch all groups
        const groupsSnapshot = await db.collection('groups').get();
        console.log(`📂 Retrieved ${groupsSnapshot.size} total groups.`);
        
        let updateCount = 0;
        let batch = db.batch();
        let batchOpCount = 0;
        
        for (const doc of groupsSnapshot.docs) {
            const data = doc.data();
            const currentMaxMembers = data.maxMembers;
            
            // Target all documents where maxMembers is not 5 (undefined or legacy numbers)
            if (currentMaxMembers !== 5) {
                batch.update(doc.ref, {
                    maxMembers: 5
                });
                batchOpCount++;
                updateCount++;
                
                // Batch commit every 400 operations to stay within Firestore 500 limit
                if (batchOpCount >= 400) {
                    console.log(`📦 Committing batch... (${updateCount} items processed)`);
                    await batch.commit();
                    batch = db.batch();
                    batchOpCount = 0;
                }
            }
        }
        
        // Commit remaining batch
        if (batchOpCount > 0) {
            await batch.commit();
        }
        
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`✨ Migration complete!`);
        console.log(`📝 Updated groups: ${updateCount}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        
    } catch (error) {
        console.error('❌ Migration failed with error:', error);
        process.exit(1);
    }
    process.exit(0);
}

migrateMaxMembers();
