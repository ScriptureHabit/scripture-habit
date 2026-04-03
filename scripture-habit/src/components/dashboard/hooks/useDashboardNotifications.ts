import { useState, useEffect } from 'react';
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

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTime = today.getTime();

        let mostRecent: NotificationInfo | null = null;

        userGroups.forEach(group => {
            if (group.id === activeGroupId) return;

            const noteTime = parseTimestampToMillis(group.lastNoteAt);
            const messageTime = parseTimestampToMillis(group.lastMessageAt);

            let currentType: 'note' | 'message' | '' = '';
            let currentTime = 0;
            let currentNickname = '';
            let currentUid = '';

            if (noteTime >= messageTime && noteTime > 0) {
                currentType = 'note';
                currentTime = noteTime;
                currentNickname = group.lastNoteByNickname || '';
                currentUid = group.lastNoteByUid || '';
            } else if (messageTime > noteTime && messageTime > 0) {
                currentType = 'message';
                currentTime = messageTime;
                currentNickname = group.lastMessageByNickname || '';
                currentUid = group.lastMessageByUid || '';
            }

            if (currentTime > 0 && currentUid !== userData.uid) {
                if (currentTime >= todayTime && (group.unreadCount || 0) > 0) {
                    if (!mostRecent || currentTime > mostRecent.time) {
                        mostRecent = {
                            type: currentType as 'note' | 'message',
                            nickname: currentNickname || 'Someone',
                            time: currentTime,
                            groupId: group.id,
                            groupName: group.name || '',
                            totalMessages: group.messageCount || 0
                        };
                    }
                }
            }
        });

        setLatestNoteNotification(mostRecent);
    }, [userGroups, userData?.uid, loadingGroupStates, activeGroupId]);

    return { 
        latestNoteNotification,
        setLatestNoteNotification,
        showNotifPrompt, 
        setShowNotifPrompt, 
        handleEnableNotifications, 
        handleCloseNotifPrompt 
    };
};
