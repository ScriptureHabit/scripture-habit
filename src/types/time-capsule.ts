import { FirebaseTimestamp } from './chat';

/**
 * Snapshot of user stats when the time capsule letter was written.
 */
export interface TimeCapsuleStats {
  days: number;
  level: number;
  date: string;
  groupName?: string;
}

/**
 * Represents a Time Capsule letter stored in Firestore under `users/{uid}/letters/{letterId}`.
 */
export interface TimeCapsule {
  id: string;
  type: 'time_capsule';
  targetDays: number;
  title: string;
  content: string; // The letter to future self upon milestone achievement
  sosMessage: string; // The short emergency encourage message when close to dropping habit
  isUnlocked: boolean; // false: sealed time capsule, true: unlocked archive
  createdAt: FirebaseTimestamp;
  unlockedAt?: FirebaseTimestamp;
  createdStats?: TimeCapsuleStats;
}
