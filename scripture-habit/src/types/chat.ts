import { Timestamp } from 'firebase/firestore';

export interface Reaction {
  odU: string;
  nickname: string;
  emoji: string;
}

export interface Message {
  id: string;
  text?: string;
  senderId?: string;
  senderNickname?: string;
  senderPhotoURL?: string| null;
  createdAt?: Timestamp | { seconds: number; nanoseconds?: number } | any;
  messageType?: 'text' | 'streakAnnouncement' | 'studyNote' | 'system' | 'userJoined' | 'userLeft' | 'unityAnnouncement' | 'weeklyRecap';
  isNote?: boolean;
  isEntry?: boolean;
  isSystemMessage?: boolean;
  isOptimistic?: boolean;
  scripture?: string;
  chapter?: string;
  editedAt?: Timestamp;
  isEdited?: boolean;
  originalNoteId?: string;
  replyTo?: {
    id: string;
    senderNickname: string;
    text: string;
    isNote: boolean;
  } | string | null;
  reactions?: Reaction[];
  translations?: Record<string, string>;
  [key: string]: any;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  members?: string[];
  ownerUserId?: string;
  ownerId?: string; // Legacy field
  inviteCode?: string;
  isPublic?: boolean;
  messageCount?: number;
  noteCount?: number;
  lastRecapGeneratedAt?: Timestamp;
  lastUnityAnnouncementDate?: string;
  translations?: Record<string, { name?: string; description?: string }>;
  unreadCount?: number;
  dailyActivity?: {
    date: string;
    activeMembers: string[];
  };
  memberLastActive?: Record<string, Timestamp | any>;
  memberLastReadAt?: Record<string, Timestamp | any>;
  memberJoinedAt?: Record<string, Timestamp | any>;
  [key: string]: any;
}

export interface GroupData extends Group {
  _groupId?: string;
}

export interface UserProfile {
  id?: string;
  nickname?: string;
  photoURL?: string;
  profilePicUrl?: string;
  [key: string]: any;
}

export interface MembersMap {
  [uid: string]: UserProfile;
}
