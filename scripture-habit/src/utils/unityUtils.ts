import { Group, Message } from '../types/chat';
import { parseTimestampToMillis, formatDateInTimeZone, normalizeDateString } from './timeUtils';

/**
 * Calculates current Unity percentage for a group.
 * Can be used in both Sidebar (metadata-only) and Group Chat (real-time messages).
 * 
 * @param group Group data (must include members and dailyActivity)
 * @param userTimeZone Fallback timezone from user profile
 * @param messages Optional messages list for real-time augmentation
 * @returns Unity percentage (0-100)
 */
export const calculateUnityPercentage = (
  group: Group | null,
  messages: Message[] = []
): number => {
  if (!group || !group.members || group.members.length === 0) return 0;

  // Standardize on Group TimeZone. 
  // If missing, we MUST use a stable fallback (UTC) to ensure server and all clients agree.
  // Using userTimeZone as fallback is what caused the discrepancy.
  const groupTimeZone = group.timeZone || 'UTC';
  const now = new Date();
  
  const todayStr = formatDateInTimeZone(now, groupTimeZone);
  const normalizedToday = normalizeDateString(todayStr);
  
  const uniquePosters = new Set<string>();

  // SOURCE A: Server-side dailyActivity (The state on the Group document)
  if (group.dailyActivity?.activeMembers && normalizeDateString(group.dailyActivity.date) === normalizedToday) {
    group.dailyActivity.activeMembers.forEach(uid => uniquePosters.add(uid));
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

  if (eligibleMembers.length === 0) return 0;

  const eligiblePostersCount = [...uniquePosters].filter(uid => eligibleMembers.includes(uid)).length;
  const score = Math.round((eligiblePostersCount / eligibleMembers.length) * 100);
  
  return Math.min(100, Math.max(0, score));
};
