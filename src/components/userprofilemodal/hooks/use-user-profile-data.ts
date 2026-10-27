import { useState, useEffect } from 'react';
import { UserData } from '../../../types/user';
import { UserProfile } from '../../../types/chat';
import apiClient from '../../../utils/api-client';

export const useUserProfileData = (user: UserData | UserProfile | null) => {
    const [fetchedData, setFetchedData] = useState<(UserData & Partial<UserProfile>) | null>(null);

    const initialUserId = user ? ((user as UserProfile).id || (user as UserData).uid) : '';

    useEffect(() => {
        if (!initialUserId || initialUserId === 'ai-partner-bot' || initialUserId.startsWith('bot-')) {
            return;
        }

        let active = true;
        const fetchProfile = async () => {
            try {
                const response = await apiClient.get<{ profile: UserData & Partial<UserProfile> }>(
                    `/api/auth/profile/${encodeURIComponent(initialUserId)}`
                );
                if (active && response.data.profile) {
                    const data = { id: initialUserId, ...response.data.profile };
                    setFetchedData(data);
                }
            } catch (e) {
                console.error('[useUserProfileData] Failed to fetch full user profile:', e);
            }
        };

        fetchProfile();

        return () => {
            active = false;
        };
    }, [initialUserId]);

    const currentUser = fetchedData && user ? { ...user, ...fetchedData } : (fetchedData || user);
    const userId = currentUser ? ((currentUser as UserProfile).id || (currentUser as UserData).uid) : initialUserId;

    return { currentUser, userId };
};
