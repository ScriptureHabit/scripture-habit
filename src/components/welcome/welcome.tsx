import Button from '../button/button';
import Mascot from '../mascot/mascot';
import { LANGUAGES } from '../../config/languages';
import { isEmulator } from '../../config/firebase-config';
import BrowserWarningModal from '../browserwarningmodal/browser-warning-modal';
import './welcome.css';
import Footer from '../footer/footer';
import { useWelcome } from './hooks/use-welcome';

const Welcome = () => {
    const {
        t,
        setLanguage,
        language,
        showWarning,
        setShowWarning,
        handleAuthClick,
        handleDevQuickLogin,
        handleDevQuickLoginNew,
        handleContinue
    } = useWelcome();

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

                {isEmulator && import.meta.env.DEV && (
                    <div style={{ marginTop: '0.75rem', width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <button
                            type="button"
                            onClick={handleDevQuickLogin}
                            style={{
                                width: '100%',
                                padding: '0.65rem 1rem',
                                borderRadius: '8px',
                                border: '1px dashed #ec4899',
                                backgroundColor: 'rgba(236, 72, 153, 0.08)',
                                color: '#ec4899',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                fontSize: '0.9rem'
                            }}
                        >
                            ⚡ Dev Login (existing-user: 既存)
                        </button>
                        <button
                            type="button"
                            onClick={handleDevQuickLoginNew}
                            style={{
                                width: '100%',
                                padding: '0.65rem 1rem',
                                borderRadius: '8px',
                                border: '1px dashed #10b981',
                                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                                color: '#10b981',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                fontSize: '0.9rem'
                            }}
                        >
                            🌱 Dev Login (new-user: 新規)
                        </button>
                    </div>
                )}

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
