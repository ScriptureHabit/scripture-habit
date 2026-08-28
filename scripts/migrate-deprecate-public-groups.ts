if (!process.argv.includes('--emulator')) {
    process.env.FORCE_PRODUCTION = 'true';
}

async function migrateDeprecatePublicGroups() {
    const { db } = await import('../api_internal/lib/firebase-admin.js');
    const isApply = process.argv.includes('--apply');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 Starting migration to deprecate public groups...');
    console.log(`⚙️ Mode: ${isApply ? '[APPLY MODE]' : '[DRY-RUN SIMULATION]'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
        const groupsSnapshot = await db.collection('groups').get();
        console.log(`📂 Retrieved ${groupsSnapshot.size} total group documents.\n`);

        let modifiedCount = 0;
        let batch = db.batch();
        let batchOpCount = 0;

        for (const doc of groupsSnapshot.docs) {
            const data = doc.data();
            const groupId = doc.id;
            const isPublic = Boolean(data.isPublic);

            if (isPublic) {
                modifiedCount++;
                console.log(`🔒 [Target Group] ID: ${groupId}, Name: "${data.name || 'Untitled'}" -> updating isPublic: false`);

                if (isApply) {
                    batch.update(doc.ref, {
                        isPublic: false,
                        isPrivate: true
                    });
                    batchOpCount++;

                    if (batchOpCount >= 400) {
                        await batch.commit();
                        batch = db.batch();
                        batchOpCount = 0;
                    }
                }
            }
        }

        if (isApply && batchOpCount > 0) {
            await batch.commit();
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`✅ Process complete`);
        console.log(`📊 Target groups modified: ${modifiedCount}`);
        if (!isApply) {
            console.log(`💡 To apply these changes, run with the '--apply' flag:`);
            console.log(`   npx tsx scripts/migrate-deprecate-public-groups.ts --apply`);
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } catch (err) {
        console.error('❌ Migration failed with error:', err);
        process.exit(1);
    }
}

migrateDeprecatePublicGroups();
