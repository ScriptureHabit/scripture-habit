import { Timestamp } from 'firebase/firestore';

/**
 * Common Firebase Timestamp type to handle both Firestore Timestamp
 * and plain JS objects from APIs or persistence.
 */
export type FirebaseTimestamp = Timestamp | { seconds: number; nanoseconds: number } | any;

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

export interface Message {
  id: string;
  text?: string;
  senderId?: string;
  senderNickname?: string;
  senderPhotoURL?: string | null;
  createdAt?: FirebaseTimestamp;
  messageType?: MessageType;
  
  // Flags
  isNote?: boolean;
  isEntry?: boolean;
  isSystemMessage?: boolean;
  isOptimistic?: boolean;
  isEdited?: boolean;
  
  // Content Reference
  scripture?: string;
  chapter?: string;
  originalNoteId?: string;
  
  // Metadata
  editedAt?: FirebaseTimestamp;
  replyTo?: {
    id: string;
    senderNickname: string;
    text: string;
    isNote: boolean;
  } | string | null;
  
  reactions?: Record<string, string[]>;
  translations?: Record<string, string>;
  [key: string]: any;
}

// UserProfile interface
export interface UserProfile {
  uid?: string;
  id?: string;
  nickname?: string;
  photoURL?: string;
  email?: string;
  stake?: string;
  ward?: string;
  bio?: string;
  daysStudiedCount?: number;
  streakCount?: number;
  totalNotes?: number;
  [key: string]: any;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  members?: string[];
  ownerUserId?: string;
  ownerId?: string; // Legacy field for compatibility
  
  // Settings & Status
  inviteCode?: string;
  inviteCodeExpiresAt?: FirebaseTimestamp;
  isPublic?: boolean;
  isPrivate?: boolean;
  
  // Stats
  messageCount?: number;
  noteCount?: number;
  membersCount?: number;
  
  // Activity Mapping
  lastMessageAt?: FirebaseTimestamp;
  lastMessageByNickname?: string;
  lastMessageByUid?: string;
  lastRecapGeneratedAt?: FirebaseTimestamp;
  lastUnityAnnouncementDate?: string;
  createdAt?: FirebaseTimestamp;
  memberPreviews?: { uid: string; nickname: string }[];
  
  // Localization
  translations?: Record<string, { name: string; description?: string }>;
  
  // User-specific (often added by client-side mappers)
  unreadCount?: number;
  
  // Detailed tracking
  dailyActivity?: {
    date: string;
    activeMembers: string[];
  };
  memberLastActive?: Record<string, FirebaseTimestamp>;
  memberLastReadAt?: Record<string, FirebaseTimestamp>;
  memberJoinedAt?: Record<string, FirebaseTimestamp>;
  [key: string]: any;
}

export interface GroupData extends Group {
  _groupId?: string;
}

export interface UserProfileBrief {
  id: string;
  nickname?: string;
  photoURL?: string;
  profilePicUrl?: string; // Potential legacy field
  [key: string]: any;
}

export interface MembersMap {
  [uid: string]: UserProfileBrief;
}