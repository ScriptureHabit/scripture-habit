
import { Group } from '../types/chat';
import { calculateUnityPercentage } from './unity-utils';

/**
 * Enriches a group object with the correct display unity percentage,
 * applying overrides and falling back to Firestore values when necessary.
 * 
 * Logic Priority:
 * 1. Override (Active chat session updates)
 * 2. Calculated (Live client-side calculation from dailyActivity/messages if > 0)
 * 3. Firestore (The pre-calculated value from the backend - fallback for mismatches)
 */
export const enrichGroupUnity = (
  group: Group,
  override?: number,
  referenceDate: Date = new Date()
): Group => {
  // Calculate current local percentage based on available dailyActivity
  const calculated = calculateUnityPercentage(group, [], referenceDate);
  
  // Apply priority logic
  const displayPercentage = override !== undefined 
    ? override 
    : (calculated > 0 ? calculated : (group.unityPercentage ?? 0));

  return {
    ...group,
    unityPercentage: displayPercentage
  };
};
