import {
  UserDocument as SharedUserDocument,
  GroupDocument as SharedGroupDocument,
  MessageDocument,
  GroupMemberDocument
} from '../../types/firestore.js';
import {
  Reaction as SchemaReaction,
  ReactionPreview as SchemaReactionPreview,
  MessageType as SchemaMessageType,
  UserProfileBrief as SchemaUserProfileBrief,
  CompatibleTimestamp as SchemaCompatibleTimestamp,
  FirebaseTimestamp as SchemaFirebaseTimestamp,
} from './schemas';

// Re-export core types from Zod schemas for SSOT compatibility
export type CompatibleTimestamp = SchemaCompatibleTimestamp;
export type FirebaseTimestamp = SchemaFirebaseTimestamp;

export type Reaction = SchemaReaction;
export type ReactionPreview = SchemaReactionPreview;
export type MessageType = SchemaMessageType;
export type UserProfileBrief = SchemaUserProfileBrief;

/**
 * Frontend Message interface
 * Extends the shared MessageDocument schema with client-side flags and specific types.
 */
export interface Message extends Omit<MessageDocument, 'id' | 'createdAt' | 'editedAt' | 'replyTo' | 'reactions' | 'reactionPreviews'> {
  id: string; // Required in frontend
  createdAt?: FirebaseTimestamp;
  editedAt?: FirebaseTimestamp;
  messageType?: MessageType;
  senderNickname?: string;
  senderPhotoURL?: string | null;
  
  // Client-side Flags
  isOptimistic?: boolean;
  optimisticId?: string;
  
  // Specific ReplyTo type for frontend
  replyTo?: {
    id: string;
    senderNickname: string;
    text: string;
    isNote: boolean;
  } | string | null;
  messageData?: Record<string, string | number>;

  // Reactions & Previews
  reactions?: Record<string, string[]>;
  reactionPreviews?: Record<string, ReactionPreview[]>;
}


/**
 * Frontend UserProfile interface
 * Extends/Maps from SharedUserDocument
 */
export interface UserProfile extends SharedUserDocument {
  id?: string; // Often used as alias for uid
  email?: string;
  daysStudiedCount?: number;
  totalNotes?: number;
}

/**
 * Frontend Group interface
 * Extends GroupDb schema with client-side specific fields (like unreadCount).
 */
export interface Group extends Omit<SharedGroupDocument, 'id' | 'inviteCodeExpiresAt' | 'lastNoteAt' | 'lastMessageAt' | 'lastRecapGeneratedAt' | 'createdAt' | 'memberJoinedAt' | 'memberLastActive' | 'memberLastReadAt'> {
  id: string; // Required in frontend
  ownerId?: string; // Legacy field for compatibility
  
  // Timestamps mapped to FirebaseTimestamp
  inviteCodeExpiresAt?: FirebaseTimestamp;
  lastMessageAt?: FirebaseTimestamp;
  lastNoteAt?: FirebaseTimestamp;
  lastNoteAtByNickname?: string;
  lastRecapGeneratedAt?: FirebaseTimestamp;
  createdAt?: FirebaseTimestamp;
  
  memberJoinedAt?: Record<string, FirebaseTimestamp>;
  memberLastActive?: Record<string, FirebaseTimestamp>;
  memberLastReadAt?: Record<string, FirebaseTimestamp>;
  myMemberStatus?: GroupMemberDocument;

  unreadCount?: number;
  lastMessageByUid?: string;
  lastNoteByUid?: string;
  myGroupState?: {
    lastReadAt?: FirebaseTimestamp;
    lastActiveAt?: FirebaseTimestamp;
    readMessageCount?: number;
  };
  unityPercentageOverride?: number;
  unityPercentage?: number;
  recentMessages?: Message[];
}

export interface GroupData extends Group {
  _groupId?: string;
}

export interface MembersMap {
  [uid: string]: UserProfileBrief;
}
