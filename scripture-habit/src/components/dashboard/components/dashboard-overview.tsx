import { Link } from 'react-router-dom';
import { UilPlus, UilPen } from '@iconscout/react-unicons';
import Mascot from '../../mascot/mascot';
import { UserData } from '../../../types/user';
import StreakCalendar from './streak-calendar';
import { QuestCard } from './quest-card';
import { useModalStore } from '../../../store/use-modal-store';
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
  onGoToGroupChat
}: DashboardOverviewProps) => {
  const { activeModal } = useModalStore();
  const isAnyModalOpen = hasActiveModal || !!activeModal;

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
        <div className="stat-card level-card">
          <h3>{t('profile.level')}</h3>
          <div className="streak-value">
            <span className="number">
              {Math.floor((userData.daysStudiedCount || 0) / 7) + 1}
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

      <div className="inspiration-section">
        <Mascot
          userData={userData}
          onClick={() => setShowWelcomeStory(true)}
        />

        {!hasGroups && (
          <div className="no-group-cta">
            <p>{t('dashboard.joinGroupStudy')}</p>
            <Link to="/group-options">
              <button className="cta-btn">{t('dashboard.joinCreateGroup')}</button>
            </Link>
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
          <div className="inspiration-status-badge">
            <span className="typing-dots">
              <span className="dot dot-1">.</span>
              <span className="dot dot-2">.</span>
              <span className="dot dot-3">.</span>
            </span>
          </div>
        </div>
      </div>

      {/* Compute active onboarding state */}
      {(() => {
        const step1Done = !!userData?.questCreatedGroup || (userData?.groupIds && userData?.groupIds.length > 0) || !!userData?.groupId;
        const step2Done = !!userData?.questPostedNote || (!userData?.isAnonymousDemo && !!(userData?.totalNotes && userData?.totalNotes > 0));
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
