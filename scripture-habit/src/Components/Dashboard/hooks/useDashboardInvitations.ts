import { useState, useEffect } from 'react';
import { safeStorage } from '../../../Utils/storage';
import { Capacitor } from '@capacitor/core';
import { User } from 'firebase/auth';
import { UserData } from '../../../types/user';
import { toast } from 'react-toastify';

export const useDashboardInvitations = (
    user: User | null, 
    userData: UserData | null, 
    showWelcomeStory: boolean,
    setActiveGroupId: (id: string) => void,
    setSelectedView: (view: number) => void,
    t: (key: string) => string
) => {
    const [isJoiningInvite, setIsJoiningInvite] = useState<boolean>(false);

    useEffect(() => {
        const processPendingInvite = async () => {
            const inviteCode = safeStorage.get('pendingInviteCode');
            if (!inviteCode || !user || !userData || showWelcomeStory || isJoiningInvite) return;

            setIsJoiningInvite(true);
            console.log("Processing pending invite code:", inviteCode);

            try {
                const API_BASE = Capacitor.isNativePlatform() ? 'https://scripturehabit.app' : '';
                const idToken = await user.getIdToken();
                const resp = await fetch(`${API_BASE}/api/join-group`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${idToken}`
                    },
                    body: JSON.stringify({ inviteCode })
                });

                if (resp.ok) {
                    const result = await resp.json();
                    const joinedGroupId = result.groupId;
                    safeStorage.remove('pendingInviteCode');
                    
                    setTimeout(() => {
                        if (joinedGroupId) setActiveGroupId(joinedGroupId);
                        setSelectedView(2);
                        setIsJoiningInvite(false);
                        toast.success(`🎉 ${t('joinGroup.joiningFromInviteSuccess')}`);
                    }, 1000);
                } else {
                    const errText = await resp.text();
                    
                    if (errText.includes('already in this group')) {
                        console.log("User already in this group");
                    } else {
                        console.error("Failed to join via invite link:", errText);
                    }
                    safeStorage.remove('pendingInviteCode');
                    setIsJoiningInvite(false);
                }

            } catch (error) {
                console.error("Error processing pending invite:", error);
                safeStorage.remove('pendingInviteCode');
                setIsJoiningInvite(false);
            }
        };

        if (!showWelcomeStory && userData && user) {
            processPendingInvite();
        }
    }, [user, userData, showWelcomeStory, t]);

    return { isJoiningInvite };
};
