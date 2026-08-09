import { z } from 'zod';

export const supportedLanguages = ['en', 'ja', 'es', 'pt', 'zh', 'zho', 'vi', 'th', 'ko', 'tl', 'sw'] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export const languageNames: Record<string, string> = {
    'ja': 'Japanese', 'en': 'English', 'es': 'Spanish', 'pt': 'Portuguese',
    'ko': 'Korean', 'zho': 'Chinese (Traditional)', 'vi': 'Vietnamese',
    'th': 'Thai', 'tl': 'Tagalog', 'sw': 'Swahili'
};

const noHtmlTags = (val: string | null | undefined) => !/<[^>]*>/g.test(val || "");

export const verifyLoginSchema = z.object({ token: z.string().min(1) });

export const initializeProfileSchema = z.object({
    nickname: z.string().min(1).max(30).optional(),
    timeZone: z.string().optional(),
    language: z.enum(supportedLanguages).optional()
});

export const updateProfileSchema = z.object({
    nickname: z.string().min(1).max(30).optional(),
    photoURL: z.string().max(1000).optional(),
    stake: z.string().max(100).optional(),
    ward: z.string().max(100).optional(),
    bio: z.string().max(500).optional(),
    language: z.enum(supportedLanguages).optional(),
    hasSeenWelcomeStory: z.boolean().optional(),
    hasSeenTour: z.boolean().optional(),
    hasSeenGroupOptionsTour: z.boolean().optional(),
    hasSeenGroupChatTour: z.boolean().optional()
});

export const joinGroupSchema = z.object({
    token: z.string().min(1).optional(),
    groupId: z.string().optional(),
    inviteCode: z.string().optional()
});

export const createGroupSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(1000).optional(),
    isPublic: z.boolean().optional(),
    timeZone: z.string().optional()
});

export const createAiGroupSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    timeZone: z.string().optional()
});

export const leaveGroupSchema = z.object({
    token: z.string().min(1).optional(),
    groupId: z.string().optional()
});

export const deleteGroupSchema = z.object({
    token: z.string().min(1).optional(),
    groupId: z.string().min(1)
});

export const deleteNoteSchema = z.object({
    token: z.string().min(1).optional(),
    noteId: z.string().min(1)
});

export const deleteMessageSchema = z.object({
    token: z.string().min(1).optional(),
    groupId: z.string().min(1),
    messageId: z.string().min(1)
});

export const updateReadStatusSchema = z.object({
    token: z.string().min(1).optional(),
    groupId: z.string().min(1),
    readMessageCount: z.number().int().min(0),
    forceRecount: z.boolean().optional()
});

export const announceUnitySchema = z.object({
    token: z.string().min(1).optional(),
    groupId: z.string().min(1)
});

export const regenerateInviteCodeSchema = z.object({
    token: z.string().min(1).optional(),
    groupId: z.string().min(1),
    expiryDays: z.number().int().min(1).max(30).optional()
});

export const updateGroupSchema = z.object({
    token: z.string().min(1).optional(),
    groupId: z.string().min(1),
    name: z.string().max(100).optional(),
    description: z.string().max(1000).optional(),
    isPublic: z.boolean().optional(),
    isPrivate: z.boolean().optional(),
    timeZone: z.string().optional(),
    translations: z.record(z.string(), z.object({
        name: z.string().max(100).optional(),
        description: z.string().max(1000).optional()
    })).optional()
});

export const ponderQuestionsSchema = z.object({
    scripture: z.string().min(1).max(100),
    chapter: z.string().min(1).max(50),
    language: z.enum(supportedLanguages).optional()
});

export const personalRecapSchema = z.object({
    uid: z.string().min(1),
    language: z.enum(supportedLanguages).optional()
});

export const translateSchema = z.object({
    text: z.string().min(1).max(5000),
    targetLanguage: z.enum(supportedLanguages),
    messageId: z.string().optional(),
    groupId: z.string().optional(),
    updateType: z.enum(['group_name', 'group_description', 'user_nickname', 'user_bio', 'user_stake', 'user_ward']).optional(),
    force: z.boolean().optional()
});

export const translateBatchSchema = z.object({
    messages: z.array(z.object({
        id: z.string(),
        text: z.string().min(1).max(5000)
    })).min(1).max(20),
    targetLanguage: z.enum(supportedLanguages),
    groupId: z.string().min(1),
    force: z.boolean().optional()
});

export const postNoteSchema = z.object({
    chapter: z.string().min(1).max(500),
    scripture: z.string().min(1).max(100),
    messageText: z.string().min(1).max(3000), 
    title: z.string().max(200).optional().nullable(),
    speaker: z.string().max(100).optional().nullable(),
    comment: z.string().max(2000).refine(noHtmlTags, { message: "HTML tags are not allowed" }),
    shareOption: z.enum(['all', 'current', 'specific', 'none']),
    selectedShareGroups: z.array(z.string()).optional().nullable(),
    isGroupContext: z.boolean().optional().nullable(),
    currentGroupId: z.string().optional().nullable(),
    language: z.enum(supportedLanguages).optional().nullable(),
    timeZone: z.string().optional().nullable(),
    optimisticId: z.string().optional(),
    clientTimestamp: z.number().int().optional()
});

export const postMessageSchema = z.object({
    groupId: z.string().min(1),
    text: z.string().min(1).max(2000).refine(noHtmlTags, { message: "HTML tags are not allowed" }),
    replyTo: z.object({
        id: z.string(),
        senderNickname: z.string(),
        text: z.string(),
        isNote: z.boolean().optional()
    }).optional().nullable(),
    optimisticId: z.string().optional(),
    nickname: z.string().optional(),
    photoURL: z.string().optional().nullable(),
    clientTimestamp: z.number().int().optional()
});

export const sendCheerSchema = z.object({
    targetUid: z.string().min(1),
    groupId: z.string().min(1),
    language: z.enum(supportedLanguages).optional(),
    senderNickname: z.string().optional(),
    senderTimeZone: z.string().optional()
});

export const updateKickThresholdSchema = z.object({
    threshold: z.number().int().min(1).max(30)
});

export type UpdateKickThresholdRequest = z.infer<typeof updateKickThresholdSchema>;
export interface UpdateKickThresholdResponse {
    success: boolean;
    cleanedUpGroups: string[];
}

export const reportSchema = z.object({
    messageId: z.string().min(1),
    groupId: z.string().optional().nullable(),
    reporterNickname: z.string().optional().nullable(),
    reportedUserId: z.string().min(1),
    reportedUserNickname: z.string().optional().nullable(),
    messageText: z.string().optional().nullable(),
    reason: z.string().min(1).max(1000)
});

export const kickMemberSchema = z.object({
    groupId: z.string().min(1),
    targetUid: z.string().min(1),
    reason: z.string().max(200).optional()
});

// Explicit API Type definitions for MSW / client type safety
export type JoinGroupRequest = z.infer<typeof joinGroupSchema>;
export type CreateGroupRequest = z.infer<typeof createGroupSchema>;
export type TranslateRequest = z.infer<typeof translateSchema>;

export interface GroupListItem {
    id: string;
    name: string;
    isPublic: boolean;
    members: string[];
}

export interface TranslateResponse {
    translatedText: string;
}
