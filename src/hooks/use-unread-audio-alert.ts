import { useEffect, useRef } from 'react';
import { Group } from '../types/chat';
import { hasAnyGroupUnread } from '../utils/group-utils';
import { playUnreadNotificationSound, isSoundEnabled } from '../utils/audio-feedback';

const SESSION_ALERTED_KEY = 'sh_unread_audio_alerted_session';

/**
 * Hook to play a LINE-style "Pikon" sound alert when unread messages exist
 * on app startup (once per session) or when new unread messages arrive.
 */
export function useUnreadAudioAlert(
    userGroups: Group[],
    currentUserId?: string | null,
    isChatViewActive: boolean = false,
    activeGroupId?: string | null
): void {
    const prevHasUnreadRef = useRef<boolean | null>(null);
    const hasInitializedRef = useRef<boolean>(false);

    useEffect(() => {
        if (!currentUserId || !userGroups || userGroups.length === 0) {
            return;
        }

        const hasUnread = hasAnyGroupUnread(userGroups, currentUserId, activeGroupId, isChatViewActive);

        // 1. First evaluation on app launch / data load
        if (!hasInitializedRef.current) {
            hasInitializedRef.current = true;
            prevHasUnreadRef.current = hasUnread;

            if (hasUnread && isSoundEnabled()) {
                const alreadyAlertedInSession = typeof sessionStorage !== 'undefined' 
                    ? sessionStorage.getItem(SESSION_ALERTED_KEY) === 'true'
                    : false;

                if (!alreadyAlertedInSession) {
                    playUnreadNotificationSound();
                    if (typeof sessionStorage !== 'undefined') {
                        sessionStorage.setItem(SESSION_ALERTED_KEY, 'true');
                    }
                }
            }
            return;
        }

        // 2. Real-time transition: False -> True (new incoming unread message during active session)
        if (prevHasUnreadRef.current === false && hasUnread === true && isSoundEnabled()) {
            playUnreadNotificationSound();
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem(SESSION_ALERTED_KEY, 'true');
            }
        }

        prevHasUnreadRef.current = hasUnread;
    }, [userGroups, currentUserId, isChatViewActive, activeGroupId]);

    // Handle browser autoplay policy: if audio couldn't play on immediate load without interaction,
    // retry once on the first user interaction if there is an unread message pending.
    useEffect(() => {
        if (!currentUserId || typeof window === 'undefined') return;

        const handleFirstInteraction = () => {
            const hasUnread = hasAnyGroupUnread(userGroups, currentUserId, activeGroupId, isChatViewActive);
            const alreadyAlertedInSession = sessionStorage.getItem(SESSION_ALERTED_KEY) === 'true';

            if (hasUnread && !alreadyAlertedInSession && isSoundEnabled()) {
                playUnreadNotificationSound();
                sessionStorage.setItem(SESSION_ALERTED_KEY, 'true');
            }
        };

        window.addEventListener('pointerdown', handleFirstInteraction, { once: true });
        window.addEventListener('keydown', handleFirstInteraction, { once: true });

        return () => {
            window.removeEventListener('pointerdown', handleFirstInteraction);
            window.removeEventListener('keydown', handleFirstInteraction);
        };
    }, [userGroups, currentUserId, isChatViewActive, activeGroupId]);
}
