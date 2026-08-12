import { z } from 'zod';

/**
 * Environment-agnostic Timestamp interface that matches both
 * firebase/firestore and firebase-admin/firestore.
 */
export interface CompatibleTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
}

/**
 * Common Firebase Timestamp type to handle both Firestore Timestamp
 * and plain JS objects from APIs or persistence.
 */
export type FirebaseTimestamp = 
  | CompatibleTimestamp 
  | { seconds: number; nanoseconds: number } 
  | { toDate: () => Date } 
  | string 
  | Date 
  | number 
  | { _methodName?: string };

// Helper to handle Firestore Timestamps using a custom validator with correct static types
export const FirebaseTimestampSchema = z.custom<FirebaseTimestamp>();

// Base schema for user attributes to keep them DRY and consistent
export const BaseUserSchema = z.object({
  uid: z.string().optional(),
  nickname: z.string().min(1).max(50).optional(),
  photoURL: z.string().nullable().optional(),
});

export const ReactionPreviewSchema = BaseUserSchema.extend({
  uid: z.string(), // Override to make it required
});

export const ReactionSchema = BaseUserSchema.omit({ uid: true }).extend({
  userId: z.string(),
  nickname: BaseUserSchema.shape.nickname.unwrap().nullable().optional(),
  emoji: z.string('👍'),
});

export const MessageTypeEnumValues = [
  'text', 
  'streakAnnouncement', 
  'notePostedAnnouncement',
  'studyNote', 
  'system', 
  'userJoined', 
  'userLeft', 
  'userKicked',
  'unityAnnouncement',
  'inactivityRemoval'
] as const;

export const MessageTypeSchema = z.enum(MessageTypeEnumValues).catch('text'); // Unknown types fall back to 'text' to prevent listener crashes

export const MessageSchema = z.object({
  id: z.string(),
  uid: z.string().optional(),
  text: z.string().trim().min(1, "validation.messageRequired").optional(),
  senderNickname: z.string().optional(),
  senderPhotoURL: z.string().nullable().optional(),
  createdAt: FirebaseTimestampSchema.optional(),
  editedAt: FirebaseTimestampSchema.optional(),
  messageType: MessageTypeSchema.optional(),
  isOptimistic: z.boolean().optional(),
  optimisticId: z.string().optional(),
  replyTo: z.union([
    z.string(),
    z.object({
      id: z.string(),
      senderNickname: z.string().nullable().optional(),
      text: z.string().nullable().optional(),
      isNote: z.boolean().nullable().optional(),
    }),
  ]).nullable().optional(),
  reactions: z.record(z.string(), z.array(z.string())).optional(),
  reactionPreviews: z.record(z.string(), z.array(ReactionPreviewSchema)).optional(),
  messageData: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
}).passthrough();

export const GroupSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1, "validation.groupNameRequired").max(50, "validation.groupNameTooLong").optional(),
  members: z.array(z.string()).optional(),
  lastMessageAt: FirebaseTimestampSchema.optional(),
  lastNoteAt: FirebaseTimestampSchema.optional(),
  unreadCount: z.number().optional(),
  isDeleted: z.boolean().optional(),
  dailyActivity: z.object({
    date: z.string(),
    activeMembers: z.array(z.string())
  }).optional(),
}).passthrough();

export const UserProfileBriefSchema = BaseUserSchema.extend({
  id: z.string(),
  lastPostDate: FirebaseTimestampSchema.optional(),
  lastActiveAt: FirebaseTimestampSchema.optional(),
  lastReadAt: FirebaseTimestampSchema.optional(),
  joinedAt: FirebaseTimestampSchema.optional(),
  language: z.enum(['en', 'ja', 'ko', 'es', 'pt', 'vi', 'th', 'tl', 'zh']).optional(),
}).passthrough();

export const GroupMemberSchema = BaseUserSchema.extend({
  uid: z.string(), // Override to make it required
  joinedAt: FirebaseTimestampSchema.optional(),
}).passthrough();

export const UserDataSchema = BaseUserSchema.extend({
  uid: z.string(), // Override to make it required
  email: z.string().email("validation.emailInvalid").optional(), // Enforce email format validation
}).passthrough();

// Export inferred types from Zod schemas for SSOT
export type Reaction = z.infer<typeof ReactionSchema>;
export type ReactionPreview = z.infer<typeof ReactionPreviewSchema>;
export type MessageType = z.infer<typeof MessageTypeSchema>;
export type MessageDb = z.infer<typeof MessageSchema>;
export type GroupDb = z.infer<typeof GroupSchema>;
export type UserProfileBrief = z.infer<typeof UserProfileBriefSchema>;
export type GroupMemberDb = z.infer<typeof GroupMemberSchema>;
export type UserDataDb = z.infer<typeof UserDataSchema>;
