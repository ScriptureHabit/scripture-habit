import { db } from '../lib/firebase-admin.js';

async function migrateInviteCodes() {
    console.log('🔄 Starting migration: Making all group invite codes permanent and initializing previousInviteCodes...');
    
    const groupsSnap = await db.collection('groups').get();
    console.log(`Found ${groupsSnap.size} total groups to inspect.`);

    let updatedCount = 0;
    let batch = db.batch();
    let batchCount = 0;

    for (const doc of groupsSnap.docs) {
        const data = doc.data();
        const needsExpiresAtUpdate = data.inviteCodeExpiresAt !== null && data.inviteCodeExpiresAt !== undefined;
        const needsPreviousCodesUpdate = !Array.isArray(data.previousInviteCodes);

        if (needsExpiresAtUpdate || needsPreviousCodesUpdate) {
            const updates: Record<string, unknown> = {};
            if (needsExpiresAtUpdate) {
                updates.inviteCodeExpiresAt = null;
            }
            if (needsPreviousCodesUpdate) {
                updates.previousInviteCodes = [];
            }

            batch.update(doc.ref, updates);
            batchCount++;
            updatedCount++;

            if (batchCount >= 400) {
                await batch.commit();
                console.log(`Committed batch of ${batchCount} updates...`);
                batch = db.batch();
                batchCount = 0;
            }
        }
    }

    if (batchCount > 0) {
        await batch.commit();
        console.log(`Committed final batch of ${batchCount} updates.`);
    }

    console.log(`✅ Migration complete! Updated ${updatedCount} / ${groupsSnap.size} groups to permanent invites.`);
}

migrateInviteCodes()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    });
