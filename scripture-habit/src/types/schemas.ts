import { z } from 'zod';

/**
 * Zod schemas for validating Firestore data at runtime.
 * Using .passthrough() for partial compatibility while allowing strict checks for core fields.
 */

// Helper to handle Firestore Timestamps which can be real Timestamp objects
// or plain serialized objects after being passed through network or local storage.
export const FirebaseTimestampSchema = z.union([
  z.object({
    seconds: z.number(),
    nanoseconds: z.number(),
  }),
  z.string(),
  z.instanceof(Date),
  z.number(),
  z.unknown() // Allow the proprietary Firestore Timestamp instance (typed correctly elsewhere)
]);

export const ReactionPreviewSchema = z.object({
  uid: z.string(),
  nickname: z.string().optional(),
  photoURL: z.string().optional(),
});

export const ReactionSchema = z.object({
  userId: z.string(),
  nickname: z.string(),
  emoji: z.string(),
});

export const MessageTypeSchema = z.enum([
  'text', 
  'streakAnnouncement', 
  'studyNote', 
  'system', 
  'userJoined', 
  'userLeft', 
  'unityAnnouncement', 
  'weeklyRecap'
]);

export const MessageSchema = z.object({
  id: z.string(),
  uid: z.string().optional(),
  text: z.string().optional(),
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
      senderNickname: z.string(),
      text: z.string(),
      isNote: z.boolean(),
    }),
  ]).nullable().optional(),
  reactions: z.record(z.string(), z.array(z.string())).optional(),
  reactionPreviews: z.record(z.string(), z.array(ReactionPreviewSchema)).optional(),
  messageData: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
}).passthrough();

export const GroupSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  messageCount: z.number().optional(),
  noteCount: z.number().optional(),
  members: z.array(z.string()).optional(),
  lastMessageAt: FirebaseTimestampSchema.optional(),
  lastNoteAt: FirebaseTimestampSchema.optional(),
  unreadCount: z.number().optional(),
}).passthrough();

export const UserProfileBriefSchema = z.object({
  id: z.string(),
  uid: z.string().optional(),
  nickname: z.string().optional(),
  photoURL: z.string().optional(),
  lastActiveAt: FirebaseTimestampSchema.optional(),
}).passthrough();

export const GroupMemberSchema = z.object({
  uid: z.string(),
  nickname: z.string().optional(),
  photoURL: z.string().optional(),
  joinedAt: FirebaseTimestampSchema.optional(),
}).passthrough();

export const UserDataSchema = z.object({
  uid: z.string(),
  nickname: z.string().optional(),
  email: z.string().optional(),
  photoURL: z.string().optional(),
}).passthrough();
