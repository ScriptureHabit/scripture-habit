import { admin, db } from '../lib/firebase-admin.js';
import { t } from '../lib/i18n.js';
import { getAiDailyComment } from '../data/ai-daily-comments-2026.js';
import { getUserFcmTokensAndLanguage, sendPushNotification } from '../lib/notifications.js';
import { getMessageExpireAt } from '../lib/ttl-utils.js';

export interface PostAiDailyNoteOptions {
    force?: boolean;
    customDateStr?: string;
    langOverride?: string;
    isGroupCreation?: boolean;
}

export interface PostAiDailyNoteResult {
    posted: boolean;
    alreadyPosted: boolean;
    skippedTime?: boolean;
    msgId?: string;
}

export class AiDailyNoteService {
    /**
     * Posts today's AI daily note to a specified group, updates group metadata, and sends FCM push notification.
     * Guaranteed idempotent by using document ID `ai_note_${todayStr}`.
     */
    static async postDailyNoteForGroup(
        groupId: string,
        groupData: { timeZone?: string; ownerUserId?: string; isDeleted?: boolean },
        options: PostAiDailyNoteOptions = {}
    ): Promise<PostAiDailyNoteResult> {
        if (groupData.isDeleted) {
            return { posted: false, alreadyPosted: false };
        }

        const nowDate = new Date();
        const groupTz = groupData.timeZone || 'Asia/Tokyo';

        let todayStr: string;
        let currentLocalHour: number;

        if (options.customDateStr) {
            todayStr = options.customDateStr;
            currentLocalHour = 12; // Default to mid-day for custom date
        } else {
            try {
                todayStr = nowDate.toLocaleDateString('sv-SE', { timeZone: groupTz });
                const hourStr = new Intl.DateTimeFormat('en-US', {
                    timeZone: groupTz,
                    hour: 'numeric',
                    hour12: false
                }).format(nowDate);
                currentLocalHour = parseInt(hourStr, 10);
                if (currentLocalHour === 24) currentLocalHour = 0;
            } catch {
                todayStr = nowDate.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
                currentLocalHour = (nowDate.getUTCHours() + 9) % 24;
            }
        }

        // If called from cron (not group creation or forced), only post after 7:00 AM local time
        if (!options.force && !options.isGroupCreation && currentLocalHour < 7) {
            return { posted: false, alreadyPosted: false, skippedTime: true };
        }

        const groupRef = db.collection('groups').doc(groupId);
        const msgRef = groupRef.collection('messages').doc(`ai_note_${todayStr}`);
        const msgSnap = await msgRef.get();

        if (msgSnap.exists) {
            return { posted: false, alreadyPosted: true, msgId: msgRef.id };
        }

        // Determine user preferred language & tokens
        let lang = options.langOverride || 'en';
        let ownerFcmTokens: string[] = [];

        if (groupData.ownerUserId) {
            const tokenRes = await getUserFcmTokensAndLanguage(groupData.ownerUserId);
            ownerFcmTokens = tokenRes.tokens;
            if (!options.langOverride && tokenRes.language) {
                lang = tokenRes.language;
            }
        }

        const botName = t(lang, 'groupChat.aiGroupBotNickname');
        const dailyComment = getAiDailyComment(todayStr, lang);
        const scriptureVal = dailyComment.scripture || t(lang, 'groupChat.defaultScripture');
        const chapterVal = dailyComment.chapter || 'Genesis 1:1';
        const categoryLabel = t(lang, 'groupChat.category');
        const chapterLabel = t(lang, 'groupChat.chapter');
        const commentLabel = t(lang, 'groupChat.comment');
        const structuredText = `${categoryLabel}: ${scriptureVal}\n${chapterLabel}: ${chapterVal}\n\n${commentLabel}:\n${dailyComment.comment}`;

        const now = admin.firestore.Timestamp.now();

        await msgRef.set({
            text: structuredText,
            scripture: scriptureVal,
            chapter: chapterVal,
            comment: dailyComment.comment,
            createdAt: now,
            senderId: 'ai-partner-bot',
            senderNickname: botName,
            senderPhotoURL: '/images/mascot.png',
            isSystemMessage: false,
            isNote: true,
            expireAt: admin.firestore.Timestamp.fromMillis(now.toMillis() + 90 * 24 * 60 * 60 * 1000)
        });

        // System message announcement when AI posts a note
        const announceTime = admin.firestore.Timestamp.fromMillis(now.toMillis() + 1000);
        const announceMsgRef = groupRef.collection('messages').doc(`ai_note_announcement_${todayStr}`);
        const announceMsg = t(lang, 'notifications.ai_note_posted_announcement', { nickname: botName })
            || `🎉🎉🎉 **${botName}がノートを投稿しました！！** 🎉🎉🎉`;
        const botAnnouncementName = t(lang, 'notifications.bot_name') || 'Scripture Habit Bot';

        await announceMsgRef.set({
            text: announceMsg,
            senderId: 'system',
            senderNickname: botAnnouncementName,
            createdAt: announceTime,
            isSystemMessage: true,
            type: 'aiNotePostedAnnouncement',
            messageType: 'aiNotePostedAnnouncement',
            messageData: { nickname: botName, userId: 'ai-partner-bot' },
            expireAt: getMessageExpireAt()
        });

        await groupRef.update({
            lastMessageAt: announceTime,
            lastMessageByNickname: botAnnouncementName,
            lastMessageByUid: 'system',
            lastNoteAt: now,
            lastNoteByNickname: botName,
            lastNoteByUid: 'ai-partner-bot',
            [`memberLastActive.ai-partner-bot`]: now
        });

        // Send FCM Push Notification
        if (ownerFcmTokens.length > 0) {
            try {
                await sendPushNotification(ownerFcmTokens, {
                    title: botName,
                    body: dailyComment.comment,
                    data: {
                        groupId,
                        type: 'ai_daily_note'
                    }
                });
            } catch (pushErr) {
                console.warn(`[AiDailyNoteService] FCM Push failed for group ${groupId}:`, pushErr);
            }
        }

        return { posted: true, alreadyPosted: false, msgId: msgRef.id };
    }
}
