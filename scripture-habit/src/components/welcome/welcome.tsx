
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Button from '../button/button';
import Mascot from '../mascot/mascot';
import { useLanguage } from '../../hooks/use-language';
import { LANGUAGES } from '../../config/languages';
import BrowserWarningModal from '../browserwarningmodal/browser-warning-modal';
import { isInAppBrowser } from '../../utils/browser-detection';
import './welcome.css';
import Footer from '../footer/footer';

const Welcome = () => {
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

    const handleContinue = () => {
        setShowWarning(false);
        if (pendingPath) {
            navigate(pendingPath, { state: location.state });
        }
    };

    return (
        <div className="App Welcome">
            <main className="AppGlass welcome-container">
                <h1>{t('welcome.title')}</h1>

                <Mascot customMessage={t('mascot.welcomeMessage')} />

                <div className="language-selection">
                    <p className="language-instruction">
                        {t('welcome.chooseLanguage')}
                    </p>
                    <div className="language-buttons">
                        {LANGUAGES.map((lang) => (
                            <button
                                key={lang.code}
                                className={`lang-btn ${language === lang.code ? 'active' : ''}`}
                                onClick={() => setLanguage(lang.code)}
                                data-testid={`welcome-lang-${lang.code}`}
                            >
                                {lang.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="browser-warning">
                    {t('welcome.browserWarning')}
                </div>

                <div className="auth-buttons">
                    <Button className="login-btn" onClick={() => handleAuthClick('/login')}>
                        {t('welcome.login')}
                    </Button>
                    <Button className="signup-btn" onClick={() => handleAuthClick('/signup')}>
                        {t('welcome.signup')}
                    </Button>
                </div>

                <BrowserWarningModal
                    isOpen={showWarning}
                    onClose={() => setShowWarning(false)}
                    onContinue={handleContinue}
                    t={t}
                />
            </main>
            <Footer />
        </div>
    );
};

export default Welcome;


