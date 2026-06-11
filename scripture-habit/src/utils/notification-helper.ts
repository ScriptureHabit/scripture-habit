import { messaging, db } from '../firebase';
import { getToken, onMessage, deleteToken, MessagePayload } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion, arrayRemove, setDoc, getDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';

// VAPID Key from Firebase Console (Messaging -> Web Push certificates)
const VAPID_KEY = "BM2Y3WcLC7cH5CHND3nzDh2eoNvsIxc7X2aRTaQj0TXENvee9klPqLrJvb8x2DfQ-yMgMHlXMhkal0tt6czIaKM";

const isInAppBrowser = (): boolean => {
    const ua = window.navigator.userAgent || window.navigator.vendor || (window as unknown as { opera?: string }).opera || '';
    return (ua.indexOf('FBAN') > -1) || (ua.indexOf('FBAV') > -1) || // Facebook

        (ua.indexOf('Instagram') > -1) || // Instagram
        (ua.indexOf('Line') > -1) || // LINE
        (ua.indexOf('Twitter') > -1) || // Twitter
        (ua.indexOf('Telegram') > -1); // Telegram
};

export const requestNotificationPermission = async (
    userId: string | null | undefined, 
    t: (key: string, defaultText: string) => string
): Promise<string | null | undefined> => {
    // Fallback helper if t is not provided (though it should be)
    const translate = (key: string, defaultText: string) => (t ? t(key, defaultText) : defaultText);

    // 1. Check basic support
    if (!('serviceWorker' in navigator) || !('Notification' in window) || !('PushManager' in window)) {
        console.warn('Push notifications are not supported in this browser.');
        toast.warn(translate('notificationSetup.notSupported', 'Your browser does not support notification features. Please try with the latest Chrome or Safari.'));
        return;
    }

    // 2. Check for In-App Browsers
    if (isInAppBrowser()) {
        console.warn('Push notifications often fail in In-App Browsers.');
        toast.info(translate('notificationSetup.inAppBrowserWarning', 'Notifications may not work in app-specific browsers. Please reopen in a standard browser (Chrome or Safari) using the button at the bottom right.'));
    }

    try {
        // 3. Request Permission
        console.log('Requesting notification permission...');
        const permission = await Notification.requestPermission();

        if (permission === 'granted') {
            console.log('Notification permission granted.');

            try {
                // 4. Register or Get Service Worker
                let registration: ServiceWorkerRegistration;

                const existingRegs = await navigator.serviceWorker.getRegistrations();
                const ourReg = existingRegs.find(r => r.scope.includes(window.location.host));

                if (ourReg) {
                    console.log('Using existing SW registration:', ourReg.scope);
                    registration = ourReg;
                    await registration.update();
                } else {
                    console.log('Registering new Service Worker...');
                    registration = await navigator.serviceWorker.register('/sw.js', {
                        scope: '/'
                    });
                }

                // Wait for it to be ready
                await navigator.serviceWorker.ready;
                console.log('SW Registration ready:', registration);

                // 5. Check if active
                if (!registration.active && !registration.installing && !registration.waiting) {
                    console.error('Service worker registration failed to find an active worker.');
                    throw new Error('Service Worker not active after registration');
                }

                // 6. Get FCM token
                if (!messaging) {
                    console.warn('Messaging is not initialized. Skipping token generation.');
                    return null;
                }

                const token = await getToken(messaging, {
                    vapidKey: VAPID_KEY,
                    serviceWorkerRegistration: registration
                });

                if (token) {
                    console.log('FCM Token successfully obtained:', token);
                    if (userId) {
                        const privateRef = doc(db, 'users', userId, 'private', 'tokens');
                        await setDoc(privateRef, {
                            fcmTokens: arrayUnion(token)
                        }, { merge: true });
                        
                        // Secure existing users by removing from public doc, and set the query flag
                        try {
                           const userRef = doc(db, 'users', userId);
                           await updateDoc(userRef, {
                               fcmTokens: arrayRemove(token),
                               hasFcmToken: true
                           });
                        } catch {
                           // Ignore if field doesn't exist
                        }
                    }
                    toast.success(translate('notificationSetup.success', 'Notification settings complete! 🎉'));
                    return token;
                } else {
                    console.log('No FCM token received.');
                    throw new Error('No registration token available');
                }
            } catch (innerError: unknown) {
                console.error('Detailed error during SW/Token process:', innerError);

                const err = innerError as Error & { name?: string, code?: string };

                // Specific messaging for known errors
                let userFriendlyMsg = translate('notificationSetup.generalError', 'An error occurred while setting up notifications.');
                if (err.name === 'NotAllowedError') {
                    userFriendlyMsg = translate('notificationSetup.swRegistrationDenied', 'Service worker registration was denied by browser settings. Please disable Incognito/Private mode or check your settings.');
                } else if (err.code === 'messaging/permission-blocked') {
                    userFriendlyMsg = translate('notificationSetup.permissionBlocked', 'Notification permission is blocked. Please allow it in your browser settings.');
                }

                toast.error(userFriendlyMsg);
                throw innerError;
            }
        } else if (permission === 'denied') {
            console.warn('Notification permission denied by user.');
            toast.info(translate('notificationSetup.permissionDenied', 'Notifications are blocked. Please enable them in your browser settings (icon to the left of the URL).'));
        }
    } catch (error: unknown) {
        console.error('An error occurred during notification setup flow:', error);
        const err = error as Error & { name?: string };

        if (err.name === 'NotAllowedError') {
            toast.error(translate('notificationSetup.notAllowedError', 'Notification settings are restricted in your browser (possibly due to Incognito mode or settings).'));
        } else {
            toast.error(translate('notificationSetup.setupFailed', 'Notification setup failed. Please try again later.'));
        }
    }
    return null;
};


