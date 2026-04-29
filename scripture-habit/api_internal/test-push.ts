import { db, messaging } from './lib/firebase-admin.js';

async function testPush() {
    const uid = process.argv[2];
    if (!uid) {
        console.error("Please provide your UID as an argument.");
        console.error("Usage: npx tsx test-push.ts <YOUR_UID>");
        process.exit(1);
    }

    console.log(`Fetching FCM tokens for user: ${uid}...`);

    try {
        const tokens: string[] = [];
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists && userDoc.data()?.fcmTokens) {
            tokens.push(...userDoc.data()!.fcmTokens);
        }

        const privateDoc = await db.collection('users').doc(uid).collection('private').doc('tokens').get();
        if (privateDoc.exists && privateDoc.data()?.fcmTokens) {
            tokens.push(...privateDoc.data()!.fcmTokens);
        }

        const uniqueTokens = [...new Set(tokens)];

        if (uniqueTokens.length === 0) {
            console.log("No FCM tokens found for this user. Make sure you allowed notifications in the browser.");
            process.exit(1);
        }

        console.log(`Found ${uniqueTokens.length} tokens. Sending test notification...`);

        const message = {
            data: {
                title: 'Test Notification',
                body: 'This is a test to verify notifications are working on your device.',
                groupId: 'test_group',
            },
            tokens: uniqueTokens,
        };

        const response = await messaging.sendEachForMulticast(message);
        console.log(`Successfully sent ${response.successCount} messages.`);
        console.log(`Failed to send ${response.failureCount} messages.`);

        if (response.failureCount > 0) {
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    console.error(`Error for token [${uniqueTokens[idx]}]:`, resp.error);
                }
            });
        }
        process.exit(0);
    } catch (error) {
        console.error("Error sending push notification:", error);
        process.exit(1);
    }
}

testPush();
