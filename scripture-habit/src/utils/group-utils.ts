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
  
  // Resilient check: only mark as stale if the activity date is strictly OLDER than today.
  // This prevents premature 0% resets due to minor clock drift or timezone misalignments.
  const isStale = activityDateStr !== '' && activityDateStr < normalizedToday;

  // Calculate current local percentage based on available dailyActivity
  const calculated = calculateUnityPercentage(group, [], referenceDate);
  
  // Debug logging for mismatch investigation
  if (calculated === 0 && (group.unityPercentage ?? 0) > 0 && !isStale) {
    // This case means we have a persisted percentage but no active members found in dailyActivity
    // This can happen if dailyActivity.activeMembers is missing or empty but unityPercentage was saved.
    // In this case, we trust the persisted percentage.
  }

  if (isStale && (group.unityPercentage ?? 0) > 0) {
    console.log(`[enrichGroupUnity] Marking as stale: activityDate=${activityDateStr}, today=${normalizedToday}, group=${group.id}`);
  }

  const displayPercentage = override !== undefined 
    ? override 
    : (isStale ? 0 : (calculated > 0 ? calculated : (group.unityPercentage ?? 0)));

  if (group.name.includes('Unity Test')) {
    console.log(`[enrichGroupUnity] Group: ${group.name}, id: ${group.id}`);
    console.log(`  Today: ${normalizedToday} (${todayStr})`);
    console.log(`  ActivityDate: ${activityDateStr}`);
    console.log(`  isStale: ${isStale}`);
    console.log(`  calculated: ${calculated}`);
    console.log(`  storedUnity: ${group.unityPercentage}`);
    console.log(`  display: ${displayPercentage}`);
  }

  return {
    ...group,
    unityPercentage: displayPercentage
  };
};
