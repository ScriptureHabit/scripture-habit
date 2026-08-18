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

interface AiDailyNoteContent {
    botName: string;
    scripture: string;
    chapter: string;
    comment: string;
    structuredText: string;
}

// --- Helpers ---

function resolveGroupLocalTime(
    timeZone: string,
    customDateStr?: string
): { todayStr: string; currentLocalHour: number } {
    if (customDateStr) {
        return { todayStr: customDateStr, currentLocalHour: 12 };
    }

    const nowDate = new Date();
    try {
        const todayStr = nowDate.toLocaleDateString('sv-SE', { timeZone });
        const hourStr = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hour: 'numeric',
            hour12: false
        }).format(nowDate);
        let currentLocalHour = parseInt(hourStr, 10);
        if (currentLocalHour === 24) currentLocalHour = 0;
        return { todayStr, currentLocalHour };
    } catch {
        const todayStr = nowDate.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
        const currentLocalHour = (nowDate.getUTCHours() + 9) % 24;
        return { todayStr, currentLocalHour };
    }
}

function buildAiNotePayload(todayStr: string, lang: string): AiDailyNoteContent {
    const botName = t(lang, 'groupChat.aiGroupBotNickname') || (lang === 'ja' ? 'スクハビAI' : 'Scripture Habit AI');
    const dailyComment = getAiDailyComment(todayStr, lang);
    const scripture = dailyComment.scripture || t(lang, 'groupChat.defaultScripture');
    const chapter = dailyComment.chapter || 'Genesis 1:1';
    const categoryLabel = t(lang, 'noteLabels.scripture') || t(lang, 'noteLabels.category') || (lang === 'ja' ? 'カテゴリ' : 'Category');
    const chapterLabel = t(lang, 'noteLabels.chapter') || (lang === 'ja' ? '章' : 'Chapter');
    const commentLabel = t(lang, 'noteLabels.comment') || (lang === 'ja' ? 'コメント' : 'Comment');
    const structuredText = `${categoryLabel}: ${scripture}\n${chapterLabel}: ${chapter}\n\n${commentLabel}:\n${dailyComment.comment}`;

    return {
        botName,
        scripture,
        chapter,
        comment: dailyComment.comment,
        structuredText
    };
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

        const groupTz = groupData.timeZone || 'Asia/Tokyo';
        const { todayStr, currentLocalHour } = resolveGroupLocalTime(groupTz, options.customDateStr);

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

        // Build formatted note payload
        const content = buildAiNotePayload(todayStr, lang);

        // Write AI Note document, Announcement document, and update group metadata
        await this.writeAiNoteAndAnnouncement(groupRef, msgRef, todayStr, content, lang);

        // Send FCM Push Notification asynchronously
        await this.sendDailyNoteNotification(groupId, ownerFcmTokens, content.botName, content.comment);

        return { posted: true, alreadyPosted: false, msgId: msgRef.id };
    }

    private static async writeAiNoteAndAnnouncement(
        groupRef: admin.firestore.DocumentReference,
        msgRef: admin.firestore.DocumentReference,
        todayStr: string,
        content: AiDailyNoteContent,
        lang: string
    ): Promise<void> {
        const now = admin.firestore.Timestamp.now();

        // 1. Post AI Daily Note
        await msgRef.set({
            text: content.structuredText,
            scripture: content.scripture,
            chapter: content.chapter,
            comment: content.comment,
            createdAt: now,
            senderId: 'ai-partner-bot',
            senderNickname: content.botName,
            senderPhotoURL: '/images/mascot.png',
            isSystemMessage: false,
            isNote: true,
            expireAt: getMessageExpireAt()
        });

        // 2. System message announcement for AI note posting
        const announceTime = admin.firestore.Timestamp.fromMillis(now.toMillis() + 1000);
        const announceMsgRef = groupRef.collection('messages').doc(`ai_note_announcement_${todayStr}`);
        const announceMsg = t(lang, 'notifications.ai_note_posted_announcement', { nickname: content.botName })
            || `🎉🎉🎉 **${content.botName}がノートを投稿しました！！** 🎉🎉🎉`;
        const botAnnouncementName = t(lang, 'notifications.bot_name') || 'Scripture Habit Bot';

        await announceMsgRef.set({
            text: announceMsg,
            senderId: 'system',
            senderNickname: botAnnouncementName,
            createdAt: announceTime,
            isSystemMessage: true,
            type: 'aiNotePostedAnnouncement',
            messageType: 'aiNotePostedAnnouncement',
            messageData: { nickname: content.botName, userId: 'ai-partner-bot' },
            expireAt: getMessageExpireAt()
        });

        // 3. Update Group document metadata
        await groupRef.update({
            lastMessageAt: announceTime,
            lastMessageByNickname: botAnnouncementName,
            lastMessageByUid: 'system',
            lastNoteAt: now,
            lastNoteByNickname: content.botName,
            lastNoteByUid: 'ai-partner-bot',
            [`memberLastActive.ai-partner-bot`]: now
        });
    }

    private static async sendDailyNoteNotification(
        groupId: string,
        tokens: string[],
        botName: string,
        comment: string
    ): Promise<void> {
        if (tokens.length === 0) return;
        try {
            await sendPushNotification(tokens, {
                title: botName,
                body: comment,
                data: {
                    groupId,
                    type: 'ai_daily_note'
                }
            });
        } catch (pushErr) {
            console.warn(`[AiDailyNoteService] FCM Push failed for group ${groupId}:`, pushErr);
        }
    }
}
