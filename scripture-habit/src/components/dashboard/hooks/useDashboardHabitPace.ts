import { useState, useEffect } from 'react';
import { safeStorage } from '../../../Utils/storage';
import { auth } from '../../../firebase';
import { Capacitor } from '@capacitor/core';
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
        const inviteCode = safeStorage.get('pendingInviteCode');
        if (!loading && userData && userData.uid && 
            userData.hasSetKickThreshold !== true && 
            !inviteCode && !isJoiningInvite) {
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
        if (autoKickStep === 1) {
            setAutoKickStep(2);
            setKickConfirmInput('');
            return;
        }

        try {
            const idToken = await auth?.currentUser?.getIdToken();
            if (!idToken) throw new Error("No idToken");

            const API_BASE_URL = Capacitor.isNativePlatform() ? 'https://scripturehabit.app' : '';
            const response = await fetch(`${API_BASE_URL}/api/update-kick-threshold`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    threshold: selectedKickDays
                })
            });

            if (response.ok) {
                toast.success(t('groupChat.autoKickSuccess'));
                setShowAutoKickModal(false);
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
