import { useState, useEffect } from 'react';
import { safeStorage } from '../../../utils/storage';
import { requestNotificationPermission } from '../../../utils/notification-helper';
import { UserData } from '../../../types/user';
import { auth } from '../../../firebase';

export const useDashboardNotifications = (
    userData: UserData | null, 
    t: (key: string) => string
) => {
    const [showNotifPrompt, setShowNotifPrompt] = useState<boolean>(false);
    
    useEffect(() => {
        if (!userData || !userData.uid) return;

        // Skip notification prompt for demo sandbox users
        const isDemo = userData.isAnonymousDemo || (auth && auth.currentUser?.isAnonymous);
        if (isDemo) return;

        // Only show notification prompt AFTER onboarding quest is completed
        const isLegacyCompleted = !userData.questCreatedGroup && !userData.questPostedNote && 
            (userData.totalNotes && userData.totalNotes > 0) && 
            ((userData.groupIds && userData.groupIds.length > 0) || !!userData.groupId);
        const isOnboardingCompleted = !!userData.hasCompletedOnboarding || isLegacyCompleted;

        if (!isOnboardingCompleted) {
            return;
        }

        const timer = setTimeout(() => {
            const isPermissionDefault = 'Notification' in window && window.Notification.permission === 'default';
            const lastPrompt = safeStorage.get('lastNotifPrompt');
            const now = Date.now();
            const oneWeek = 7 * 24 * 60 * 60 * 1000;

            if (isPermissionDefault && (!lastPrompt || now - parseInt(lastPrompt) > oneWeek)) {
                setShowNotifPrompt(true);
            }
        }, 3000);
        return () => clearTimeout(timer);
    }, [userData]);

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

    return { 
        showNotifPrompt, 
        setShowNotifPrompt, 
        handleEnableNotifications, 
        handleCloseNotifPrompt 
    };
};
