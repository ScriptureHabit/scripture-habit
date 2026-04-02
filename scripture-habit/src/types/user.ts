import { Timestamp } from 'firebase/firestore';

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
  postsCount?: number;
  level?: number;
  xp?: number;
  daysStudiedCount?: number;
  totalNotes?: number;
  
  // Preferences
  timeZone?: string;
  language?: string;
  notificationEnabled?: boolean;
  
  // Onboarding/Metadata
  createdAt?: Timestamp | string | number | Date;
  lastLoginAt?: Timestamp | string | number | Date;
  hasSeenWelcomeStory?: boolean;
  
  // Group/Kick features
  kickThreshold?: number;
  hasSetKickThreshold?: boolean;
  groupIds?: string[];
  groupId?: string;
  
  // Feature/AI timestamps
  lastRecapGeneratedAt?: Timestamp | string | number | Date;
}
