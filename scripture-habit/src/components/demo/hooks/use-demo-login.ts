import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInAnonymously, signOut } from 'firebase/auth';
import { auth } from '../../../firebase';
import { useLanguage } from '../../../hooks/use-language';
import { toast } from 'react-toastify';
import apiClient from '../../../utils/api-client';

export function useDemoLogin() {
    const { t, language } = useLanguage();
    const navigate = useNavigate();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const hasStartedRef = useRef(false);

    useEffect(() => {
        if (hasStartedRef.current) return;
        hasStartedRef.current = true;

        const performDemoLogin = async () => {
            if (!auth) {
                const msg = t('demo.loginError');
                setErrorMessage(msg);
                toast.error(msg);
                return;
            }

            try {
                // If there's an existing user session (e.g. from previous tests), sign out first
                if (auth.currentUser) {
                    await signOut(auth);
                }

                // 1. Sign in anonymously to get a unique, fresh ephemeral UID
                const userCredential = await signInAnonymously(auth);
                const idToken = await userCredential.user.getIdToken(true);

                // 2. Initialize isolated sandbox data (notes, group, bots, 3-day streak)
                // Explicitly send the fresh token to eliminate any interceptor race condition
                await apiClient.post(
                    '/api/demo/initialize',
                    { language },
                    { headers: { Authorization: `Bearer ${idToken}` } }
                );

                toast.success(t('demo.loginSuccess'));
                navigate(`/${language}/dashboard`, { replace: true });
            } catch (error: unknown) {
                console.error('[DemoLogin] Failed to initialize demo sandbox session:', error);
                const msg = t('demo.loginError');
                setErrorMessage(msg);
                toast.error(msg);
                setTimeout(() => {
                    navigate(`/${language}/login`, { replace: true });
                }, 2500);
            }
        };

        performDemoLogin();
    }, [language, navigate, t]);

    return {
        errorMessage,
        t,
    };
}
