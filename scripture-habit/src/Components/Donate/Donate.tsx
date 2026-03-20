import React from 'react';
import './Donate.css';
import { useLanguage } from '../../Context/LanguageContext';
import Mascot from '../Mascot/Mascot';

import { UserData } from '../../types/user';

interface DonateProps {
    userData: UserData | null;
}

const Donate: React.FC<DonateProps> = ({ userData }) => {
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
                    <p className="donate-vision-statement">
                        {t('story.vision')}
                    </p>

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
