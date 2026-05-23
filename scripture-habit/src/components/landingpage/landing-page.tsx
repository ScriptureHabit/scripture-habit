import { useState, FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../hooks/use-language';
import { Language } from '../../context/language-context';
import Button from '../button/button';
import './landing-page.css';
import Footer from '../footer/footer';
import { UilGlobe } from '@iconscout/react-unicons';

interface LanguageOption {
    code: Language;
    name: string;
    flag: string;
}


const LandingPage: FC = () => {
    const { t, language, setLanguage } = useLanguage();
    const navigate = useNavigate();
    const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);

    const languages: LanguageOption[] = [
        { code: 'en', name: 'English', flag: '🇺🇸' },
        { code: 'ja', name: '日本語', flag: '🇯🇵' },
        { code: 'pt', name: 'Português', flag: '🇧🇷' },
        { code: 'es', name: 'Español', flag: '🇪🇸' },
        { code: 'zho', name: '繁體中文', flag: '🇹🇼' },
        { code: 'ko', name: '한국어', flag: '🇰🇷' },
        { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
        { code: 'th', name: 'ไทย', flag: '🇹🇭' },
        { code: 'tl', name: 'Tagalog', flag: '🇵🇭' },
        { code: 'sw', name: 'Kiswahili', flag: '🇰🇪' },
    ];

    const currentLang = languages.find(l => l.code === language) || languages[0];


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
                            {languages.map((lang) => (
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
                        <Button
                            className="cta-button primary-cta"
                            onClick={() => navigate(`/${language}/welcome`)}
                        >
                            {t('landing.hero.cta')}
                        </Button>
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
                    <Button
                        className="cta-button primary-cta final-cta"
                        onClick={() => navigate(`/${language}/welcome`)}
                    >
                        {t('landing.finalCta.button')}
                    </Button>
                </section>

            </main>
            <Footer />
        </div>
    );
};

export default LandingPage;


