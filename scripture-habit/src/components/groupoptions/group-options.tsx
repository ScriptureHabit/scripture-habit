
import { FC } from 'react';
import { Link } from 'react-router-dom';
import './group-options.css';
import { useLanguage } from '../../hooks/use-language';
import WelcomeStoryModal from '../welcomestorymodal/welcome-story-modal';
import GroupOptionsTour from './group-options-tour';
import Mascot from '../mascot/mascot';
import { OptionsSkeleton } from '../skeleton/skeleton';
import { useGroupOptions } from './hooks/use-group-options';

const GroupOptions: FC = () => {
    const { t } = useLanguage();
    const {
        userData,
        showWelcomeStory,
        showTour,
        loading,
        handleCloseWelcomeStory,
        handleCloseTour
    } = useGroupOptions();

    if (loading) {
        return (
            <div className="App GroupOptions">
                <div className="AppGlass options-container">
                    <OptionsSkeleton />
                </div>
            </div>
        );
    }

    return (
        <div className="App GroupOptions">
            <div className="AppGlass options-container">
                <h2>{t('groupOptions.title')}</h2>

                <div className="options-grid">
                    <div className="option-wrapper">
                        <div className="card-mascot">
                            <Mascot
                                userData={userData}
                                customMessage={t('mascot.createGroupPrompt2')}
                            />
                        </div>
                        <Link to="/group-form" className="option-card create-card" data-testid="create-group-card">
                            <div className="icon">✨</div>
                            <h3>{t('groupOptions.createGroupTitle')}</h3>
                            <p>{t('groupOptions.createGroupDesc')}</p>
                        </Link>
                    </div>

                    <div className="option-wrapper join-wrapper">
                        <div className="card-mascot">
                            <Mascot
                                userData={userData}
                                customMessage={t('mascot.joinGroupPrompt')}
                                reversed={true}
                            />
                        </div>
                        <Link to="/join-group" className="option-card join-card">
                            <div className="icon">🔍</div>
                            <h3>{t('groupOptions.joinGroupTitle')}</h3>
                            <p>{t('groupOptions.joinGroupDesc')}</p>
                        </Link>
                    </div>
                </div>

                <Link to="/dashboard" className="back-link">
                    {t('groupOptions.backToDashboard')}
                </Link>
            </div>

            <WelcomeStoryModal
                isOpen={showWelcomeStory}
                onClose={handleCloseWelcomeStory}
                userData={userData}
            />

            <GroupOptionsTour
                isOpen={showTour}
                onClose={handleCloseTour}
                t={t}
            />
        </div>
    );
};

export default GroupOptions;


