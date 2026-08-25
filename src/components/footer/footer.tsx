
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../hooks/use-language';
import './footer.css';

const Footer = () => {
    const navigate = useNavigate();
    const { t, language } = useLanguage();

    return (
        <footer className="app-footer">
            <div className="footer-content">
                <div className="footer-links">
                    <span className="footer-link" onClick={() => navigate(`/${language}/privacy`)}>
                        {t('privacy.title')}
                    </span>
                    <span className="footer-separator">•</span>
                    <span className="footer-link" onClick={() => navigate(`/${language}/terms`)}>
                        {t('terms.title')}
                    </span>
                    <span className="footer-separator">•</span>
                    <span className="footer-link" onClick={() => navigate(`/${language}/legal`)}>
                        {t('legalDisclosure.title')}
                    </span>
                </div>
                <div className="footer-copyright">
                    © {new Date().getFullYear()} Scripture Habit
                    <span className="footer-separator">•</span>
                    <a
                        href="https://vercel.com/?utm_source=scripture-habit&utm_campaign=oss"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="footer-partner-link"
                    >
                        Powered by Vercel
                    </a>
                </div>
            </div>
        </footer>
    );
};

export default Footer;


