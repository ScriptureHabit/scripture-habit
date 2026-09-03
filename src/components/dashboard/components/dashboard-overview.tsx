import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UilPlus, UilPen } from '@iconscout/react-unicons';
import { toast } from 'react-toastify';
import axios from 'axios';
import apiClient from '../../../utils/api-client';
import Mascot from '../../mascot/mascot';
import { UserData, RecentGroupInfo } from '../../../types/user';
import StreakCalendar from './streak-calendar';
import { QuestCard } from './quest-card';
import { TimeCapsuleCard } from './time-capsule-card';
import { useModalStore } from '../../../store/use-modal-store';
import { useLevelUpStore } from '../../../store/use-level-up-store';
import { useLanguage } from '../../../hooks/use-language';
import { calculateLevel } from '../../../utils/level-utils';
import './quest-card.css';

interface DashboardOverviewProps {
  t: (key: string, replacements?: Record<string, string | number>) => string;
  userData: UserData;
  warnings: Array<{ name: string; hoursRemaining: number }>;
  todayPlan: { date: string; scripts: string[] } | null;
  getReadingPlanUrl: (script: string) => string | null;
  translateChapterField: (field: string) => string;
  isJoiningInvite: boolean;
  hasGroups: boolean;
  setIsModalOpen: (open: boolean) => void;
  setShowWelcomeStory: (show: boolean) => void;
  setShowEditProfileModal: (show: boolean) => void;
  setNewNickname: (name: string) => void;
  kickDate?: string | null;
  hasActiveModal?: boolean;
  onGoToGroupChat?: () => void;
  onRejoinSuccess?: (groupId: string) => void;
  onClearRecentGroup?: () => Promise<boolean> | void;
}

