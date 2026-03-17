/**
 * Represents the detailed user document stored in Firestore.
 */
export interface UserData {
  uid: string;
  email?: string;
  nickname?: string;
  photoURL?: string;
  
  // Game/Habit Stats
  streakCount?: number;
  highestStreak?: number;
  lastPostDate?: any; // Timestamp or ISO string
  postsCount?: number;
  level?: number;
  xp?: number;
  
  // Preferences
  timeZone?: string;
  language?: string;
  notificationEnabled?: boolean;
  
  // Onboarding/Metadata
  createdAt?: any;
  lastLoginAt?: any;
  
  [key: string]: any;
}
