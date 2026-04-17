import { useEffect, useRef, useCallback } from 'react';
import { auth, appCheck } from '../firebase';
import { getToken } from 'firebase/app-check';
import { formatDateInTimeZone, normalizeDateString } from '../utils/time-utils';

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
        const normalizedActivityDate = dailyActivityDate ? normalizeDateString(dailyActivityDate) : null;
        
        if (normalizedActivityDate && normalizedActivityDate !== normalizedToday) {
            console.log(`[UnityReset] Date change detected: ${normalizedActivityDate} -> ${normalizedToday}, resetting...`);
            
            isResettingRef.current = true;
            
            try {
                if (!auth || !auth.currentUser) {
                    console.warn('[UnityReset] No authenticated user');
                    return;
                }
                const currentUser = auth.currentUser;

                const idToken = await currentUser.getIdToken();
                
                // Get App Check token if available
                let appCheckToken = '';
                if (appCheck) {
                    try {
                        const tokenResponse = await getToken(appCheck, false);
                        appCheckToken = tokenResponse.token;
                    } catch {
                        // App Check might fail in development, continue without it
                        console.log('[UnityReset] App Check token not available');
                    }
                }

                const API_BASE = window.location.hostname === 'localhost' ? '' : 'https://scripturehabit.app';
                
                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                };
                
                if (appCheckToken) {
                    headers['X-Firebase-AppCheck'] = appCheckToken;
                }

                const response = await fetch(`${API_BASE}/api/reset-unity-if-midnight`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ groupId })
                });

                if (!response.ok) {
                    const error = await response.text();
                    console.error('[UnityReset] API error:', error);
                    return;
                }

                const result = await response.json();
                console.log('[UnityReset] Result:', result);

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
