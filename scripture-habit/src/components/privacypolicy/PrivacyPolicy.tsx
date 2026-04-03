import { useEffect, FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../Context/LanguageContext';
import './PrivacyPolicy.css';

const PrivacyPolicy: FC = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="privacy-container">
            <div className="privacy-card">
                <header className="privacy-header">
                    <button onClick={() => navigate(-1)} className="back-button" aria-label="Go back">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h1>{t('privacy.title')}</h1>
                </header>

                <div className="privacy-content">
                    <p className="last-updated">{t('privacy.lastUpdated')}</p>
                    <p className="intro">{t('privacy.intro')}</p>

                    <section className="disclaimer-section">
                        <h2 style={{ color: '#E53E3E' }}>{t('terms.officialDisclaimer')}</h2>
                        <p><strong>{t('terms.officialDisclaimerItems')}</strong></p>
                    </section>

                    <section>
                        <h2>{t('privacy.dataCollection')}</h2>
                        <p>{t('privacy.dataCollectionItems')}</p>
                    </section>

                    <section>
                        <h2>{t('privacy.dataUsage')}</h2>
                        <p>{t('privacy.dataUsageItems')}</p>
                    </section>

                    <section>
                        <h2>{t('privacy.thirdParties')}</h2>
                        <p>{t('privacy.thirdPartiesItems')}</p>
                    </section>

                    <section>
                        <h2>{t('privacy.rights')}</h2>
                        <p>{t('privacy.rightsItems')}</p>
                    </section>

                    <section>
                        <h2>{t('privacy.contact')}</h2>
                        <p>{t('privacy.contactItems')}</p>
                    </section>
                </div>

                <footer className="privacy-footer">
                    &copy; {new Date().getFullYear()} Scripture Habit
                </footer>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
