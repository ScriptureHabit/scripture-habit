import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import apiClient from '../../utils/api-client';
import './group-options.css';
import { useLanguage } from '../../hooks/use-language';
import WelcomeStoryModal from '../welcomestorymodal/welcome-story-modal';
import Mascot from '../mascot/mascot';
import { OptionsSkeleton } from '../skeleton/skeleton';
import { useGroupOptions } from './hooks/use-group-options';

const GroupOptions = () => {
    const { t, language } = useLanguage();
    const navigate = useNavigate();
    const [creatingAiGroup, setCreatingAiGroup] = useState(false);
    const {
        userData,
        hasAiGroup,
        showWelcomeStory,
        loading,
        handleCloseWelcomeStory
    } = useGroupOptions();

    const isStage1 = userData && (!userData.groupIds || userData.groupIds.length === 0) && !userData.groupId && !userData.hasCompletedOnboarding;

    const handleCreateAiGroup = async () => {
        if (creatingAiGroup || hasAiGroup) return;
        setCreatingAiGroup(true);
        try {
            const res = await apiClient.post('/api/groups/create-ai-group', {});
            if (res.data && res.data.groupId) {
                toast.success(t('groupForm.successCreated'));
                navigate(`/${language}/dashboard?groupId=${res.data.groupId}&view=2`);
            }
        } catch (err: unknown) {
            console.error('Failed to create AI group:', err);
            toast.error(t('groupChat.reportError'));
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
                {isStage1 && (
                    <div className="group-options-quest-banner" data-testid="group-options-quest-banner">
                        <div className="quest-banner-header">
                            <span className="quest-banner-badge">🌟 {t('onboardingQuest.step1Title')}</span>
                        </div>
                        <p className="quest-banner-text">{t('onboardingQuest.groupOptionsBannerDesc')}</p>
                    </div>
                )}

                <h2>{t('groupOptions.title')}</h2>

                <div className="options-grid">
                    <div className="option-wrapper ai-wrapper">
                        <div className="card-mascot">
                            <Mascot
                                userData={userData}
                                customMessage={
                                    hasAiGroup
                                        ? t('mascot.aiGroupAlreadyJoinedPrompt')
                                        : t('mascot.aiGroupPrompt')
                                }
                            />
                        </div>
                        <button 
                            type="button"
                            onClick={handleCreateAiGroup}
                            disabled={creatingAiGroup || hasAiGroup}
                            className={`option-card create-card${hasAiGroup ? ' disabled-card' : ''}`}
                            data-testid="create-ai-group-card"
                            style={{ cursor: (creatingAiGroup || hasAiGroup) ? (hasAiGroup ? 'not-allowed' : 'wait') : 'pointer', width: '100%' }}
                        >
                            {hasAiGroup && (
                                <span className="ai-group-joined-badge" data-testid="ai-group-joined-badge">
                                    {t('groupOptions.aiGroupAlreadyJoinedBadge')}
                                </span>
                            )}
                            <div className="icon option-icon-img-wrapper">
                                <img src="/images/ai-mascot-without-background.webp" alt="AI Mascot" className="option-icon-img" onError={(e) => { (e.target as HTMLImageElement).src = '/images/mascot.webp'; }} />
                            </div>
                            <h3>{t('groupOptions.aiGroupTitle')}</h3>
                            <p>{t('groupOptions.aiGroupDesc')}</p>
                            {hasAiGroup && (
                                <span className="ai-group-joined-note">
                                    {t('groupOptions.aiGroupAlreadyJoinedNote')}
                                </span>
                            )}
                        </button>
                    </div>

                    <div className="option-wrapper create-wrapper">
                        <div className="card-mascot">
                            <Mascot
                                userData={userData}
                                customMessage={t('mascot.createGroupPrompt2')}
                                reversed={true}
                            />
                        </div>
                        <Link to={`/${language}/group-form`} className="option-card create-card" data-testid="create-group-card" style={{ width: '100%' }}>
                            <div className="icon">✨</div>
                            <h3>{t('groupOptions.createGroupTitle')}</h3>
                            <p>{t('groupOptions.createGroupDesc')}</p>
                        </Link>
                    </div>
                </div>

                <Link to={`/${language}/dashboard`} className="back-link">
                    {t('groupOptions.backToDashboard')}
                </Link>
            </div>

            <WelcomeStoryModal
                isOpen={showWelcomeStory}
                onClose={handleCloseWelcomeStory}
                userData={userData}
            />
        </div>
    );
};

export default GroupOptions;
