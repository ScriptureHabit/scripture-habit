import { useState, FC } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../Button/Button';
import Mascot from '../Mascot/Mascot';
import { useLanguage } from '../../Context/LanguageContext';
import BrowserWarningModal from '../BrowserWarningModal/BrowserWarningModal';
import { isInAppBrowser } from '../../Utils/browserDetection';
import './Welcome.css';
import Footer from '../Footer/Footer';

const Welcome: FC = () => {
    const { t, setLanguage, language } = useLanguage();
    const navigate = useNavigate();
    const [showWarning, setShowWarning] = useState(false);
    const [pendingPath, setPendingPath] = useState<string | null>(null);

    const handleAuthClick = (path: string) => {
        const fullPath = `/${language}${path}`;
        if (isInAppBrowser()) {
            setPendingPath(fullPath);
            setShowWarning(true);
        } else {
            navigate(fullPath);
        }
    };

    const handleContinue = () => {
        setShowWarning(false);
        if (pendingPath) {
            navigate(pendingPath);
        }
    };

    return (
        <div className="App Welcome">
            <div className="AppGlass welcome-container">
                <h1>{t('welcome.title')}</h1>

                <Mascot customMessage={t('mascot.welcomeMessage')} />

                <div className="language-selection">
                    <p className="language-instruction">
                        {t('welcome.chooseLanguage')}
                    </p>
                    <div className="language-buttons">
                        <button
                            className={`lang-btn ${language === 'en' ? 'active' : ''}`}
                            onClick={() => setLanguage('en')}
                        >
                            English
                        </button>
                        <button
                            className={`lang-btn ${language === 'ja' ? 'active' : ''}`}
                            onClick={() => setLanguage('ja')}
                        >
                            日本語
                        </button>
                        <button
                            className={`lang-btn ${language === 'pt' ? 'active' : ''}`}
                            onClick={() => setLanguage('pt')}
                        >
                            Português
                        </button>
                        <button
                            className={`lang-btn ${language === 'zho' ? 'active' : ''}`}
                            onClick={() => setLanguage('zho')}
                        >
                            繁體中文
                        </button>
                        <button
                            className={`lang-btn ${language === 'es' ? 'active' : ''}`}
                            onClick={() => setLanguage('es')}
                        >
                            Español
                        </button>
                        <button
                            className={`lang-btn ${language === 'vi' ? 'active' : ''}`}
                            onClick={() => setLanguage('vi')}
                        >
                            Tiếng Việt
                        </button>
                        <button
                            className={`lang-btn ${language === 'th' ? 'active' : ''}`}
                            onClick={() => setLanguage('th')}
                        >
                            ไทย
                        </button>
                        <button
                            className={`lang-btn ${language === 'ko' ? 'active' : ''}`}
                            onClick={() => setLanguage('ko')}
                        >
                            한국어
                        </button>
                        <button
                            className={`lang-btn ${language === 'tl' ? 'active' : ''}`}
                            onClick={() => setLanguage('tl')}
                        >
                            Tagalog
                        </button>
                        <button
                            className={`lang-btn ${language === 'sw' ? 'active' : ''}`}
                            onClick={() => setLanguage('sw')}
                        >
                            Swahili
                        </button>
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
            </div>
            <Footer />
        </div>
    );
};

export default Welcome;
