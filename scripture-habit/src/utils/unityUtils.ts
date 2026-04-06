import { Group, Message } from '../types/chat';
import { parseTimestampToMillis } from './timeUtils';

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
  userTimeZone: string = 'UTC',
  messages: Message[] = []
): number => {
  if (!group || !group.members || group.members.length === 0) return 0;

  const groupTimeZone = group.timeZone || userTimeZone || 'UTC';
  const now = new Date();
  
  // 1. Get consistent "Today" string for dailyActivity comparison (YYYY-MM-DD)
  // We use this as the primary boundary for Unity.
  let todayStr: string;
  try {
      todayStr = now.toLocaleDateString('sv-SE', { timeZone: groupTimeZone });
  } catch (e) {
      console.warn(`[UnityUtils] Invalid timezone ${groupTimeZone}, falling back to UTC`);
      todayStr = now.toLocaleDateString('sv-SE', { timeZone: 'UTC' });
  }
  
  const uniquePosters = new Set<string>();

  // SOURCE A: Server-side dailyActivity (The state on the Group document)
  if (group.dailyActivity?.activeMembers && group.dailyActivity.date === todayStr) {
    group.dailyActivity.activeMembers.forEach(uid => uniquePosters.add(uid));
  }

  // SOURCE B: Client-side real-time Messages (Augment if messages are provided)
  if (messages.length > 0) {
    messages.forEach(msg => {
      if (!msg.createdAt || msg.senderId === 'system' || msg.isSystemMessage || !msg.isNote) return;
      
      const msgTime = parseTimestampToMillis(msg.createdAt);
      if (isNaN(msgTime)) return;

      const msgDateStr = new Date(msgTime).toLocaleDateString('sv-SE', { timeZone: groupTimeZone });
      if (msgDateStr === todayStr) {
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

    const joinedDateStr = new Date(joinedTime).toLocaleDateString('sv-SE', { timeZone: groupTimeZone });
    // If they joined before today, they are eligible.
    return joinedDateStr < todayStr;
  });

  if (eligibleMembers.length === 0) return 0;

  const eligiblePostersCount = [...uniquePosters].filter(uid => eligibleMembers.includes(uid)).length;
  const score = Math.round((eligiblePostersCount / eligibleMembers.length) * 100);
  
  return Math.min(100, Math.max(0, score));
};
