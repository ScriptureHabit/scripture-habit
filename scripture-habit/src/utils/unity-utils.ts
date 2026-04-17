import { Group, Message } from '../types/chat';
import { parseTimestampToMillis, parseTimestampToDate, formatDateInTimeZone, normalizeDateString } from './time-utils';

/**
 * Calculates current Unity percentage for a group.
 * Can be used in both Sidebar (metadata-only) and Group Chat (real-time messages).
 * 
 * @param group Group data (must include members and dailyActivity)
 * @param userTimeZone Fallback timezone from user profile
 * @param messages Optional messages list for real-time augmentation
 * @returns Unity percentage (0-100)
 */
export interface UnityParticipation {
  eligibleMembers: string[];
  postedMembers: string[];
  notPostedMembers: string[];
  percentage: number;
}

/**
 * Calculates current Unity participation details for a group.
 * Can be used in both Sidebar (metadata-only) and Group Chat (real-time messages).
 * 
 * @param group Group data (must include members and dailyActivity)
 * @param messages Optional messages list for real-time augmentation
 * @param referenceDate Optional reference date (defaults to now)
 * @returns Unity participation details
 */
export const getUnityParticipation = (
  group: Group | null,
  messages: Message[] = [],
  referenceDate: Date = new Date()
): UnityParticipation => {
  if (!group || !group.members || group.members.length === 0) {
    return { eligibleMembers: [], postedMembers: [], notPostedMembers: [], percentage: 0 };
  }

  const groupTimeZone = group.timeZone || 'UTC';
  const now = referenceDate;
  
  const todayStr = formatDateInTimeZone(now, groupTimeZone);
  const normalizedToday = normalizeDateString(todayStr);
  
  const uniquePosters = new Set<string>();

  // SOURCE A: Server-side dailyActivity (The state on the Group document)
  const activity = group.dailyActivity;
  if (activity?.activeMembers && activity.date) {
    const activityDateStr = typeof activity.date === 'string' 
      ? activity.date 
      : formatDateInTimeZone(parseTimestampToDate(activity.date), groupTimeZone);
      
    if (normalizeDateString(activityDateStr) === normalizedToday) {
      activity.activeMembers.forEach(uid => uniquePosters.add(uid));
    }
  }

  // SOURCE B: Client-side real-time Messages (Augment if messages are provided)
  if (messages.length > 0) {
    messages.forEach(msg => {
      if (!msg.createdAt || msg.senderId === 'system' || msg.isSystemMessage || !msg.isNote) return;
      
      const msgTime = parseTimestampToMillis(msg.createdAt);
      if (isNaN(msgTime)) return;

      const msgDateStr = formatDateInTimeZone(new Date(msgTime), groupTimeZone);
      if (normalizeDateString(msgDateStr) === normalizedToday) {
        uniquePosters.add(msg.senderId!);
      }
    });
  }

  // ELIGIBILITY LOGIC
  // Members who joined today are excluded from the denominator UNLESS they already posted.
  const memberJoinedAt = group.memberJoinedAt || {};
  const eligibleMembers = group.members.filter(uid => {
    if (uniquePosters.has(uid)) return true; // Posted today -> count
    
    const joinedTs = memberJoinedAt[uid];
    if (!joinedTs) return true;
    
    const joinedTime = parseTimestampToMillis(joinedTs);
    if (isNaN(joinedTime)) return true;

    const joinedDateStr = formatDateInTimeZone(new Date(joinedTime), groupTimeZone);
    // If they joined before today, they are eligible.
    return normalizeDateString(joinedDateStr) < normalizedToday;
  });

  if (eligibleMembers.length === 0) {
    return { eligibleMembers: [], postedMembers: [], notPostedMembers: [], percentage: 0 };
  }

  const postedMembers = [...uniquePosters].filter(uid => eligibleMembers.includes(uid));
  const notPostedMembers = eligibleMembers.filter(uid => !postedMembers.includes(uid));
  
  const score = Math.round((postedMembers.length / eligibleMembers.length) * 100);
  const percentage = Math.min(100, Math.max(0, score));

  return {
    eligibleMembers,
    postedMembers,
    notPostedMembers,
    percentage
  };
};

/**
 * Legacy wrapper for getUnityParticipation
 */
export const calculateUnityPercentage = (
  group: Group | null,
  messages: Message[] = [],
  referenceDate: Date = new Date()
): number => {
  return getUnityParticipation(group, messages, referenceDate).percentage;
};
