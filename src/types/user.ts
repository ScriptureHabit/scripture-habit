import { Timestamp } from 'firebase/firestore';

export interface RecentGroupInfo {
  id: string;
  name: string;
  isAiGroup?: boolean;
  leftAt?: Timestamp | string | number | Date;
}

/**
 * Represents the detailed user document stored in Firestore.
 */
export interface UserData {
  uid: string;
  email?: string;
  nickname?: string;
  photoURL?: string;
  stake?: string;
  ward?: string;
  bio?: string;
  
  // Game/Habit Stats
  streakCount?: number;
  highestStreak?: number;
  lastPostDate?: Timestamp | string | number | Date; // Timestamp or ISO string
  lastPostAt?: Timestamp | string | number | Date;
  postsCount?: number;
  level?: number;
  xp?: number;
  daysStudiedCount?: number;
  totalNotes?: number;
  studiedDates?: string[];
  
  // Preferences
  timeZone?: string;
  language?: string;
  notificationEnabled?: boolean;
  hasFcmToken?: boolean;
  
  // Onboarding/Metadata
  createdAt?: Timestamp | string | number | Date;
  lastLoginAt?: Timestamp | string | number | Date;
  hasSeenWelcomeStory?: boolean;
  hasSeenTour?: boolean;
  hasSeenGroupOptionsTour?: boolean;
  hasSeenGroupChatTour?: boolean;
  isLevelMigrated?: boolean;
  questCreatedGroup?: boolean;
  questPostedNote?: boolean;
  hasCompletedOnboarding?: boolean;
  isAnonymousDemo?: boolean;

  
  // Group/Kick features
  kickThreshold?: number;
  hasSetKickThreshold?: boolean;
  groupIds?: string[];
  groupId?: string;
  lastRecentGroup?: RecentGroupInfo;
  
  // Feature/AI timestamps
  lastLetterGeneratedAt?: Timestamp | string | number | Date;
  lastRecapGeneratedAt?: Timestamp | string | number | Date;
  lastActiveAt?: Timestamp | string | number | Date;
}
