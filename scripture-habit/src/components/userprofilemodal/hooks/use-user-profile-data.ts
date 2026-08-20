import { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { UserData } from '../../../types/user';
import { UserProfile } from '../../../types/chat';

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
                const snap = await getDoc(doc(db, 'users', initialUserId));
                if (active && snap.exists()) {
                    const data = { id: snap.id, uid: snap.id, ...snap.data() } as unknown as (UserData & Partial<UserProfile>);
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
