import { Group, Message, MembersMap } from '../types/chat.js';
import { parseTimestampToMillis, parseTimestampToDate, formatDateInTimeZone, normalizeDateString } from './time-utils.js';

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
 * Returns astronomical status emoji based on Unity percentage.
 * 
 * @param percentage Unity percentage (0-100)
 * @returns Status emoji (☀️, 🌕, 🌠, 🌑)
 */
export const getUnityStatusEmoji = (percentage: number): string => {
  if (percentage === 100) return '☀️';
  if (percentage >= 66) return '🌕';
  if (percentage >= 33) return '🌠';
  return '🌑';
};

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
  referenceDate: Date = new Date(),
  membersMap?: MembersMap
): UnityParticipation => {
  if (!group || !group.members || !Array.isArray(group.members) || group.members.length === 0) {
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
      
    const normActivityDate = normalizeDateString(activityDateStr);
    
    if (normActivityDate === normalizedToday) {
      activity.activeMembers.forEach(uid => {
        uniquePosters.add(uid);
      });
    }
  }

  // SOURCE B: Client-side real-time Messages (Augment if messages are provided)
  if (messages.length > 0) {
    messages.forEach(msg => {
      // Guard: Ignore system messages
      if (msg.isSystemMessage || msg.senderId === 'system') return;

      // Strict note check: Only count valid study notes
      const isAiBot = msg.senderId === 'ai-partner-bot';
      const isAiNote = isAiBot && (
        msg.isNote === true || 
        Boolean(msg.text && (msg.text.includes('カテゴリ') || msg.text.includes('Category') || msg.text.includes('Scripture')))
      );
      const isUserNote = !isAiBot && (msg.isNote === true || msg.isEntry === true || Boolean(msg.originalNoteId));

      if (!isAiNote && !isUserNote) return;
      
      const msgTime = parseTimestampToMillis(msg.createdAt);
      if (isNaN(msgTime)) return;

      const msgDateStr = formatDateInTimeZone(new Date(msgTime), groupTimeZone);
      const normMsgDate = normalizeDateString(msgDateStr);
      
      if (normMsgDate === normalizedToday) {
        if (msg.senderId) uniquePosters.add(msg.senderId);
      }
    });
  }

  // ELIGIBILITY LOGIC
  // Members who joined today are excluded from the denominator UNLESS they already posted.
  const memberJoinedAt = group.memberJoinedAt || {};
  // Count unique member IDs
  const uniqueMemberIds = Array.from(new Set(group.members));
  
  const eligibleMembers = uniqueMemberIds.filter(uid => {
    // In AI companion groups or demo groups, always count all members in denominator so percentage is strictly less than 100% until the user posts
    if (group.isAiGroup || group.aiCompanionUid || group.isDemoGroup) return true;

    const isPoster = uniquePosters.has(uid);
    if (isPoster) return true; // Posted today -> count

    let joinedTs = memberJoinedAt[uid];
    
    // Fallback 1: membersMap (more up-to-date in GroupChat)
    if (!joinedTs && membersMap?.[uid]?.joinedAt) {
      joinedTs = membersMap[uid].joinedAt;
    }

    // Fallback 2: myMemberStatus (available in Sidebar for current user)
    if (!joinedTs && group.myMemberStatus?.uid === uid && group.myMemberStatus.joinedAt) {
      joinedTs = group.myMemberStatus.joinedAt;
    }

    if (!joinedTs) return true;

    const joinedTime = parseTimestampToMillis(joinedTs);
    const joinedDateStr = formatDateInTimeZone(new Date(joinedTime), groupTimeZone);
    const normalizedJoined = normalizeDateString(joinedDateStr);

    // If joined < today (lexicographical), they are eligible for the daily requirement
    const isEligible = normalizedJoined < normalizedToday;
    
    return isEligible;
  });

  const postedMembers = eligibleMembers.filter(uid => uniquePosters.has(uid));
  const notPostedMembers = eligibleMembers.filter(uid => !uniquePosters.has(uid));

  // TRUTH: If no one is required to post (e.g. all new joins)
  if (eligibleMembers.length === 0) {
    const isAnyPoster = uniquePosters.size > 0;
    const percentage = isAnyPoster ? 100 : 0;
    return { eligibleMembers: [], postedMembers: Array.from(uniquePosters), notPostedMembers: [], percentage };
  }

  const percentage = Math.round((postedMembers.length / eligibleMembers.length) * 100);
  return { eligibleMembers, postedMembers, notPostedMembers, percentage };
};

/**
 * Legacy wrapper for getUnityParticipation
 */
export const calculateUnityPercentage = (
  group: Group | null,
  messages: Message[] = [],
  referenceDate: Date = new Date(),
  membersMap?: MembersMap
): number => {
  return getUnityParticipation(group, messages, referenceDate, membersMap).percentage;
};
