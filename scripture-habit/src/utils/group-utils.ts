import { Group } from '../types/chat';
import { calculateUnityPercentage } from './unity-utils';
import { formatDateInTimeZone, normalizeDateString, parseTimestampToDate } from './time-utils';

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
  
  // Resilient check: only mark as stale if the activity date is strictly OLDER than today.
  // This prevents premature 0% resets due to minor clock drift or timezone misalignments.
  const isStale = activityDateStr !== '' && activityDateStr < normalizedToday;

  // Calculate current local percentage based on available dailyActivity
  const calculated = calculateUnityPercentage(group, [], referenceDate);
  
  // Logic:
  // 1. If we have an override (user just posted in this session), use it.
  // 2. If the data is from a previous day (stale), force 0% for the midnight reset.
  // 3. If we calculated a non-zero value for today, use it (most up-to-date).
  // 4. Otherwise, trust the value persisted in Firestore (best fallback for metadata-only views).
  const displayPercentage = override !== undefined 
    ? override 
    : (isStale ? 0 : (calculated > 0 ? calculated : (group.unityPercentage ?? 0)));

  return {
    ...group,
    unityPercentage: displayPercentage
  };
};
