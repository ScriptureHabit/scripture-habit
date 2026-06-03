import { db, admin } from '../api_internal/lib/firebase-admin.js';

async function backfillLatestMessages() {
    console.log('🔄 Starting historical backfill of messages_latest/latest...');

    // 1. Fetch all groups
    const groupsSnapshot = await db.collection('groups').get();
    console.log(`📂 Found ${groupsSnapshot.size} total groups.`);

    let countCreated = 0;
    let countChecked = 0;

    for (const groupDoc of groupsSnapshot.docs) {
        const groupId = groupDoc.id;
        countChecked++;

        const latestRef = groupDoc.ref.collection('messages_latest').doc('latest');
        const latestSnap = await latestRef.get();

        if (latestSnap.exists) {
            console.log(`[${countChecked}/${groupsSnapshot.size}] Group ${groupId} already has messages_latest/latest. Skipping.`);
            continue;
        }

        console.log(`[${countChecked}/${groupsSnapshot.size}] Group ${groupId} is missing messages_latest/latest. Fetching messages...`);

        // Fetch latest 25 messages from subcollection
        const messagesSnapshot = await groupDoc.ref.collection('messages')
            .orderBy('createdAt', 'desc')
            .limit(25)
            .get();

        // Convert messages snapshot to data list and reverse chronologically
        const messagesList = messagesSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .reverse();

        console.log(`[${countChecked}/${groupsSnapshot.size}] Found ${messagesList.length} messages for group ${groupId}. Writing latest aggregate...`);

        // Create the latest aggregate document
        await latestRef.set({
            groupId,
            messages: messagesList,
            lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        countCreated++;
    }

    console.log(`✅ Success! Checked ${countChecked} groups and backfilled ${countCreated} missing aggregates.`);
}

backfillLatestMessages().catch(err => {
    console.error('❌ Error during backfill:', err);
    process.exit(1);
});
