import { Timestamp } from 'firebase/firestore';
import { MessageDocument, GroupDocument as SharedGroupDocument, UserDocument as SharedUserDocument, GroupMemberDocument } from '../../types/firestore';

/**
 * Common Firebase Timestamp type to handle both Firestore Timestamp
 * and plain JS objects from APIs or persistence.
 */
export type FirebaseTimestamp = Timestamp | { seconds: number; nanoseconds: number } | { toDate: () => Date } | string | Date | number;

export interface Reaction {
  userId: string; // Internal standard
  nickname: string;
  emoji: string;
}

export type MessageType = 
  | 'text' 
  | 'streakAnnouncement' 
  | 'studyNote' 
  | 'system' 
  | 'userJoined' 
  | 'userLeft' 
  | 'unityAnnouncement' 
  | 'weeklyRecap';

/**
 * Frontend Message interface
 * Extends the shared MessageDocument schema with client-side flags and specific types.
 */
export interface Message extends Omit<MessageDocument, 'id' | 'createdAt' | 'editedAt' | 'replyTo'> {
  id: string; // Required in frontend
  createdAt?: FirebaseTimestamp;
  editedAt?: FirebaseTimestamp;
  messageType?: MessageType;
  senderNickname?: string;
  senderPhotoURL?: string | null;
  
  // Client-side Flags
  isOptimistic?: boolean;
  
  // Specific ReplyTo type for frontend
  replyTo?: {
    id: string;
    senderNickname: string;
    text: string;
    isNote: boolean;
  } | string | null;
  messageData?: Record<string, string | number>;

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
 * Extends SharedGroupDocument with client-side specific fields (like unreadCount).
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

  // Client-side UI state
  unreadCount?: number;
  messageCount?: number;
  noteCount?: number;
  lastMessageByUid?: string;
  lastNoteByUid?: string;
  dailyActivity?: {
    date: string;
    activeMembers: string[];
  };
  myGroupState?: {
    lastReadAt?: FirebaseTimestamp;
    lastActiveAt?: FirebaseTimestamp;
    readMessageCount?: number;
  };
}

export interface GroupData extends Group {
  _groupId?: string;
}

export interface UserProfileBrief {
  id: string;
  uid?: string;
  nickname?: string;
  photoURL?: string;
  profilePicUrl?: string; // Potential legacy field
  lastPostDate?: FirebaseTimestamp;
  lastActiveAt?: FirebaseTimestamp;
  lastReadAt?: FirebaseTimestamp;
}

export interface MembersMap {
  [uid: string]: UserProfileBrief;
}
