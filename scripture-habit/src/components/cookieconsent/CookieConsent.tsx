import { FC, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { safeStorage } from '../../Utils/storage';
import { useLanguage } from '../../Context/LanguageContext';
import './CookieConsent.css';

const CookieConsent: FC = () => {
    const { t } = useLanguage();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const consent = safeStorage.get('cookieConsent');
        if (!consent) {
            // Wait for 3 seconds AND check if onboarding modals are open
            const timer = setTimeout(() => {
                const isModalActive = document.body.getAttribute('data-dashboard-modal-open') === 'true';
                if (!isModalActive) {
                    setIsVisible(true);
                } else {
                    // Refresh check after 2 seconds if still busy
                    const retryTimer = setTimeout(() => {
                         if (document.body.getAttribute('data-dashboard-modal-open') !== 'true') {
                             setIsVisible(true);
                         }
                    }, 2000);
                    return () => clearTimeout(retryTimer);
                }
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleAccept = () => {
        safeStorage.set('cookieConsent', 'true');
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="cookie-consent-banner">
            <div className="cookie-consent-content">
                <p>
                    {t('cookieConsent.message')}
                    <Link to="/privacy" className="privacy-link">
                        {t('cookieConsent.privacyPolicy')}
                    </Link>
                </p>
                <button className="accept-button" onClick={handleAccept}>
                    {t('cookieConsent.accept')}
                </button>
            </div>
        </div>
    );
};

export default CookieConsent;
