import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../../../hooks/use-language';
import { auth } from '../../../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { isInAppBrowser } from '../../../utils/browser-detection';

export function useWelcome() {
    const { t, setLanguage, language } = useLanguage();
    const navigate = useNavigate();
    const location = useLocation();
    const [showWarning, setShowWarning] = useState(false);
    const [pendingPath, setPendingPath] = useState<string | null>(null);

    const handleAuthClick = (path: string) => {
        const fullPath = `/${language}${path}`;
        if (isInAppBrowser()) {
            setPendingPath(fullPath);
            setShowWarning(true);
        } else {
            navigate(fullPath, { state: location.state });
        }
    };

    const handleDevQuickLogin = async () => {
        if (!auth) return;
        try {
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.removeItem('sh_dev_signed_out');
            }
            await signInWithEmailAndPassword(auth, 'demo-user@example.com', 'password123');
            navigate(`/${language}/dashboard`);
        } catch (e) {
            console.error('Dev quick login failed:', e);
        }
    };

    const handleContinue = () => {
        setShowWarning(false);
        if (pendingPath) {
            navigate(pendingPath, { state: location.state });
        }
    };

    return {
        t,
        language,
        setLanguage,
        showWarning,
        setShowWarning,
        handleAuthClick,
        handleDevQuickLogin,
        handleContinue
    };
}
