import { useState, useEffect } from 'react';
import apiClient from '../../../utils/api-client';
import { toast } from 'react-toastify';
import { UserData } from '../../../types/user';
import { DEFAULT_KICK_THRESHOLD } from '../../../constants';
import { UpdateKickThresholdRequest, UpdateKickThresholdResponse } from '../../../../api_internal/lib/schemas';
import { auth } from '../../../firebase';

export function shouldShowAutoKickModal(
    userData: UserData | null,
    loading: boolean,
    isJoiningInvite: boolean
): boolean {
    if (loading || !userData || !userData.uid) return false;
    const isDemo = userData.isAnonymousDemo || (auth && auth.currentUser?.isAnonymous);
    if (isDemo) return false;

    const sessionWelcomeSeen = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(`welcome_seen_${userData.uid}`) === 'true';
    const hasJoinedGroup = (userData.groupIds && userData.groupIds.length > 0) || !!userData.groupId;
    const isWelcomeDone = sessionWelcomeSeen || userData.hasSeenWelcomeStory !== false || hasJoinedGroup;

    return userData.hasSetKickThreshold !== true && isWelcomeDone && !isJoiningInvite;
}

export const useDashboardHabitPace = (
    userData: UserData | null,
    loading: boolean,
    isJoiningInvite: boolean,
    t: (key: string, replacements?: Record<string, string | number>) => string
) => {
    const [showAutoKickModal, setShowAutoKickModal] = useState<boolean>(() => 
        shouldShowAutoKickModal(userData, loading, isJoiningInvite)
    );
    const [autoKickStep, setAutoKickStep] = useState<number>(0);
    const [selectedKickDays, setSelectedKickDays] = useState<number>(DEFAULT_KICK_THRESHOLD);
    const [kickConfirmInput, setKickConfirmInput] = useState<string>('');
    const [autoKickError, setAutoKickError] = useState<string>('');

    useEffect(() => {
        const willShow = shouldShowAutoKickModal(userData, loading, isJoiningInvite);
        queueMicrotask(() => {
            setShowAutoKickModal(willShow);
        });
    }, [userData, loading, isJoiningInvite]);

    const handleAutoKickSubmit = async () => {
        setAutoKickError('');

        try {
            const requestBody: UpdateKickThresholdRequest = {
                threshold: selectedKickDays
            };

            const response = await apiClient.post('/api/groups/update-kick-threshold', requestBody);

            const result = response.data as UpdateKickThresholdResponse;
            if (result.success) {
                toast.success(t('groupChat.autoKickSuccess'));
                setShowAutoKickModal(false);
                setAutoKickStep(0);
                setKickConfirmInput('');
            } else {
                toast.error('Failed to update pace: Unknown error');
            }
        } catch (err: unknown) {
            console.error('Error updating threshold:', err);

            if (err && typeof err === 'object' && 'response' in err) {
                const axiosError = err as { response?: { data?: { error?: string } } };
                const msg = axiosError.response?.data?.error || 'Failed to update pace';
                toast.error(`Failed to update pace: ${msg}`);
            } else if (err instanceof Error) {
                toast.error(`An error occurred: ${err.message}`);
            } else {
                toast.error(`An error occurred: ${String(err)}`);
            }
        }
    };

    return { 
        showAutoKickModal, setShowAutoKickModal, 
        autoKickStep, setAutoKickStep,
        selectedKickDays, setSelectedKickDays,
        kickConfirmInput, setKickConfirmInput,
        autoKickError, setAutoKickError,
        handleAutoKickSubmit 
    };
};
