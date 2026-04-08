import { FC, RefObject } from 'react';
import { Link } from 'react-router-dom';
import { UilPlus, UilPen } from '@iconscout/react-unicons';
import Mascot from '../../mascot/Mascot';
import { UserData } from '../../../types/user';

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
  progressRef: RefObject<HTMLDivElement | null>;
}

const DashboardOverview: FC<DashboardOverviewProps> = ({
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
  progressRef
}) => {
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
            <span className="number">{userData.streakCount || 0}</span>
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
              ref={progressRef}
              className="mini-progress-fill mini-progress-fill-transition"
            ></div>
          </div>
        </div>
      </div>

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
            <span className="typing-dots"></span>
          </div>
        </div>
      </div>

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

        <div className="share-learning-cta">
          <p>{t('dashboard.shareLearningCall')}</p>
          <button className="new-note-btn cta-btn" onClick={() => setIsModalOpen(true)}>
            <UilPlus /> {t('dashboard.newNote')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
