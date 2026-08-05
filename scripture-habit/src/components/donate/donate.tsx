
import './donate.css';
import { useLanguage } from '../../hooks/use-language';
import Mascot from '../mascot/mascot';

import { UserData } from '../../types/user';

interface DonateProps {
    userData: UserData | null;
}

const Donate = ({ userData }: DonateProps) => {
    const { t } = useLanguage();

    return (
        <div className="Donate DashboardContent">
            <div className="dashboard-header">
                <h1>{t('story.title')}</h1>
                <div className="donate-mascot-wrapper">
                    <Mascot
                        userData={userData}
                        customMessage={t('story.description')}
                    />
                </div>
            </div>
            <div className="donate-container">
                <div className="donate-card story-card">
                    <div className="developer-profile-section">
                        <div className="developer-avatar-container">
                            <img 
                                src="/images/profile.jpg" 
                                alt="Developer Profile" 
                                className="developer-avatar" 
                            />
                        </div>
                        <div className="developer-info-container">
                            <h3 className="developer-name">{t('story.developerName')}</h3>
                            <p className="developer-role">{t('story.developerRole')}</p>
                        </div>
                    </div>

                    <div className="donate-separator"></div>

                    <div className="story-content">
                        <h2 className="story-title">{t('story.appBackground')}</h2>
                        <div className="story-text">
                            {t('story.backgroundStory')}
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default Donate;


