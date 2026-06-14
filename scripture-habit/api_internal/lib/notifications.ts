import { db, messaging, admin } from './firebase-admin.js';
import { t } from './i18n.js';

export async function getUserFcmTokensAndLanguage(uid: string): Promise<{ tokens: string[], language?: string }> {
    const tokens: string[] = [];
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();
    let language: string | undefined;
    if (userDoc.exists && userData) {
        language = userData.language;
        if (userData.fcmTokens) {
            tokens.push(...(userData.fcmTokens as string[]));
        }
    }
    const privateDoc = await db.collection('users').doc(uid).collection('private').doc('tokens').get();
    const privateData = privateDoc.data();
    if (privateDoc.exists && privateData && privateData.fcmTokens) {
        tokens.push(...(privateData.fcmTokens as string[]));
    }
    return { tokens: [...new Set(tokens)], language };
}

export async function getUserFcmTokens(uid: string): Promise<string[]> {
    const res = await getUserFcmTokensAndLanguage(uid);
    return res.tokens;
}

interface PushPayload {
    title: string;
    body: string;
    titleKey?: string;
    bodyKey?: string;
    bodyReplacements?: Record<string, string | number>;
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
            notification: {
                title: payload.title,
                body: payload.body,
            },
            data: {
                title: payload.title,
                body: payload.body,
                ...(payload.data || {}),
            },
            webpush: {
                notification: {
                    icon: '/favicon-192.png',
                    badge: '/favicon-192.png',
                }
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

    // Get current tokens to check if any will remain after cleanup
    const { tokens } = await getUserFcmTokensAndLanguage(uid);
    const remainingTokens = tokens.filter(t => !failedTokens.includes(t));

    failedTokens.forEach(token => {
        batch.update(userRef, { fcmTokens: admin.firestore.FieldValue.arrayRemove(token) });
        batch.update(privateRef, { fcmTokens: admin.firestore.FieldValue.arrayRemove(token) });
    });

    if (remainingTokens.length === 0) {
        batch.update(userRef, { hasFcmToken: false });
    }

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

        const tokensByLang = new Map<string, string[]>();
        const tokenToUserMap = new Map<string, string>();
        const tokenSourceMap = new Map<string, 'public' | 'private'>();
        const userActiveTokens = new Map<string, Set<string>>();

        memberDocs.forEach((uDoc, idx) => {
            const uid = membersToNotifyIds[idx];
            const userData = uDoc.data();
            const lang = (userData?.language || 'en').split('-')[0].toLowerCase();
            
            if (!tokensByLang.has(lang)) tokensByLang.set(lang, []);
            const langTokens = tokensByLang.get(lang)!;

            const userTokens = new Set<string>();

            if (uDoc.exists && userData) {
                ((userData.fcmTokens as string[]) || []).forEach(t => {
                    langTokens.push(t);
                    tokenToUserMap.set(t, uid);
                    tokenSourceMap.set(t, 'public');
                    userTokens.add(t);
                });
            }
            const pDoc = privateDocs[idx];
            const privateData = pDoc.data();
            if (pDoc.exists && privateData) {
                ((privateData.fcmTokens as string[]) || []).forEach(t => {
                    if (!tokenToUserMap.has(t)) {
                        langTokens.push(t);
                        tokenToUserMap.set(t, uid);
                        tokenSourceMap.set(t, 'private');
                        userTokens.add(t);
                    }
                });
            }

            if (userTokens.size > 0) {
                userActiveTokens.set(uid, userTokens);
            }
        });

        const allTokensCount = Array.from(tokensByLang.values()).reduce((sum, t) => sum + t.length, 0);
        console.log(`[PushService] Group ${groupId}: Collected ${allTokensCount} total tokens in ${tokensByLang.size} languages.`);

        if (allTokensCount > 0) {
            const failedTokens: string[] = [];
            let totalSuccess = 0;
            let totalFailure = 0;

            for (const [lang, langTokens] of tokensByLang.entries()) {
                if (langTokens.length === 0) continue;

                const resolvedTitle = payload.titleKey
                    ? t(lang, payload.titleKey)
                    : payload.title;
                const resolvedBody = payload.bodyKey
                    ? t(lang, payload.bodyKey, payload.bodyReplacements)
                    : payload.body;

                const payloadWithLang = {
                    title: resolvedTitle,
                    body: resolvedBody,
                    data: { ...(payload.data || {}), lang }
                };

                const result = await sendPushNotification(langTokens, payloadWithLang);
                totalSuccess += result.successCount;
                totalFailure += result.failureCount;
                if (result.failedTokens) failedTokens.push(...result.failedTokens);
            }

            console.log(`[PushService] FCMSend Success: ${totalSuccess}, Failure: ${totalFailure}.`);
            
            if (failedTokens.length > 0) {
                const batch = db.batch();
                failedTokens.forEach(t => {
                    const uid = tokenToUserMap.get(t);
                    const source = tokenSourceMap.get(t);
                    if (uid) {
                        const targetRef = source === 'private'
                            ? db.collection('users').doc(uid).collection('private').doc('tokens')
                            : db.collection('users').doc(uid);
                        batch.update(targetRef, { fcmTokens: admin.firestore.FieldValue.arrayRemove(t) });

                        // Track remaining tokens for self-healing of hasFcmToken flag
                        const activeTokensSet = userActiveTokens.get(uid);
                        if (activeTokensSet) {
                            activeTokensSet.delete(t);
                            if (activeTokensSet.size === 0) {
                                batch.update(db.collection('users').doc(uid), {
                                    hasFcmToken: false
                                });
                            }
                        }
                    }
                });
                await batch.commit();
            }
        }
    } catch (error) {
        console.error('Error in notifyGroupMembers:', error);
    }
}
