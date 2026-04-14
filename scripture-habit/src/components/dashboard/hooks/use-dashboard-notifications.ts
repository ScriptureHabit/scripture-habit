import { useState, useEffect } from 'react';
import { safeStorage } from '../../../utils/storage';
import { requestNotificationPermission } from '../../../utils/notificationHelper';
import { UserData } from '../../../types/user';

export const useDashboardNotifications = (
    userData: UserData | null, 
    t: (key: string) => string
) => {
    const [showNotifPrompt, setShowNotifPrompt] = useState<boolean>(false);
    
    useEffect(() => {
        if (!userData || !userData.uid) return;

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
