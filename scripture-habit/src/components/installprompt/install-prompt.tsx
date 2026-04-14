import { useState, useEffect, FC } from 'react';
import { useLocation } from 'react-router-dom';
import { UilMultiply, UilShare, UilPlusSquare, UilApps } from '@iconscout/react-unicons';
import { useLanguage } from '../../hooks/use-language';
import { Language } from '../../context/language-context';
import { SUPPORTED_LANGUAGES } from '../../config/languages';
import './install-prompt.css';

// Extend Navigator for iOS standalone check
interface NavigatorWithStandalone extends Navigator {
    standalone?: boolean;
}

const InstallPrompt: FC = () => {
    const { t } = useLanguage();
    const location = useLocation();
    const [showPrompt, setShowPrompt] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [platform, setPlatform] = useState<'ios' | 'android' | null>(null);

    // Capture beforeinstallprompt event and detect platform
    useEffect(() => {
        const handleBeforeInstallPrompt = (e: Event) => {
            const installEvent = e as BeforeInstallPromptEvent;
            // Prevent Chrome 76 and later from automatically showing the prompt
            installEvent.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(installEvent);
            setPlatform('android');
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Check if the event was already captured globally (in main.tsx)
        if (window.deferredPWAPrompt) {
            handleBeforeInstallPrompt(window.deferredPWAPrompt);
            // DO NOT set to null so Profile.tsx can also access it
        }

        // Immediate platform detection
        const ua = navigator.userAgent;
        const isIOS = /iPad|iPhone|iPod/.test(ua) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isAndroid = /Android/i.test(ua);

        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as NavigatorWithStandalone).standalone;

        if (!isStandalone) {
            if (isIOS) setPlatform('ios');
            else if (isAndroid) setPlatform('android');
        }

        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    // Handle showing/hiding the prompt based on route and state
    useEffect(() => {
        const path = location.pathname;
        const pathParts = path.split('/').filter(Boolean);

        // Determine the base path regardless of language prefix
        let base = path;
        const firstPart = pathParts[0];
        if (SUPPORTED_LANGUAGES.includes(firstPart as Language)) {
            base = '/' + pathParts.slice(1).join('/');
        }

        // Normalize to handle trailing slashes
        if (base !== '/' && base.endsWith('/')) {
            base = base.slice(0, -1);
        }

        const isDashboard = base === '/dashboard';
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as NavigatorWithStandalone).standalone;

        // Check for 7-day cooldown in localStorage
        let hasDismissed = false;
        const dismissedAt = localStorage.getItem('pwaInstallPromptDismissedAt');
        if (dismissedAt) {
            const dismissedDate = new Date(dismissedAt);
            const now = new Date();
            const daysSinceDismissed = (now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceDismissed < 7) {
                hasDismissed = true;
            } else {
                // Cooldown expired, clear it so we can show it again
                localStorage.removeItem('pwaInstallPromptDismissedAt');
            }
        }

        // Check for active modals on dashboard
        const isModalActive = document.body.getAttribute('data-dashboard-modal-open') === 'true';

        if (!isDashboard || hasDismissed || isStandalone || isModalActive) {
            setShowPrompt(false);
            return;
        }

        // Android logic: Show if we have the deferred prompt
        if (platform === 'android' && deferredPrompt) {
            setShowPrompt(true);
        }

        // iOS logic: Show after a longer delay (4s instead of 2s) to avoid overlapping with Cookie Consent or initial loads
        if (platform === 'ios') {
            const timer = setTimeout(() => {
                // Final check before showing
                const finalModalCheck = document.body.getAttribute('data-dashboard-modal-open') === 'true';
                if (!finalModalCheck) {
                  setShowPrompt(true);
                }
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [location.pathname, platform, deferredPrompt]);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        // Show the native browser install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        await deferredPrompt.userChoice;

        // We've used the prompt, and can't use it again, throw it away
        setDeferredPrompt(null);
        setShowPrompt(false);
        localStorage.setItem('pwaInstallPromptDismissedAt', new Date().toISOString());
    };

    const handleClose = () => {
        setShowPrompt(false);
        localStorage.setItem('pwaInstallPromptDismissedAt', new Date().toISOString());
    };

    if (!showPrompt) return null;

    return (
        <div className="install-prompt-overlay">
            <div className="install-header">
                <h3>{t('installPrompt.title')}</h3>
                <button className="close-btn" onClick={handleClose} aria-label={t('common.close')}>
                    <UilMultiply size="20" />
                </button>
            </div>

            {platform === 'ios' ? (
                <div className="install-steps">
                    <div className="step">
                        <UilShare size="24" className="step-icon ios-blue" />
                        <span className="step-text">
                            {t('installPrompt.instruction1')}
                        </span>
                    </div>
                    <div className="step">
                        <UilPlusSquare size="24" className="step-icon step-icon-gray" />
                        <span className="step-text">
                            {t('installPrompt.instruction2')}
                        </span>
                    </div>
                    {/* Visual pointer to bottom share bar on iOS Safari */}
                    <div className="triangle-pointer"></div>
                </div>
            ) : (
                <div className="install-android">
                    <p className="install-description">
                        {t('installPrompt.description')}
                    </p>
                    <button className="pwa-install-button" onClick={handleInstallClick}>
                        <UilApps size="20" />
                        {t('installPrompt.title')}
                    </button>
                </div>
            )}
        </div>
    );
};

export default InstallPrompt;



