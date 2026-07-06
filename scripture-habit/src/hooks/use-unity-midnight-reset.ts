import { useEffect, useRef, useCallback } from 'react';
import { auth } from '../firebase';
import apiClient from '../utils/api-client';
import { formatDateInTimeZone, normalizeDateString, parseTimestampToDate } from '../utils/time-utils';

interface UseUnityMidnightResetProps {
    groupId: string | null;
    groupTimeZone: string;
    dailyActivityDate: string | null;
    onReset?: () => void;
}

/**
 * Hook to detect midnight and reset unity percentage
 * Polls every minute to check if date has changed in group's timezone
 */
export const useUnityMidnightReset = ({
    groupId,
    groupTimeZone,
    dailyActivityDate,
    onReset
}: UseUnityMidnightResetProps) => {
    const lastCheckedDateRef = useRef<string | null>(null);
    const isResettingRef = useRef(false);

    const checkAndReset = useCallback(async () => {
        if (!groupId || isResettingRef.current) return;

        // Calculate "today" in the group's timezone robustly
        const now = new Date();
        const todayStr = formatDateInTimeZone(now, groupTimeZone || 'UTC');
        const normalizedToday = normalizeDateString(todayStr);

        // Skip if already checked today
        if (lastCheckedDateRef.current === normalizedToday) return;

        // Check if reset is needed (dailyActivity is from a different day)
        let normalizedActivityDate = null;
        if (dailyActivityDate) {
            const rawDate = dailyActivityDate;
            const dateObj = typeof rawDate === 'string' ? null : parseTimestampToDate(rawDate as { seconds: number; nanoseconds: number });
            const dateStr = dateObj ? formatDateInTimeZone(dateObj, groupTimeZone) : String(rawDate);
            normalizedActivityDate = normalizeDateString(dateStr);
        }
        
        if (normalizedActivityDate && normalizedActivityDate !== normalizedToday) {
            isResettingRef.current = true;
            
            try {
                if (!auth || !auth.currentUser) {
                    console.warn('[UnityReset] No authenticated user');
                    return;
                }

                const response = await apiClient.post('/api/groups/reset-unity-if-midnight', { groupId });
                const result = response.data;

                if (result.reset) {
                    // Notify parent component to refresh data
                    onReset?.();
                }

                // Mark as checked for today
                lastCheckedDateRef.current = normalizedToday;

            } catch (error) {
                console.error('[UnityReset] Error:', error);
            } finally {
                isResettingRef.current = false;
            }
        } else {
            // No reset needed, mark as checked
            lastCheckedDateRef.current = normalizedToday;
        }
    }, [groupId, groupTimeZone, dailyActivityDate, onReset]);

    useEffect(() => {
        // Check immediately on mount
        checkAndReset();

        // Then check every minute
        const interval = setInterval(checkAndReset, 60000);

        // Also check when window regains focus (user returns to app)
        const handleFocus = () => {
            checkAndReset();
        };
        window.addEventListener('focus', handleFocus);

        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', handleFocus);
        };
    }, [checkAndReset]);
};
