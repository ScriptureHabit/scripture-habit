import { useEffect, useRef, useCallback } from 'react';
import { auth, appCheck } from '../firebase';
import { getToken } from 'firebase/app-check';

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

        // Calculate "today" in the group's timezone
        const now = new Date();
        // Use Intl.DateTimeFormat to get a reliable YYYY-MM-DD string in the target timezone
        // 'en-CA' is a convenient locale that defaults to YYYY-MM-DD
        const todayStr = new Intl.DateTimeFormat('en-CA', {
            timeZone: groupTimeZone || 'UTC',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(now);

        // Skip if already checked today
        if (lastCheckedDateRef.current === todayStr) return;

        // Check if reset is needed (dailyActivity is from a different day)
        if (dailyActivityDate && dailyActivityDate !== todayStr) {
            console.log(`[UnityReset] Date change detected: ${dailyActivityDate} -> ${todayStr}, resetting...`);
            
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
                    } catch (e) {
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
                lastCheckedDateRef.current = todayStr;

            } catch (error) {
                console.error('[UnityReset] Error:', error);
            } finally {
                isResettingRef.current = false;
            }
        } else {
            // No reset needed, mark as checked
            lastCheckedDateRef.current = todayStr;
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
