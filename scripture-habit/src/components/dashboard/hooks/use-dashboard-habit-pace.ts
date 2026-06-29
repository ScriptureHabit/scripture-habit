import { useState, useEffect } from 'react';
import { auth, appCheck } from '../../../firebase';
import { getToken } from 'firebase/app-check';

import { toast } from 'react-toastify';
import { UserData } from '../../../types/user';

export const useDashboardHabitPace = (
    userData: UserData | null,
    loading: boolean,
    isJoiningInvite: boolean,
    t: (key: string, replacements?: Record<string, string | number>) => string
) => {
    const [showAutoKickModal, setShowAutoKickModal] = useState<boolean>(false);
    const [autoKickStep, setAutoKickStep] = useState<number>(0);
    const [selectedKickDays, setSelectedKickDays] = useState<number>(3);
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
        // Removed premature step increment and clear
        // setAutoKickStep(2);
        // setKickConfirmInput('');

        try {
            const idToken = await auth?.currentUser?.getIdToken();
            if (!idToken) throw new Error("No idToken");

            // Get App Check token
            let appCheckToken: string | undefined;
            if (appCheck) {
                try {
                    const result = await getToken(appCheck);
                    appCheckToken = result.token;
                } catch (err) {
                    console.warn("Failed to get App Check token:", err);
                }
            }

            const API_BASE_URL = '';
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            };

            if (appCheckToken) {
                headers['X-Firebase-AppCheck'] = appCheckToken;
            }

            const response = await fetch(`${API_BASE_URL}/api/groups/update-kick-threshold`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    threshold: selectedKickDays
                })
            });

            if (response.ok) {
                toast.success(t('groupChat.autoKickSuccess'));
                setAutoKickStep(2);
                setKickConfirmInput('');
            } else {
                const errorData = await response.json();
                toast.error(`Failed to update pace: ${errorData.error || response.statusText}`);
            }
        } catch (err: unknown) {
            const error = err as Error;
            console.error('Error updating threshold:', error);
            toast.error(`An error occurred: ${error.message || String(error)}`);
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
