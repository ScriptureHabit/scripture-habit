
import { Group } from '../types/chat';
import { calculateUnityPercentage } from './unity-utils';
import { formatDateInTimeZone, normalizeDateString } from './time-utils';

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
  
  const activityDateStr = group.dailyActivity?.date ? normalizeDateString(group.dailyActivity.date) : '';
  const isStale = activityDateStr !== normalizedToday;

  // Calculate current local percentage based on available dailyActivity
  const calculated = calculateUnityPercentage(group, [], referenceDate);
  
  // Apply priority logic
  const displayPercentage = override !== undefined 
    ? override 
    : (isStale ? 0 : (calculated > 0 ? calculated : (group.unityPercentage ?? 0)));

  return {
    ...group,
    unityPercentage: displayPercentage
  };
};
