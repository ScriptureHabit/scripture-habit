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
  
  const isStale = activityDateStr !== '' && activityDateStr < normalizedToday;

  const calculated = calculateUnityPercentage(group, [], referenceDate);
  const firestoreValue = isStale ? 0 : (group.unityPercentage ?? 0);
  const finalPercentage = override !== undefined 
    ? override 
    : (isStale ? 0 : Math.max(calculated, firestoreValue));

  if (group.name?.includes('Persistence')) {
    console.log(`[enrichGroupUnity] ${group.name}: override=${override}, calculated=${calculated}, firestoreValue=${firestoreValue}, final=${finalPercentage}%`);
  }

  return {
    ...group,
    unityPercentage: finalPercentage
  };
};
