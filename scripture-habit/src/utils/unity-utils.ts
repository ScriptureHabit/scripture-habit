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
    
    // Debug logging for Unity Test groups
    if (group.name?.includes('Unity Test')) {
      console.log(`[getUnityParticipation] ${group.name}: activityDate=${normActivityDate}, today=${normalizedToday}, match=${normActivityDate === normalizedToday}`);
    }
    
    if (normActivityDate === normalizedToday) {
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
      const normMsgDate = normalizeDateString(msgDateStr);
      
      if (normMsgDate === normalizedToday) {
        uniquePosters.add(msg.senderId!);
      }
    });
  }

  // ELIGIBILITY LOGIC
  // Members who joined today are excluded from the denominator UNLESS they already posted.
  const memberJoinedAt = group.memberJoinedAt || {};
  // Ensure we only count unique member IDs
  const uniqueMemberIds = Array.from(new Set(group.members));
  
  const eligibleMembers = uniqueMemberIds.filter(uid => {
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

  // TRUTH: If no one is required to post (e.g. all new joins), unity is 100%
  if (eligibleMembers.length === 0) {
    if (group.name?.includes('Unity Test')) {
      console.log(`[getUnityParticipation] ${group.name}: No eligible members (all joined today), returning 100%`);
    }
    return { eligibleMembers: [], postedMembers: [], notPostedMembers: [], percentage: 100 };
  }

  const percentage = Math.round((postedMembers.length / eligibleMembers.length) * 100);
  if (group.name?.includes('Unity Test')) {
    console.log(`[getUnityParticipation] ${group.name}: posters=${postedMembers.length}, eligible=${eligibleMembers.length}, percentage=${percentage}%`);
  }
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
