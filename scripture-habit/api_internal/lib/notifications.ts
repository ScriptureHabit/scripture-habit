import { db, messaging, admin } from './firebase-admin.js';
// Using centralized i18n for templates now

export async function getUserFcmTokens(uid: string): Promise<string[]> {
    const tokens: string[] = [];
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();
    if (userDoc.exists && userData && userData.fcmTokens) {
        tokens.push(...(userData.fcmTokens as string[]));
    }
    const privateDoc = await db.collection('users').doc(uid).collection('private').doc('tokens').get();
    const privateData = privateDoc.data();
    if (privateDoc.exists && privateData && privateData.fcmTokens) {
        tokens.push(...(privateData.fcmTokens as string[]));
    }
    return [...new Set(tokens)];
}

interface PushPayload {
    title: string;
    body: string;
    data?: Record<string, string>;
}

export async function sendPushNotification(tokens: string[], payload: PushPayload) {
    if (!tokens || tokens.length === 0) return { successCount: 0, failureCount: 0, failedTokens: [] as string[] };
    const uniqueTokens = [...new Set(tokens)];
    const failedTokens: string[] = [];
    let totalSuccess = 0;
    let totalFailure = 0;

    const CHUNK_SIZE = 500;
    for (let i = 0; i < uniqueTokens.length; i += CHUNK_SIZE) {
        const chunk = uniqueTokens.slice(i, i + CHUNK_SIZE);
        const message = {
            data: {
                title: payload.title,
                body: payload.body,
                ...(payload.data || {}),
            },
            tokens: chunk,
        };

        try {
            const response = await messaging.sendEachForMulticast(message);
            totalSuccess += response.successCount;
            totalFailure += response.failureCount;

            if (response.failureCount > 0) {
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        const error = resp.error;
                        if (error && (
                            error.code === 'messaging/invalid-registration-token' ||
                            error.code === 'messaging/registration-token-not-registered'
                        )) {
                            failedTokens.push(chunk[idx]);
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error sending push notification chunk:', error);
        }
    }

    return { successCount: totalSuccess, failureCount: totalFailure, failedTokens };
}

/**
 * Cleanup failed tokens from a user's account
 */
export async function cleanupTokens(uid: string, failedTokens: string[]) {
    if (!failedTokens.length) return;
    const batch = db.batch();
    const userRef = db.collection('users').doc(uid);
    const privateRef = userRef.collection('private').doc('tokens');

    failedTokens.forEach(token => {
        batch.update(userRef, { fcmTokens: admin.firestore.FieldValue.arrayRemove(token) });
        batch.update(privateRef, { fcmTokens: admin.firestore.FieldValue.arrayRemove(token) });
    });

    await batch.commit();
}

export async function notifyGroupMembers(groupId: string, senderUid: string, payload: PushPayload, memberIdsOverride: string[] | null = null) {
    try {
        let membersToNotifyIds: string[];
        if (memberIdsOverride) {
            membersToNotifyIds = memberIdsOverride.filter(uid => uid !== senderUid);
        } else {
            const groupDoc = await db.collection('groups').doc(groupId).get();
            const groupData = groupDoc.data();
            if (!groupDoc.exists || !groupData) return;
            membersToNotifyIds = ((groupData.members as string[]) || []).filter(uid => uid !== senderUid);
        }

        if (membersToNotifyIds.length === 0) {
            console.log(`[PushService] Group ${groupId}: No other members to notify (sender=${senderUid}).`);
            return;
        }

        console.log(`[PushService] Group ${groupId}: Attempting to notify ${membersToNotifyIds.length} members: ${membersToNotifyIds.join(', ')}`);

        const memberRefs = membersToNotifyIds.map(uid => db.collection('users').doc(uid));
        const privateRefs = membersToNotifyIds.map(uid => db.collection('users').doc(uid).collection('private').doc('tokens'));
        
        // getAll expects references
        const allDocs = await db.getAll(...memberRefs, ...privateRefs);

        const memberDocs = allDocs.slice(0, memberRefs.length);
        const privateDocs = allDocs.slice(memberRefs.length);

        const tokens: string[] = [];
        const tokenToUserMap = new Map<string, string>();
        const tokenSourceMap = new Map<string, 'public' | 'private'>();

        memberDocs.forEach((uDoc, idx) => {
            const uid = membersToNotifyIds[idx];
            const userData = uDoc.data();
            if (uDoc.exists && userData) {
                ((userData.fcmTokens as string[]) || []).forEach(t => {
                    tokens.push(t);
                    tokenToUserMap.set(t, uid);
                    tokenSourceMap.set(t, 'public');
                });
            }
            const pDoc = privateDocs[idx];
            const privateData = pDoc.data();
            if (pDoc.exists && privateData) {
                ((privateData.fcmTokens as string[]) || []).forEach(t => {
                    if (!tokenToUserMap.has(t)) {
                        tokens.push(t);
                        tokenToUserMap.set(t, uid);
                        tokenSourceMap.set(t, 'private');
                    }
                });
            }
        });

        console.log(`[PushService] Group ${groupId}: Collected ${tokens.length} total tokens from ${membersToNotifyIds.length} members.`);

        if (tokens.length > 0) {
            const result = await sendPushNotification(tokens, payload);
            console.log(`[PushService] FCMSend Success: ${result.successCount}, Failure: ${result.failureCount}. Tokens: ${tokens.map(t => t.substring(0, 10) + '...').join(', ')}`);
            if (result.failedTokens && result.failedTokens.length > 0) {
                const batch = db.batch();
                result.failedTokens.forEach(t => {
                    const uid = tokenToUserMap.get(t);
                    const source = tokenSourceMap.get(t);
                    if (uid) {
                        const targetRef = source === 'private'
                            ? db.collection('users').doc(uid).collection('private').doc('tokens')
                            : db.collection('users').doc(uid);
                        batch.update(targetRef, { fcmTokens: admin.firestore.FieldValue.arrayRemove(t) });
                    }
                });
                await batch.commit();
            }
        }
    } catch (error) {
        console.error('Error in notifyGroupMembers:', error);
    }
}
