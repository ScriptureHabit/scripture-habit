import { useEffect, FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../Context/LanguageContext';
import './TermsOfService.css';

const TermsOfService: FC = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="terms-container">
            <div className="terms-card">
                <header className="terms-header">
                    <button onClick={() => navigate(-1)} className="back-button" aria-label="Go back">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h1>{t('terms.title')}</h1>
                </header>

                <div className="terms-content">
                    <p className="last-updated">{t('terms.lastUpdated')}</p>
                    <p className="intro">{t('terms.intro')}</p>

                    <section className="disclaimer-section">
                        <h2 style={{ color: '#E53E3E' }}>{t('terms.officialDisclaimer')}</h2>
                        <p><strong>{t('terms.officialDisclaimerItems')}</strong></p>
                    </section>

                    <section>
                        <h2>{t('terms.userConduct')}</h2>
                        <p>{t('terms.userConductItems')}</p>
                    </section>

                    <section>
                        <h2>{t('terms.aiDisclaimer')}</h2>
                        <p>{t('terms.aiDisclaimerItems')}</p>
                    </section>

                    <section>
                        <h2>{t('terms.termination')}</h2>
                        <p>{t('terms.terminationItems')}</p>
                    </section>

                    <section>
                        <h2>{t('terms.limitation')}</h2>
                        <p>{t('terms.limitationItems')}</p>
                    </section>
                </div>

                <footer className="terms-footer">
                    &copy; {new Date().getFullYear()} Scripture Habit
                </footer>
            </div>
        </div>
    );
};

export default TermsOfService;
