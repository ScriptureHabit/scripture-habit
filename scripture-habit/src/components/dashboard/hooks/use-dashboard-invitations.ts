import { useState, useEffect } from 'react';
import { safeStorage } from '../../../utils/storage';
import { Capacitor } from '@capacitor/core';
import { User } from 'firebase/auth';
import { getToken } from 'firebase/app-check'; // Added AppCheck getToken
import { appCheck } from '../../../firebase'; // Removed unused auth
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
                let appCheckToken = '';
                if (appCheck) {
                    const appCheckTokenResponse = await getToken(appCheck!, false); // Get AppCheck token
                    appCheckToken = appCheckTokenResponse.token;
                }

                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                };
                if (appCheckToken) {
                    headers['X-Firebase-AppCheck'] = appCheckToken;
                }

                const resp = await fetch(`${API_BASE}/api/groups/join-group`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ inviteCode })
                });

                if (resp.ok) {
                    const result = await resp.json();
                    const joinedGroupId = result.gid || result.groupId; // Fallback just in case
                    console.log("[DashboardInvite] Join successful, gid:", joinedGroupId);
                    safeStorage.remove('pendingInviteCode');
                    
                    // Use a slightly shorter delay and ensure we set states correctly
                    setTimeout(() => {
                        if (joinedGroupId) {
                            console.log("[DashboardInvite] Setting active group:", joinedGroupId);
                            setActiveGroupId(joinedGroupId);
                        }
                        setSelectedView(2);
                        setIsJoiningInvite(false);
                        toast.success(`🎉 ${t('joinGroup.joiningFromInviteSuccess')}`);
                    }, 500);
                } else {
                    const errText = await resp.text();
                    console.error("[DashboardInvite] Join failed with status:", resp.status, errText);
                    
                    if (errText.includes('already in this group')) {
                        console.log("[DashboardInvite] User already in this group");
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
    }, [user, userData, showWelcomeStory, t, isJoiningInvite, setActiveGroupId, setSelectedView]);

    return { isJoiningInvite };
};
