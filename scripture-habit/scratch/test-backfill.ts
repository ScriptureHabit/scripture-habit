import { db } from '../api_internal/lib/firebase-admin.js';
import { spawnSync } from 'node:child_process';

async function test() {
    console.log('🧪 Seeding database...');
    // Seed by spawning scripts/seed.ts
    const seedResult = spawnSync('npx', ['tsx', 'scripts/seed.ts'], { stdio: 'inherit', shell: true });
    if (seedResult.status !== 0) {
        throw new Error('Seeding failed');
    }

    const groupId = 'seed-group-daily-bread';
    const latestRef = db.collection('groups').doc(groupId).collection('messages_latest').doc('latest');

    // Verify it exists initially
    let snap = await latestRef.get();
    if (!snap.exists) {
        throw new Error('Latest aggregate should exist after seeding');
    }
    console.log('✅ messages_latest/latest verified after seeding.');

    // Delete it
    console.log('🗑️ Deleting messages_latest/latest...');
    await latestRef.delete();
    
    snap = await latestRef.get();
    if (snap.exists) {
        throw new Error('Latest aggregate should be deleted');
    }
    console.log('✅ messages_latest/latest deleted.');

    // Run backfill script
    console.log('🔄 Running backfill script...');
    const backfillResult = spawnSync('npx', ['tsx', 'scripts/backfill-latest-messages.ts'], { stdio: 'inherit', shell: true });
    if (backfillResult.status !== 0) {
        throw new Error('Backfill failed');
    }

    // Verify it is restored
    snap = await latestRef.get();
    if (!snap.exists) {
        throw new Error('Latest aggregate should be restored by backfill');
    }
    
    const data = snap.data();
    console.log('✅ messages_latest/latest restored. Data:', JSON.stringify(data, null, 2));
    
    if (!data?.messages || data.messages.length === 0) {
        throw new Error('Messages list in aggregate should not be empty');
    }
    console.log(`🎉 Success! Restored ${data.messages.length} messages.`);
}

test().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
