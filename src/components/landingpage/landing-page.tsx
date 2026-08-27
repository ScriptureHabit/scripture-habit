import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../hooks/use-language';
import { useAuth } from '../../hooks/use-auth';
import { LANGUAGES } from '../../config/languages';
import Button from '../button/button';
import './landing-page.css';
import Footer from '../footer/footer';
import { Globe, X, Share2, PlusSquare, LayoutGrid, Rocket, ShieldCheck, Users, LayoutDashboard } from 'lucide-react';


const LandingPage = () => {
    const { t, language, setLanguage } = useLanguage();
    const { user } = useAuth();
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
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
        if (typeof window !== 'undefined' && window.deferredPWAPrompt) {
            return window.deferredPWAPrompt;
        }
        return null;
    });

    useEffect(() => {
        const handlePrompt = () => {
            if (window.deferredPWAPrompt) {
                setDeferredPrompt(window.deferredPWAPrompt);
            }
        };
        window.addEventListener('beforeinstallprompt', handlePrompt);
        return () => window.removeEventListener('beforeinstallprompt', handlePrompt);
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

                {/* Language Selector Overlay & Dashboard Quick Access */}
                <div className="lang-selector-container">
                    {user && (
                        <button
                            className="landing-dashboard-btn"
                            onClick={() => navigate(`/${language}/dashboard`)}
                            title={t('dashboard.title') || 'Dashboard'}
                        >
                            <LayoutDashboard size={18} />
                            <span>{t('dashboard.title') || 'Dashboard'}</span>
                        </button>
                    )}
                    <button
                        className="lang-selector-btn"
                        onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                        aria-expanded={isLangMenuOpen}
                        aria-haspopup="true"
                    >
                        <Globe size={20} />
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
                        <img 
                            src="/images/mascot.webp" 
                            alt="Welcome Bird" 
                            className="hero-mascot-img" 
                            width="200" 
                            height="200"
                            fetchPriority="high"
                            decoding="async"
                        />
                    </div>
                    <div className="hero-content">
                        <h1 className="hero-title">{t('landing.hero.title')}</h1>
                        <p className="hero-subtitle">{t('landing.hero.subtitle')}</p>
                        <div className="hero-cta-container">
                            <Button
                                className="cta-button primary-cta"
                                onClick={handleDownloadClick}
                            >
                                <LayoutGrid size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                                {t('landing.hero.downloadCta')}
                            </Button>
                            <Button
                                className="cta-button demo-cta"
                                onClick={() => navigate(`/${language}/demo`)}
                            >
                                <Rocket size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
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
                                <img 
                                    src="/images/concept_alone.webp" 
                                    alt="Studying alone" 
                                    className="concept-card-img" 
                                    width="124"
                                    height="124"
                                    loading="lazy"
                                    decoding="async"
                                />
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
                                <img 
                                    src="/images/concept_together.webp" 
                                    alt="Studying together" 
                                    className="concept-card-img" 
                                    width="124"
                                    height="124"
                                    loading="lazy"
                                    decoding="async"
                                />
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
                            <img src="/images/concept_together.webp" alt="Join a team" className="step-card-img step-img-together" />
                        </div>
                        <div className="step-line"></div>
                        <div className="step-card">
                            <div className="step-number">2</div>
                            <h3 className="step-title">{t('landing.steps.step2Title')}</h3>
                            <p className="step-desc">{t('landing.steps.step2Desc')}</p>
                            <img src="/images/mascot.webp" alt="Share a thought" className="step-card-img step-img-mascot" />
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

                {/* Open Source Initiative Section */}
                <section className="landing-opensource-section">
                    <div className="landing-opensource-container">
                        <h2 className="section-title">{t('landing.openSource.title')}</h2>
                        <p className="landing-opensource-subtitle">{t('landing.openSource.subtitle')}</p>

                        <div className="landing-opensource-grid">
                            <div className="landing-opensource-card">
                                <div className="landing-opensource-card-icon">
                                    <ShieldCheck size={28} />
                                </div>
                                <h3 className="landing-opensource-card-title">{t('landing.openSource.card1Title')}</h3>
                                <p className="landing-opensource-card-desc">{t('landing.openSource.card1Desc')}</p>
                            </div>
                            <div className="landing-opensource-card">
                                <div className="landing-opensource-card-icon">
                                    <Users size={28} />
                                </div>
                                <h3 className="landing-opensource-card-title">{t('landing.openSource.card2Title')}</h3>
                                <p className="landing-opensource-card-desc">{t('landing.openSource.card2Desc')}</p>
                            </div>
                        </div>

                        <div className="landing-opensource-cta-wrapper">
                            <a
                                href="https://github.com/ScriptureHabit/scripture-habit"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="landing-github-btn"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path>
                                    <path d="M9 18c-4.51 2-5-2-7-2"></path>
                                </svg>
                                <span>{t('landing.openSource.githubBtn')}</span>
                            </a>
                            <a
                                href="https://github.com/sponsors/daijir"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="landing-sponsors-btn"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="#ea4aaa" stroke="#ea4aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
                                </svg>
                                <span>{t('landing.openSource.sponsorsComingSoon')}</span>
                            </a>
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
                        <img src="/images/mascot.webp" alt="Mascot Bird" className="final-cta-mascot-img" />
                    </div>

                    <div className="hero-cta-container">
                        <Button
                            className="cta-button primary-cta"
                            onClick={handleDownloadClick}
                        >
                            <LayoutGrid size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                            {t('landing.hero.downloadCta')}
                        </Button>
                        <Button
                            className="cta-button demo-cta"
                            onClick={() => navigate(`/${language}/demo`)}
                        >
                            <Rocket size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
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
                                <X size={20} />
                            </button>
                        </div>
                        <div className="download-modal-body">
                            {platform === 'ios' ? (
                                <>
                                    <div className="download-step">
                                        <Share2 size={24} className="download-step-icon" />
                                        <span className="download-step-text">
                                            {t('landing.downloadModal.iosInstruction1')}
                                        </span>
                                    </div>
                                    <div className="download-step">
                                        <PlusSquare size={24} className="download-step-icon" />
                                        <span className="download-step-text">
                                            {t('landing.downloadModal.iosInstruction2')}
                                        </span>
                                    </div>
                                </>
                            ) : platform === 'android' ? (
                                <div className="download-step">
                                    <LayoutGrid size={24} className="download-step-icon" />
                                    <span className="download-step-text">
                                        {t('landing.downloadModal.androidInstruction')}
                                    </span>
                                </div>
                            ) : (
                                <div className="download-step">
                                    <LayoutGrid size={24} className="download-step-icon" />
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
                                    <LayoutGrid size={20} />
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


