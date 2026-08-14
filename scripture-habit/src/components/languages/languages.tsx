import './languages.css';
import { useLanguage } from '../../hooks/use-language';
import { LANGUAGES } from '../../config/languages';

const Languages = () => {
    const { language, setLanguage, t } = useLanguage();

    return (
        <div className="Languages DashboardContent">
            <div className="dashboard-header">
                <h1>{t('languages.title')}</h1>
                <p className="welcome-text">{t('languages.description')}</p>
            </div>
            <div className="languages-content">
                <div className="language-options">
                    {LANGUAGES.map((lang) => (
                        <div
                            key={lang.code}
                            className={`language-option ${language === lang.code ? 'active' : ''}`}
                            onClick={() => setLanguage(lang.code)}
                            data-testid={`language-option-${lang.code}`}
                        >
                            <span className="lang-flag">{lang.flag}</span>
                            <span className="lang-name">{t(lang.translationKey)}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Languages;
