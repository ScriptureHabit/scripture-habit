import { db, messaging, admin } from './firebase-admin.js';
import { SupportedLanguage } from './schemas.ts';

export const STREAK_ANNOUNCEMENT_TEMPLATES: Record<SupportedLanguage, string> = {
    en: "🎉🎉🎉 **{nickname} reached a {streak} day streak!!** 🎉🎉🎉",
    ja: "🎉🎉🎉 **{nickname}さんが{streak}日連続達成しました！！** 🎉🎉🎉",
    es: "🎉🎉🎉 **¡{nickname} alcanzó una racha de {streak} días!** 🎉🎉🎉",
    pt: "🎉🎉🎉 **{nickname} atingiu uma sequência de {streak} dias!!** 🎉🎉🎉",
    zh: "🎉🎉🎉 **{nickname} 已連讀 {streak} 天！！** 🎉🎉🎉",
    zho: "🎉🎉🎉 **{nickname} 已連讀 {streak} 天！！** 🎉🎉🎉",
    vi: "🎉🎉🎉 **{nickname} đã đạt chuỗi {streak} ngày!!** 🎉🎉🎉",
    th: "🎉🎉🎉 **{nickname} บรรลุสถิติต่อเนื่อง {streak} วัน!!** 🎉🎉🎉",
    ko: "🎉🎉🎉 **{nickname}님이 {streak}일 연속 달성했습니다!!** 🎉🎉🎉",
    tl: "🎉🎉🎉 **Naabot ni {nickname} ang {streak} na araw na streak!!** 🎉🎉🎉",
    sw: "🎉🎉🎉 **{nickname} amefikisha mfululizo wa siku {streak}!!** 🎉🎉🎉"
};

export const CHEER_NOTIFICATION_TEMPLATES: Record<string, string[]> = {
    en: [
        "{nickname} is waiting for your post! ✨",
        "{nickname} is looking forward to your study note! 📖",
        "Let's aim for 100% unity! {nickname} sent you an energy boost! 💪"
    ],
    ja: [
        "{nickname}さんがあなたの投稿を楽しみに待っています！✨",
        "{nickname}さんがあなたの学習ノートを心待ちにしています！📖",
        "全員投稿まであと少し！{nickname}さんからエールが届きました！💪"
    ],
};

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

        if (membersToNotifyIds.length === 0) return;

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

        if (tokens.length > 0) {
            const result = await sendPushNotification(tokens, payload);
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
