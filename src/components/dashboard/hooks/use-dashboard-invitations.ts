import { useState, useEffect, useRef } from 'react';
import { safeStorage } from '../../../utils/storage';

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
    t: (key: string) => string,
    onJoinSuccess?: (groupId: string, groupName: string) => void
) => {
    const [isJoiningInvite, setIsJoiningInvite] = useState<boolean>(false);
    const isProcessingRef = useRef<boolean>(false);

    useEffect(() => {
        const processPendingInvite = async () => {
            const inviteCode = safeStorage.get('pendingInviteCode');
            if (!inviteCode || !user || !userData || showWelcomeStory || isJoiningInvite || isProcessingRef.current) return;

            isProcessingRef.current = true;
            setIsJoiningInvite(true);
            console.log("Processing pending invite code:", inviteCode);

            try {
                const API_BASE = '';
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
                    const joinedOwnerName = result.ownerName || 'Owner';
                    const joinedGroupName = result.groupName || 'Group';
                    console.log("[DashboardInvite] Join successful, gid:", joinedGroupId, "owner:", joinedOwnerName, "groupName:", joinedGroupName);
                    safeStorage.remove('pendingInviteCode');
                    
                    // Use a slightly shorter delay and ensure we set states correctly
                    setTimeout(() => {
                        if (joinedGroupId) {
                            console.log("[DashboardInvite] Setting active group:", joinedGroupId);
                            setActiveGroupId(joinedGroupId);
                        }
                        setSelectedView(2);
                        isProcessingRef.current = false;
                        setIsJoiningInvite(false);
                        toast.success(`🎉 ${t('joinGroup.joiningFromInviteSuccess')}`);
                        if (onJoinSuccess) {
                            onJoinSuccess(joinedGroupId || '', joinedGroupName);
                        }
                    }, 500);
                } else {
                    const errorData = await resp.json().catch(() => null);
                    const errorCode = errorData?.code;
                    const errorMsg = errorData?.error || '';
                    console.error("[DashboardInvite] Join failed with status:", resp.status, errorCode, errorMsg);
                    
                    if (errorCode === 'ALREADY_MEMBER' || errorMsg.includes('already a member') || errorMsg.includes('already in this group')) {
                        toast.info(t('apiErrors.ALREADY_MEMBER'));
                    } else if (errorCode === 'EXPIRED_INVITE_LINK' || resp.status === 410) {
                        toast.error(t('apiErrors.EXPIRED_INVITE_LINK'));
                    } else if (errorCode === 'INVALID_INVITE_CODE') {
                        toast.error(t('apiErrors.INVALID_INVITE_CODE'));
                    } else if (errorCode === 'GROUP_FULL') {
                        toast.error(t('apiErrors.GROUP_FULL'));
                    } else if (errorCode === 'MAX_GROUPS_LIMIT') {
                        toast.error(t('apiErrors.MAX_GROUPS_LIMIT'));
                    } else {
                        toast.error(t('joinGroup.errorJoinFailed'));
                    }

                    safeStorage.remove('pendingInviteCode');
                    isProcessingRef.current = false;
                    setIsJoiningInvite(false);
                }

            } catch (error) {
                console.error("Error processing pending invite:", error);
                toast.error(t('joinGroup.errorJoinFailed'));
                safeStorage.remove('pendingInviteCode');
                isProcessingRef.current = false;
                setIsJoiningInvite(false);
            }
        };

        if (!showWelcomeStory && userData && user) {
            processPendingInvite();
        }
    }, [user, userData, showWelcomeStory, t, isJoiningInvite, setActiveGroupId, setSelectedView, onJoinSuccess]);

    return { isJoiningInvite };
};
