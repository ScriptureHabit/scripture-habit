import { useState, useEffect, useRef } from 'react';
import { safeStorage } from '../../../utils/storage';
import { requestNotificationPermission } from '../../../utils/notificationHelper';
import { UserData } from '../../../types/user';
import { Group } from '../../../types/chat';
import { parseTimestampToMillis } from '../../../utils/timeUtils';

interface NotificationInfo {
  type: 'note' | 'message';
  nickname: string;
  time: number;
  groupId: string;
  groupName: string;
  totalMessages: number;
}

export const useDashboardNotifications = (
    userData: UserData | null, 
    userGroups: Group[], 
    selectedView: number, 
    loading: boolean, 
    showWelcomeStory: boolean, 
    showAutoKickModal: boolean, 
    isJoiningInvite: boolean,
    loadingGroupStates: boolean,
    activeGroupId: string | null,
    t: (key: string) => string
) => {
    const [latestNoteNotification, setLatestNoteNotification] = useState<NotificationInfo | null>(null);
    const [showNotifPrompt, setShowNotifPrompt] = useState<boolean>(false);
    
    // Persistence refs for the notification latch
    const lastNotifIdRef = useRef<string | null>(null);
    const lastNotifVisibleAtRef = useRef<number>(0);

    useEffect(() => {
        if (selectedView === 0 && !loading && userData && !showWelcomeStory && !showAutoKickModal && !isJoiningInvite) {
            const timer = setTimeout(() => {
                const isPermissionDefault = 'Notification' in window && window.Notification.permission === 'default';
                const lastPrompt = safeStorage.get('lastNotifPrompt');
                const now = Date.now();
                const oneWeek = 7 * 24 * 60 * 60 * 1000;

                if (isPermissionDefault && (!lastPrompt || now - parseInt(lastPrompt) > oneWeek)) {
                    setShowNotifPrompt(true);
                }
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [selectedView, loading, userData, showWelcomeStory, showAutoKickModal, isJoiningInvite]);

    const handleEnableNotifications = async () => {
        setShowNotifPrompt(false);
        safeStorage.set('lastNotifPrompt', Date.now().toString());
        if (userData?.uid) {
            await requestNotificationPermission(userData.uid, (key: string, defaultText: string) => t(key) || defaultText);
        }
    };

    const handleCloseNotifPrompt = () => {
        setShowNotifPrompt(false);
        safeStorage.set('lastNotifPrompt', Date.now().toString());
    };

    // Recent notes/messages notification logic
    useEffect(() => {
        if (!userGroups || userGroups.length === 0 || !userData || loadingGroupStates) return;

        const now = Date.now();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTime = today.getTime();

        let mostRecent: NotificationInfo | null = null;

        userGroups.forEach(group => {
            // Only suppress notifications if we are CURRENTLY looking at the chat for this group
            if (group.id === activeGroupId && selectedView === 2) {
                console.log(`[DashboardNotifications] Skipping active group chat: ${group.name} (${group.id}). Current View: ${selectedView}`);
                return;
            }

            const noteTime = parseTimestampToMillis(group.lastNoteAt);
            const messageTime = parseTimestampToMillis(group.lastMessageAt);

            let currentType: 'note' | 'message' | '' = '';
            let currentTime = 0;
            let currentUid = '';

            if (noteTime >= messageTime && noteTime > 0) {
                currentType = 'note';
                currentTime = noteTime;
                currentUid = group.lastNoteByUid || '';
            } else if (messageTime > noteTime && messageTime > 0) {
                currentType = 'message';
                currentTime = messageTime;
                currentUid = group.lastMessageByUid || '';
            }

            if (currentTime > 0 && currentUid !== userData.uid) {
                const isNewToday = currentTime >= todayTime;
                const hasUnreads = (group.unreadCount || 0) > 0;

                if (isNewToday && hasUnreads) {
                    if (!mostRecent || currentTime > mostRecent.time) {
                    const info: NotificationInfo = {
                        type: currentType as 'note' | 'message',
                        nickname: (currentType === 'note' ? group.lastNoteByNickname : group.lastMessageByNickname) || 'Someone',
                        time: currentTime,
                        groupId: group.id,
                        groupName: group.name || 'Group',
                        totalMessages: group.messageCount || 0
                    };
                    mostRecent = info;
                    }
                }
            }
        });

        // LATCH LOGIC: Do not clear notification if it was shown recently, unless a NEWER one comes.
        const currentMostRecent = mostRecent as NotificationInfo | null;
        const notifId = currentMostRecent ? `${currentMostRecent.groupId}-${currentMostRecent.time}` : null;
        
        const timeSinceShown = now - lastNotifVisibleAtRef.current;
        const isCurrentNotifOld = timeSinceShown > 15000; // 15 seconds stay-time

        if (mostRecent) {
            if (notifId !== lastNotifIdRef.current) {
                console.log("[DashboardNotifications] Set Most Recent Notification:", mostRecent);
                lastNotifIdRef.current = notifId;
                lastNotifVisibleAtRef.current = now;
                setLatestNoteNotification(mostRecent);
            }
        } else if (latestNoteNotification && isCurrentNotifOld) {
            console.log("[DashboardNotifications] Clearing Most Recent Notification after timeout.");
            setLatestNoteNotification(null);
            lastNotifIdRef.current = null;
        } else if (latestNoteNotification && !isCurrentNotifOld) {
            // BUG SHIELD: If it's not old yet, but unread count is 0 (mostRecent is null), 
            // we MUST set a timer to re-evaluate after the remaining time.
            const remainingTime = 15500 - timeSinceShown; // Extra 500ms safety
            const timer = setTimeout(() => {
                // This will trigger a re-render if we toggle a dummy state, 
                // but better: just let it wait for the next natural sync or 
                // we can force a clear by calling the setter directly.
                setLatestNoteNotification(prev => {
                    const elapsed = Date.now() - lastNotifVisibleAtRef.current;
                    if (elapsed >= 15000) return null;
                    return prev;
                });
            }, remainingTime);
            return () => clearTimeout(timer);
        }
    }, [userGroups, userData?.uid, loadingGroupStates, activeGroupId, selectedView]);

    return { 
        latestNoteNotification,
        setLatestNoteNotification,
        showNotifPrompt, 
        setShowNotifPrompt, 
        handleEnableNotifications, 
        handleCloseNotifPrompt 
    };
};