export const setupMessageListener = (callback: (payload: MessagePayload) => void): (() => void) | undefined => {
    if (!messaging) return undefined;
    return onMessage(messaging, callback);
};

export const disableNotifications = async (userId: string | null | undefined): Promise<boolean> => {
    try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && messaging) {
            const token = await getToken(messaging, {
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: registration
            });
            if (token && userId) {
                const privateRef = doc(db, 'users', userId, 'private', 'tokens');
                try {
                    await setDoc(privateRef, {
                        fcmTokens: arrayRemove(token)
                    }, { merge: true });
                    
                    const userRef = doc(db, 'users', userId);
                    await updateDoc(userRef, {
                        fcmTokens: arrayRemove(token),
                        hasFcmToken: false
                    });
                } catch {
                    // Ignore if field cleanup fails
                }
            }
        }
        // Also try to delete the token from local storage/FCM
        if (messaging) {
            await deleteToken(messaging);
        }
        return true;
    } catch (error: unknown) {
        console.error('Error disabling notifications:', error);
        return false;
    }
};

/**
 * Checks if the user has an FCM token and updates the hasFcmToken flag
 * if it's currently missing or false. Used for backward compatibility/healing.
 */
export const syncFcmTokenFlag = async (userId: string | null | undefined, currentFlagStatus?: boolean): Promise<void> => {
    if (!userId) return;
    if (!('serviceWorker' in navigator) || !('Notification' in window) || !('PushManager' in window)) return;
    
    // Only proceed if permission is already granted natively
    if (Notification.permission === 'granted') {
        try {
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration && messaging) {
                const token = await getToken(messaging, {
                    vapidKey: VAPID_KEY,
                    serviceWorkerRegistration: registration
                });
                
                if (token) {
                    // Verify if this token is actually registered in the database
                    const privateRef = doc(db, 'users', userId, 'private', 'tokens');
                    const privateSnap = await getDoc(privateRef);
                    const existingTokens: string[] = privateSnap.exists() ? (privateSnap.data()?.fcmTokens || []) : [];
                    
                    const isTokenRegistered = existingTokens.includes(token);
                    
                    if (!isTokenRegistered || currentFlagStatus !== true) {
                        console.log('[NotificationHelper] Token not registered or flag mismatch. Syncing...');
                        
                        await setDoc(privateRef, {
                            fcmTokens: arrayUnion(token)
                        }, { merge: true });
                        
                        const userRef = doc(db, 'users', userId);
                        await updateDoc(userRef, {
                            hasFcmToken: true
                        });
                        console.log('[NotificationHelper] Successfully healed missing/expired FCM token flag and registered token for user.');
                    }
                }
            }
        } catch (e) {
            console.warn('[NotificationHelper] Failed to sync FCM token flag', e);
        }
    }
};

/**
 * Clears all existing push notifications displayed by the service worker.
 */
export const clearAllNotifications = async (): Promise<void> => {
    if (!('serviceWorker' in navigator)) return;
    try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
            const notifications = await registration.getNotifications();
            let clearedCount = 0;
            notifications.forEach(notification => {
                // Only clear streak reminders, leaving group messages and other important notifications intact
                if (notification.data?.type === 'streak_reminder') {
                    notification.close();
                    clearedCount++;
                }
            });
            if (clearedCount > 0) {
                console.log(`[NotificationHelper] Cleared ${clearedCount} streak notifications upon app launch.`);
            }
        }
    } catch (e) {
        console.warn('[NotificationHelper] Failed to clear notifications', e);
    }
};

/**
 * Clears all existing push notifications for a specific group.
 * Useful when the user opens the group manually.
 */
export const clearGroupNotifications = async (groupId: string): Promise<void> => {
    if (!('serviceWorker' in navigator)) return;
    if (!groupId) return;
    try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
            const notifications = await registration.getNotifications();
            let clearedCount = 0;
            notifications.forEach(notification => {
                // Clear group messages that match the opened group
                if (notification.data?.groupId === groupId) {
                    notification.close();
                    clearedCount++;
                }
            });
            if (clearedCount > 0) {
                console.log(`[NotificationHelper] Cleared ${clearedCount} notifications for group ${groupId}.`);
            }
        }
    } catch (e) {
        console.warn(`[NotificationHelper] Failed to clear notifications for group ${groupId}`, e);
    }
};

