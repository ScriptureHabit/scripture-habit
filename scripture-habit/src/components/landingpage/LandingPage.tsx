import { useState, FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage, Language } from '../../Context/LanguageContext';
import Button from '../Button/Button';
import './LandingPage.css';
import Footer from '../Footer/Footer';
import { UilGlobe } from '@iconscout/react-unicons';

interface LanguageOption {
    code: Language;
    name: string;
    flag: string;
}

interface FeatureOption {
    key: string;
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

    const features: FeatureOption[] = [
        { key: 'sharing' },
        { key: 'rule' },
        { key: 'ai' },
        { key: 'link' },
        { key: 'recommend' }
    ];

    return (
        <div className="LandingPageRoot">
            <div className="LandingGlass">
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

                {/* Features Section */}
                <section className="features-section">
                    <h2 className="section-title">{t('landing.features.title')}</h2>
                    <div className="features-grid">
                        {features.map((feature) => (
                            <div key={feature.key} className="feature-card">
                                <h3 className="feature-name">{t(`landing.features.${feature.key}.title`)}</h3>
                                <p className="feature-desc">{t(`landing.features.${feature.key}.desc`)}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Use Cases Section */}
                <section className="use-cases-section">
                    <h2 className="section-title">{t('landing.useCases.title')}</h2>
                    <div className="use-cases-grid">
                        <div className="use-case-card">
                            <h3 className="use-case-persona">{t('landing.useCases.teacher.title')}</h3>
                            <div className="comparison-container">
                                <div className="comparison-box problem">
                                    <span className="comparison-label">{t('landing.useCases.status.problem')}</span>
                                    <p className="comparison-text">{t('landing.useCases.teacher.problem')}</p>
                                </div>
                                <div className="comparison-arrow">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
                                </div>
                                <div className="comparison-box solution">
                                    <span className="comparison-label solution-label">{t('landing.useCases.status.solution')}</span>
                                    <p className="comparison-text">{t('landing.useCases.teacher.solution')}</p>
                                </div>
                            </div>
                        </div>

                        <div className="use-case-card">
                            <h3 className="use-case-persona">{t('landing.useCases.student.title')}</h3>
                            <div className="comparison-container">
                                <div className="comparison-box problem">
                                    <span className="comparison-label">{t('landing.useCases.status.problem')}</span>
                                    <p className="comparison-text">{t('landing.useCases.student.problem')}</p>
                                </div>
                                <div className="comparison-arrow">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
                                </div>
                                <div className="comparison-box solution">
                                    <span className="comparison-label solution-label">{t('landing.useCases.status.solution')}</span>
                                    <p className="comparison-text">{t('landing.useCases.student.solution')}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Unity Section */}
                <section className="unity-section">
                    <div className="unity-content">
                        <div className="unity-visual">
                            <div className="sun-glow"></div>
                            <div className="unity-percentage">100%</div>
                        </div>
                        <div className="unity-text">
                            <h2 className="section-title">{t('landing.unity.title')}</h2>
                            <p className="section-desc">{t('landing.unity.desc')}</p>
                        </div>
                    </div>
                </section>

                {/* SEO Content Section */}
                <section className="seo-explanation-section">
                    <div className="seo-grid">
                        <div className="seo-item">
                            <h2 className="seo-h2">{t('landing.seoContent.why.title')}</h2>
                            <p className="seo-p">{t('landing.seoContent.why.text')}</p>
                        </div>
                        <div className="seo-item">
                            <h2 className="seo-h2">{t('landing.seoContent.community.title')}</h2>
                            <p className="seo-p">{t('landing.seoContent.community.text')}</p>
                        </div>
                        <div className="seo-item">
                            <h2 className="seo-h2">{t('landing.seoContent.comparison.title')}</h2>
                            <p className="seo-p">{t('landing.seoContent.comparison.text')}</p>
                        </div>
                    </div>

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
                        className="cta-button final-cta"
                        onClick={() => navigate(`/${language}/welcome`)}
                    >
                        {t('landing.finalCta.button')}
                    </Button>
                </section>

                <Footer />
            </div>
        </div>
    );
};

export default LandingPage;
