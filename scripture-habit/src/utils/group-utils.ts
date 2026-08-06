import { Group, Message } from '../types/chat';
import { UserData } from '../types/user';
import { calculateUnityPercentage } from './unity-utils';
import { formatDateInTimeZone, normalizeDateString, parseTimestampToDate } from './time-utils';
import { DEFAULT_KICK_THRESHOLD } from '../constants';

/**
 * Enriches a group object with the correct display unity percentage,
 * applying overrides and falling back to Firestore values when necessary.
 * 
 * Logic Priority:
 * 1. Override (Active chat session updates)
 * 2. Calculated (Live client-side calculation from dailyActivity/messages if > 0)
 * 3. Firestore (The pre-calculated value from the backend - fallback for mismatches)
 * 
 * CRITICAL: If the Firestore data is from a previous day (stale), it defaults to 0
 * to ensure an immediate UI reset at midnight.
 */
export const enrichGroupUnity = (
  group: Group,
  messages: Message[] = [],
  override?: number,
  referenceDate: Date = new Date()
): Group => {
  const groupTimeZone = group.timeZone || 'UTC';
  const todayStr = formatDateInTimeZone(referenceDate, groupTimeZone);
  const normalizedToday = normalizeDateString(todayStr);
  
  // Robust date extraction (handles String or Timestamp)
  let activityDateStr = '';
  if (group.dailyActivity?.date) {
    const rawDate = group.dailyActivity.date;
    const dateObj = typeof rawDate === 'string' ? null : parseTimestampToDate(rawDate);
    const dateStr = dateObj ? formatDateInTimeZone(dateObj, groupTimeZone) : String(rawDate);
    activityDateStr = normalizeDateString(dateStr);
  }
  
  const isStale = activityDateStr !== '' && activityDateStr < normalizedToday;

  const calculated = calculateUnityPercentage(group, messages, referenceDate);
  
  // If stale, we ignore the firestoreValue from yesterday, but we still respect today's 'calculated' value.
  // This is critical for groups with only new members (100% exempt).
  const firestoreValue = isStale ? 0 : (group.unityPercentage ?? 0);
  const finalPercentage = override !== undefined 
    ? override 
    : Math.max(calculated, firestoreValue);


  return {
    ...group,
    unityPercentage: finalPercentage
  };
};

/**
 * Calculates the date string (YYYY-MM-DD) for the auto-kick deadline.
 * If multiple groups have different thresholds, returns the earliest one.
 */
export const calculateNearestKickDate = (userData: UserData | null, userGroups: Group[]): string | null => {
  if (!userData || !userGroups || userGroups.length === 0) return null;

  const kickDates: number[] = [];
  
  userGroups.forEach(group => {
    // Priority: Group-specific member threshold > Group global member threshold > User default threshold > Fallback 3
    const threshold = (group.memberKickThresholds && group.memberKickThresholds[userData.uid]) || 
                     userData.kickThreshold || DEFAULT_KICK_THRESHOLD;
    
    const candidateTimestamps = [
      userData.lastPostAt,
      (group.lastNoteByUid === userData.uid ? group.lastNoteAt : null),
      group.memberJoinedAt?.[userData.uid]
    ];

    const dates = candidateTimestamps
      .map(t => t ? parseTimestampToDate(t) : null)
      .filter((d): d is Date => d !== null && !isNaN(d.getTime()));

    if (dates.length > 0) {
      const lastActiveDate = new Date(Math.max(...dates.map(d => d.getTime())));
      const kickDeadline = new Date(lastActiveDate);
      kickDeadline.setDate(kickDeadline.getDate() + threshold);
      kickDates.push(kickDeadline.getTime());
    }
  });

  if (kickDates.length === 0) return null;
  
  const earliestKickDate = new Date(Math.min(...kickDates));
  // Use YYYY-MM-DD format consistent with studiedDates
  return earliestKickDate.toLocaleDateString('sv-SE');
};

