
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import apiClient from '../../utils/api-client';
import './group-options.css';
import { useLanguage } from '../../hooks/use-language';
import WelcomeStoryModal from '../welcomestorymodal/welcome-story-modal';
import GroupOptionsTour from './group-options-tour';
import Mascot from '../mascot/mascot';
import { OptionsSkeleton } from '../skeleton/skeleton';
import { useGroupOptions } from './hooks/use-group-options';

const GroupOptions = () => {
    const { t, language } = useLanguage();
    const navigate = useNavigate();
    const [creatingAiGroup, setCreatingAiGroup] = useState(false);
    const {
        userData,
        showWelcomeStory,
        showTour,
        loading,
        handleCloseWelcomeStory,
        handleCloseTour
    } = useGroupOptions();

    const handleCreateAiGroup = async () => {
        if (creatingAiGroup) return;
        setCreatingAiGroup(true);
        try {
            const res = await apiClient.post('/api/groups/create-ai-group', {});
            if (res.data && res.data.groupId) {
                toast.success(t('groupForm.successCreated') || 'AI Partner group created!');
                // Skip the tour so it doesn't interrupt the group chat
                if (userData?.uid) {
                    sessionStorage.setItem(`tour_seen_${userData.uid}`, 'true');
                    sessionStorage.setItem(`ai_group_tour_pending_${userData.uid}`, 'true');
                }
                sessionStorage.setItem('ai_group_tour_pending', 'true');
                navigate(`/${language}/dashboard?groupId=${res.data.groupId}&view=2`);
            }
        } catch (err: unknown) {
            console.error('Failed to create AI group:', err);
            toast.error(t('groupChat.reportError') || 'Failed to create AI Partner group');
        } finally {
            setCreatingAiGroup(false);
        }
    };

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

                    <div className="option-wrapper ai-wrapper">
                        <div className="card-mascot">
                            <Mascot
                                userData={userData}
                                customMessage={t('mascot.aiGroupPrompt') || '一人でマイペースに勉強したい'}
                            />
                        </div>
                        <button 
                            type="button"
                            onClick={handleCreateAiGroup}
                            disabled={creatingAiGroup}
                            className="option-card create-card" 
                            data-testid="create-ai-group-card"
                            style={{ cursor: creatingAiGroup ? 'wait' : 'pointer', width: '100%' }}
                        >
                            <div className="icon">🤖</div>
                            <h3>{t('groupOptions.aiGroupTitle') || 'スクハビAIと始める'}</h3>
                            <p>{t('groupOptions.aiGroupDesc') || 'スクハビAIと1対1で毎日聖典を学ぶ専用グループを作成します。'}</p>
                        </button>
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


