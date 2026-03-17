import { z } from 'zod';

export const supportedLanguages = ['en', 'ja', 'es', 'pt', 'zh', 'zho', 'vi', 'th', 'ko', 'tl', 'sw'];

export const languageNames = {
    'ja': 'Japanese', 'en': 'English', 'es': 'Spanish', 'pt': 'Portuguese',
    'ko': 'Korean', 'zho': 'Chinese (Traditional)', 'vi': 'Vietnamese',
    'th': 'Thai', 'tl': 'Tagalog', 'sw': 'Swahili'
};

const noHtmlTags = (val) => !/<[^>]*>/g.test(val || "");

export const verifyLoginSchema = z.object({ token: z.string().min(1) });

export const joinGroupSchema = z.object({
    token: z.string().min(1).optional(),
    groupId: z.string().optional(),
    inviteCode: z.string().optional()
});

export const leaveGroupSchema = z.object({
    token: z.string().min(1).optional(),
    groupId: z.string().optional()
});

export const deleteGroupSchema = z.object({
    token: z.string().min(1).optional(),
    groupId: z.string().min(1)
});

export const ponderQuestionsSchema = z.object({
    scripture: z.string().min(1).max(100),
    chapter: z.string().min(1).max(50),
    language: z.enum(supportedLanguages).optional()
});

export const weeklyRecapSchema = z.object({
    groupId: z.string().min(1),
    language: z.enum(supportedLanguages).optional()
});

export const personalRecapSchema = z.object({
    uid: z.string().min(1),
    language: z.enum(supportedLanguages).optional()
});

export const translateSchema = z.object({
    text: z.string().min(1).max(5000),
    targetLanguage: z.enum(supportedLanguages)
});

export const postNoteSchema = z.object({
    chapter: z.string().min(1).max(500),
    scripture: z.string().min(1).max(100),
    title: z.string().max(200).optional().nullable(),
    speaker: z.string().max(100).optional().nullable(),
    comment: z.string().max(10000).refine(noHtmlTags, { message: "HTML tags are not allowed" }),
    shareOption: z.enum(['all', 'current', 'specific', 'none']),
    selectedShareGroups: z.array(z.string()).optional().nullable(),
    isGroupContext: z.boolean().optional().nullable(),
    currentGroupId: z.string().optional().nullable(),
    language: z.enum(supportedLanguages).optional().nullable()
});

export const postMessageSchema = z.object({
    groupId: z.string().min(1),
    text: z.string().min(1).max(1000).refine(noHtmlTags, { message: "HTML tags are not allowed" }),
    replyTo: z.object({
        id: z.string(),
        senderNickname: z.string(),
        text: z.string(),
        isNote: z.boolean().optional()
    }).optional().nullable()
});

export const sendCheerSchema = z.object({
    targetUid: z.string().min(1),
    groupId: z.string().min(1),
    language: z.enum(supportedLanguages).optional()
});

export const updateKickThresholdSchema = z.object({
    threshold: z.number().int().min(1).max(30)
});
