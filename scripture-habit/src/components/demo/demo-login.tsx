import { useDemoLogin } from './hooks/use-demo-login';
import './demo-login.css';

const DemoLogin = () => {
    const { errorMessage, t } = useDemoLogin();

    return (
        <div className="DemoLoginRoot">
            <main className="demo-login-card">
                <div className="demo-mascot-wrapper">
                    <img src="/images/mascot.png" alt="Demo Mascot" className="demo-mascot-img" />
                </div>
                <h1 className="demo-title">{t('demo.loadingTitle')}</h1>
                <p className="demo-subtitle">
                    {errorMessage || t('demo.loadingSubtitle')}
                </p>
                {!errorMessage && (
                    <div className="demo-spinner-wrapper">
                        <div className="demo-spinner"></div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default DemoLogin;
