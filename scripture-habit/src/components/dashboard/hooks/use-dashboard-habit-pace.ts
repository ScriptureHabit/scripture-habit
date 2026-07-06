import { useState, useEffect } from 'react';
import apiClient from '../../../utils/api-client';

import { toast } from 'react-toastify';
import { UserData } from '../../../types/user';
import { DEFAULT_KICK_THRESHOLD } from '../../../constants';
import { UpdateKickThresholdRequest, UpdateKickThresholdResponse } from '../../../../api_internal/lib/schemas';

export const useDashboardHabitPace = (
    userData: UserData | null,
    loading: boolean,
    isJoiningInvite: boolean,
    t: (key: string, replacements?: Record<string, string | number>) => string
) => {
    const [showAutoKickModal, setShowAutoKickModal] = useState<boolean>(false);
    const [autoKickStep, setAutoKickStep] = useState<number>(0);
    const [selectedKickDays, setSelectedKickDays] = useState<number>(DEFAULT_KICK_THRESHOLD);
    const [kickConfirmInput, setKickConfirmInput] = useState<string>('');
    const [autoKickError, setAutoKickError] = useState<string>('');

    useEffect(() => {
        if (!loading && userData && userData.uid && 
            userData.hasSetKickThreshold !== true && 
            userData.hasSeenWelcomeStory !== undefined &&
            !isJoiningInvite) {
            setShowAutoKickModal(true);
        }
    }, [userData, loading, isJoiningInvite]);

    const handleAutoKickSubmit = async () => {
        const inputNum = parseInt(kickConfirmInput, 10);
        if (inputNum !== selectedKickDays) {
            setAutoKickError(t('groupChat.autoKickErrorMismatch'));
            setKickConfirmInput('');
            return;
        }

        setAutoKickError('');

        try {
            const requestBody: UpdateKickThresholdRequest = {
                threshold: selectedKickDays
            };

            const response = await apiClient.post('/api/groups/update-kick-threshold', requestBody);

            const result = response.data as UpdateKickThresholdResponse;
            if (result.success) {
                toast.success(t('groupChat.autoKickSuccess'));
                setAutoKickStep(2);
                setKickConfirmInput('');
            } else {
                toast.error('Failed to update pace: Unknown error');
            }
        } catch (err: unknown) {
            console.error('Error updating threshold:', err);
            let errorMessage = '';
            let isResponseError = false;

            if (err && typeof err === 'object' && 'response' in err) {
                const axiosError = err as { response?: { data?: { error?: string } } };
                errorMessage = axiosError.response?.data?.error || 'Failed to update pace';
                isResponseError = true;
            } else if (err instanceof Error) {
                errorMessage = err.message;
            } else {
                errorMessage = String(err);
            }

            if (isResponseError) {
                toast.error(`Failed to update pace: ${errorMessage}`);
            } else {
                toast.error(`An error occurred: ${errorMessage}`);
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
