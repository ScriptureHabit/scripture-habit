import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../hooks/use-language';
import { LANGUAGES } from '../../config/languages';
import Button from '../button/button';
import './landing-page.css';
import Footer from '../footer/footer';
import { UilGlobe, UilMultiply, UilShare, UilPlusSquare, UilApps, UilRocket } from '@iconscout/react-unicons';


const LandingPage = () => {
    const { t, language, setLanguage } = useLanguage();
    const navigate = useNavigate();
    const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const [platform] = useState<'ios' | 'android' | 'desktop'>(() => {
        if (typeof window === 'undefined') return 'desktop';
        const ua = navigator.userAgent;
        const isIOS = /iPad|iPhone|iPod/.test(ua) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isAndroid = /Android/i.test(ua);

        if (isIOS) return 'ios';
        if (isAndroid) return 'android';
        return 'desktop';
    });
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

    useEffect(() => {
        // Check for globally captured prompt
        const checkPrompt = () => {
            if (window.deferredPWAPrompt) {
                setDeferredPrompt(window.deferredPWAPrompt);
            }
        };

        checkPrompt();
        const interval = setInterval(checkPrompt, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleDownloadClick = () => {
        if ((platform === 'android' || platform === 'desktop') && deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(() => {
                setDeferredPrompt(null);
                window.deferredPWAPrompt = null;
            });
        } else {
            setIsDownloadModalOpen(true);
        }
    };

    const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];


    return (
        <div className="LandingPageRoot">
            <main className="LandingGlass">
                {/* Click outside to close lang menu */}
                {isLangMenuOpen && <div className="lang-menu-backdrop" onClick={() => setIsLangMenuOpen(false)}></div>}

                {/* Language Selector Overlay */}
                <div className="lang-selector-container">
                    <button
                        className="lang-selector-btn"
                        onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                        aria-expanded={isLangMenuOpen}
                        aria-haspopup="true"
                    >
                        <UilGlobe size="20" />
                        <span>{currentLang.flag} {currentLang.name}</span>
                    </button>

                    {isLangMenuOpen && (
                        <div className="lang-dropdown" role="menu">
                            {LANGUAGES.map((lang) => (
                                <div
                                    key={lang.code}
                                    className={`lang-option ${language === lang.code ? 'active' : ''}`}
                                    onClick={() => {
                                        setLanguage(lang.code);
                                        setIsLangMenuOpen(false);
                                    }}
                                    role="menuitem"
                                >
                                    <span className="lang-flag">{lang.flag}</span>
                                    <span className="lang-name">{lang.name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Hero Section */}
                <header className="hero-section">
                    <div className="hero-mascot-container">
                        <div className="mascot-bubble">
                            <span className="mascot-bubble-text">{t('landing.hero.mascotBubble')}</span>
                            <div className="mascot-bubble-tail"></div>
                        </div>
                        <img src="/images/mascot.png" alt="Welcome Bird" className="hero-mascot-img" />
                    </div>
                    <div className="hero-content">
                        <h1 className="hero-title">{t('landing.hero.title')}</h1>
                        <p className="hero-subtitle">{t('landing.hero.subtitle')}</p>
                        <div className="hero-cta-container">
                            <Button
                                className="cta-button primary-cta"
                                onClick={handleDownloadClick}
                            >
                                <UilApps size="20" style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                                {t('landing.hero.downloadCta')}
                            </Button>
                            <Button
                                className="cta-button demo-cta"
                                onClick={() => navigate(`/${language}/demo`)}
                            >
                                <UilRocket size="20" style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                                {t('landing.hero.demoCta')}
                            </Button>
                            <Button
                                className="cta-button secondary-cta"
                                onClick={() => navigate(`/${language}/welcome`)}
                            >
                                {t('landing.hero.browserCta')}
                            </Button>
                        </div>
                    </div>
                </header>

                {/* Concept Section (Minchalle Style) */}
                <section className="concept-section">
                    <h2 className="section-title">{t('landing.concept.title')}</h2>
                    <p className="concept-subtitle">{t('landing.concept.subtitle')}</p>
                    
                    <div className="concept-comparison-grid">
                        <div className="concept-card concept-problem">
                            <div className="concept-card-badge problem-badge">{t('landing.concept.problemBadge')}</div>
                            <h3 className="concept-card-title">{t('landing.concept.card1Title')}</h3>
                            <div className="concept-card-img-wrapper">
                                <img src="/images/concept_alone.png" alt="Studying alone" className="concept-card-img" />
                            </div>
                            <p className="concept-card-text">{t('landing.concept.card1Text')}</p>
                        </div>
                        <div className="concept-arrow-divider">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                                <polyline points="12 5 19 12 12 19"></polyline>
                            </svg>
                        </div>
                        <div className="concept-card concept-solution">
                            <div className="concept-card-badge solution-badge">{t('landing.concept.solutionBadge')}</div>
                            <h3 className="concept-card-title">{t('landing.concept.card2Title')}</h3>
                            <div className="concept-card-img-wrapper">
                                <img src="/images/concept_together.png" alt="Studying together" className="concept-card-img" />
                            </div>
                            <p className="concept-card-text">{t('landing.concept.card2Text')}</p>
                        </div>
                    </div>
                </section>

                {/* Steps Section */}
                <section className="steps-section">
                    <h2 className="section-title">{t('landing.steps.title')}</h2>
                    <div className="steps-container">
                        <div className="step-card">
                            <div className="step-number">1</div>
                            <h3 className="step-title">{t('landing.steps.step1Title')}</h3>
                            <p className="step-desc">{t('landing.steps.step1Desc')}</p>
                            <img src="/images/concept_together.png" alt="Join a team" className="step-card-img step-img-together" />
                        </div>
                        <div className="step-line"></div>
                        <div className="step-card">
                            <div className="step-number">2</div>
                            <h3 className="step-title">{t('landing.steps.step2Title')}</h3>
                            <p className="step-desc">{t('landing.steps.step2Desc')}</p>
                            <img src="/images/mascot.png" alt="Share a thought" className="step-card-img step-img-mascot" />
                        </div>
                    </div>
                </section>

                {/* FAQ Section */}
                <section className="seo-explanation-section">
                    <div className="faq-container">
                        <h2 className="section-title">{t('landing.seoContent.faq.title')}</h2>
                        <div className="faq-grid">
                            {[1, 2, 3].map(id => (
                                <div key={id} className="faq-item">
                                    <h3 className="faq-q">{t(`landing.seoContent.faq.q${id}`)}</h3>
                                    <p className="faq-a">{t(`landing.seoContent.faq.a${id}`)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Final CTA Section */}
                <section className="final-cta-section">
                    <h2 className="section-title">{t('landing.finalCta.title')}</h2>
                    
                    <div className="final-cta-mascot-container">
                        <div className="mascot-bubble final-cta-bubble">
                            <span className="mascot-bubble-text">{t('landing.finalCta.mascotBubble')}</span>
                            <div className="mascot-bubble-tail"></div>
                        </div>
                        <img src="/images/mascot.png" alt="Mascot Bird" className="final-cta-mascot-img" />
                    </div>

                    <div className="hero-cta-container">
                        <Button
                            className="cta-button primary-cta"
                            onClick={handleDownloadClick}
                        >
                            <UilApps size="20" style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            {t('landing.hero.downloadCta')}
                        </Button>
                        <Button
                            className="cta-button demo-cta"
                            onClick={() => navigate(`/${language}/demo`)}
                        >
                            <UilRocket size="20" style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            {t('landing.finalCta.demoCta')}
                        </Button>
                        <Button
                            className="cta-button secondary-cta"
                            onClick={() => navigate(`/${language}/welcome`)}
                        >
                            {t('landing.hero.browserCta')}
                        </Button>
                    </div>
                </section>

            </main>
            <Footer />

            {isDownloadModalOpen && (
                <div className="download-modal-overlay" onClick={() => setIsDownloadModalOpen(false)}>
                    <div className="download-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="download-modal-header">
                            <h3 className="download-modal-title">{t('landing.downloadModal.title')}</h3>
                            <button className="download-modal-close-btn" onClick={() => setIsDownloadModalOpen(false)} aria-label={t('landing.downloadModal.close')}>
                                <UilMultiply size="20" />
                            </button>
                        </div>
                        <div className="download-modal-body">
                            {platform === 'ios' ? (
                                <>
                                    <div className="download-step">
                                        <UilShare size="24" className="download-step-icon" />
                                        <span className="download-step-text">
                                            {t('landing.downloadModal.iosInstruction1')}
                                        </span>
                                    </div>
                                    <div className="download-step">
                                        <UilPlusSquare size="24" className="download-step-icon" />
                                        <span className="download-step-text">
                                            {t('landing.downloadModal.iosInstruction2')}
                                        </span>
                                    </div>
                                </>
                            ) : platform === 'android' ? (
                                <div className="download-step">
                                    <UilApps size="24" className="download-step-icon" />
                                    <span className="download-step-text">
                                        {t('landing.downloadModal.androidInstruction')}
                                    </span>
                                </div>
                            ) : (
                                <div className="download-step">
                                    <UilApps size="24" className="download-step-icon" />
                                    <span className="download-step-text">
                                        {t('landing.downloadModal.desktopInstruction')}
                                    </span>
                                </div>
                            )}
                            
                            {(platform === 'android' || platform === 'desktop') && deferredPrompt && (
                                <button className="download-trigger-btn" onClick={() => {
                                    deferredPrompt.prompt();
                                    deferredPrompt.userChoice.then(() => {
                                        setDeferredPrompt(null);
                                        window.deferredPWAPrompt = null;
                                        setIsDownloadModalOpen(false);
                                    });
                                }}>
                                    <UilApps size="20" />
                                    {t('installPrompt.title')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LandingPage;


