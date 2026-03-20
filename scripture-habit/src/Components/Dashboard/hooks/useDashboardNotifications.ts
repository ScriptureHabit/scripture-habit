import { useState, useEffect } from 'react';
import { safeStorage } from '../../../Utils/storage';
import { requestNotificationPermission } from '../../../Utils/notificationHelper';
import { UserData } from '../../../types/user';
import { Group } from '../../../types/chat';

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
    t: (key: string) => string
) => {
    const [latestNoteNotification, setLatestNoteNotification] = useState<NotificationInfo | null>(null);
    const [showNotifPrompt, setShowNotifPrompt] = useState<boolean>(false);

    useEffect(() => {
        if (selectedView === 0 && !loading && userData && !showWelcomeStory && !showAutoKickModal && !isJoiningInvite) {
            const timer = setTimeout(() => {
                const isPermissionDefault = (window as any).Notification && (window as any).Notification.permission === 'default';
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
            const noteTime = group.lastNoteAt ? (group.lastNoteAt.toMillis ? group.lastNoteAt.toMillis() : (group.lastNoteAt.seconds * 1000)) : 0;
            const messageTime = group.lastMessageAt ? (group.lastMessageAt.toMillis ? group.lastMessageAt.toMillis() : (group.lastMessageAt.seconds * 1000)) : 0;

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
    }, [userGroups, userData?.uid, loadingGroupStates]);

    return { 
        latestNoteNotification,
        setLatestNoteNotification,
        showNotifPrompt, 
        setShowNotifPrompt, 
        handleEnableNotifications, 
        handleCloseNotifPrompt 
    };
};