const DashboardOverview = ({
  t,
  userData,
  warnings,
  todayPlan,
  getReadingPlanUrl,
  translateChapterField,
  isJoiningInvite,
  hasGroups,
  setIsModalOpen,
  setShowWelcomeStory,
  setShowEditProfileModal,
  setNewNickname,
  kickDate,
  hasActiveModal = false,
  onGoToGroupChat,
  onRejoinSuccess,
  onClearRecentGroup
}: DashboardOverviewProps) => {
  const { activeModal } = useModalStore();
  const { language } = useLanguage();
  const isAnyModalOpen = hasActiveModal || !!activeModal;
  const [isRejoining, setIsRejoining] = useState(false);

  const handleRejoin = async (recentGroup: RecentGroupInfo) => {
    if (isRejoining) return;
    setIsRejoining(true);
    try {
      if (recentGroup.isAiGroup) {
        // AI groups: create new AI group
        const res = await apiClient.post('/api/groups/create-ai-group', {});
        if (res.data?.groupId) {
          toast.success(t('dashboard.rejoinSuccess'));
          onRejoinSuccess?.(res.data.groupId);
        }
      } else {
        // Regular group: one-tap rejoin
        const res = await apiClient.post('/api/groups/rejoin-group', { groupId: recentGroup.id });
        if (res.data?.gid) {
          toast.success(t('dashboard.rejoinSuccess'));
          onRejoinSuccess?.(res.data.gid);
        }
      }
    } catch (err: unknown) {
      console.error('Error rejoining group:', err);
      let errorCode = '';
      if (axios.isAxiosError(err)) {
        errorCode = err.response?.data?.code || '';
      }

      if (errorCode === 'GROUP_FULL') {
        toast.error(t('dashboard.groupFullRejoin'));
      } else if (errorCode === 'GROUP_NOT_FOUND' || errorCode === 'GROUP_DELETED') {
        toast.error(t('dashboard.groupDeletedRejoin'));
        // Clear deleted group from user doc via action hook
        await onClearRecentGroup?.();
      } else {
        const fallbackMsg = axios.isAxiosError(err) ? err.response?.data?.error : null;
        toast.error(fallbackMsg || t('groupChat.reportError'));
      }
    } finally {
      setIsRejoining(false);
    }
  };

  return (
    <div className="dashboard-inner-wrapper">
      {isJoiningInvite && (
        <div className="joining-overlay">
          <div className="loading-spinner"></div>
          <h3 title="Joining group...">{t('joinGroup.joiningFromInvite')}</h3>
        </div>
      )}
      
      <div className="dashboard-header dashboard-header-main">
        <div>
          <h2 className="dashboard-title-text">Scripture Habit</h2>
          <p className="welcome-text welcome-text-small">
            {t('dashboard.welcomeBack')}, <strong>{userData.nickname}</strong>!
            <button 
              title="Edit Profile" 
              className="edit-profile-btn" 
              onClick={() => { 
                setNewNickname(userData.nickname || ''); 
                setShowEditProfileModal(true); 
              }}
            >
              <UilPen size="16" />
            </button>
          </p>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="warning-banner">
          {warnings.map((warn, i) => (
            <div key={i}>
              {t('dashboard.inactivityWarning', { name: warn.name, hours: warn.hoursRemaining })}
            </div>
          ))}
        </div>
      )}

      <div className="dashboard-stats">
        <div className="stat-card streak-card">
          <h3>{t('dashboard.streak')}</h3>
          <div className="streak-value">
            <span className="number">{userData.daysStudiedCount || 0}</span>
            <span className="label">{t('dashboard.days')}</span>
          </div>
        </div>
        <div 
          className="stat-card level-card"
          onClick={() => {
            const days = userData.daysStudiedCount || 0;
            const currentLevel = calculateLevel(days);
            useLevelUpStore.getState().openLevelUp({
              level: currentLevel,
              days,
              nickname: userData.nickname || ''
            });
          }}
          style={{ cursor: 'pointer' }}
          title={t('levelUp.viewCard')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              const days = userData.daysStudiedCount || 0;
              const currentLevel = calculateLevel(days);
              useLevelUpStore.getState().openLevelUp({
                level: currentLevel,
                days,
                nickname: userData.nickname || ''
              });
            }
          }}
        >
          <h3>{t('profile.level')}</h3>
          <div className="streak-value">
            <span className="number">
              {calculateLevel(userData.daysStudiedCount || 0)}
            </span>
            <span className="label">Lv</span>
          </div>
          <div className="mini-progress-bar">
            <div
              className="mini-progress-fill mini-progress-fill-transition"
              style={{ width: `${((userData.daysStudiedCount || 0) % 7) / 7 * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      <QuestCard 
        userData={userData} 
        t={t} 
        setIsModalOpen={setIsModalOpen} 
        hasActiveModal={isAnyModalOpen} 
        onGoToGroupChat={onGoToGroupChat}
      />

      <TimeCapsuleCard
        userData={userData}
        warnings={warnings}
        setIsModalOpen={setIsModalOpen}
      />

      <div className="inspiration-section">
        <Mascot
          userData={userData}
          onClick={() => setShowWelcomeStory(true)}
        />

        {!hasGroups && (
          <div className="no-group-cta">
            {userData?.lastRecentGroup ? (
              <>
                <p>
                  {userData.lastRecentGroup.isAiGroup
                    ? t('dashboard.rejoinAiGroupPrompt')
                    : t('dashboard.rejoinGroupPrompt', { groupName: userData.lastRecentGroup.name })}
                </p>
                <div className="cta-buttons-container">
                  <button
                    className="cta-btn"
                    onClick={() => handleRejoin(userData.lastRecentGroup!)}
                    disabled={isRejoining}
                  >
                    {isRejoining ? t('dashboard.rejoiningBtn') : t('dashboard.rejoinBtn')}
                  </button>
                  <Link to={`/${language}/group-options`}>
                    <button className="cta-btn secondary-cta-btn">
                      {t('dashboard.findOrCreateOtherGroup')}
                    </button>
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p>{t('dashboard.joinGroupStudy')}</p>
                <Link to={`/${language}/group-options`}>
                  <button className="cta-btn">{t('dashboard.joinCreateGroup')}</button>
                </Link>
              </>
            )}
          </div>
        )}

        <div 
          className="inspiration-card inspiration-interactive-card"
          onClick={() => setShowWelcomeStory(true)}
        >
          <blockquote className="inspiration-quote">
            {t('dashboard.inspirationQuote')}
          </blockquote>
          <p className="inspiration-source">{t('dashboard.inspirationSource')}</p>
        </div>
      </div>

      {/* Compute active onboarding state */}
      {(() => {
        const step1Done = !!userData?.questCreatedGroup || (userData?.groupIds && userData?.groupIds.length > 0) || !!userData?.groupId;
        const step2Done = !!userData?.questPostedNote;
        const isLegacyCompleted = !userData?.isAnonymousDemo && !userData?.questCreatedGroup && !userData?.questPostedNote &&
          (userData?.totalNotes && userData?.totalNotes > 0) &&
          ((userData?.groupIds && userData?.groupIds.length > 0) || !!userData?.groupId);
        const isStep2Active = !userData?.hasCompletedOnboarding && !isLegacyCompleted && step1Done && !step2Done && !isAnyModalOpen;

        return (
          <div className="dashboard-split-row">
            <div className="reading-plan-section">
              <div className="reading-plan-card reading-plan-card-inner-box">
                <h3 className="reading-plan-title-styled">{t('dashboard.todaysComeFollowMe')}</h3>
                {todayPlan ? (
                  <div>
                    <p className="reading-plan-date-detail">{todayPlan.date}</p>
                    <div className="reading-plan-links-container">
                      {todayPlan.scripts.map((script, idx) => {
                        const url = getReadingPlanUrl(script);
                        const displayScript = translateChapterField(script);

                        return (
                          <a
                            key={idx}
                            href={url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="reading-plan-link-item"
                          >
                            {displayScript}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p>{t('dashboard.noReadingPlan')}</p>
                )}
              </div>
            </div>

            <div className={`share-learning-cta ${isStep2Active ? 'spotlight-elevated' : ''}`}>
              <p>{t('dashboard.shareLearningCall')}</p>
              <div className="new-note-btn-wrapper">
                <button 
                  className={`new-note-btn cta-btn ${isStep2Active ? 'glow-active' : ''}`} 
                  onClick={() => setIsModalOpen(true)} 
                  data-testid="new-note-button"
                >
                  <UilPlus /> {t('dashboard.newNote')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <StreakCalendar 
        studiedDates={userData.studiedDates} 
        kickDate={kickDate}
        t={t} 
      />
    </div>
  );
};

export default DashboardOverview;
