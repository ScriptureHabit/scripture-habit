import { useState, useEffect, FC } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { UilPlus, UilPen } from '@iconscout/react-unicons';
import Sidebar from '../sidebar/Sidebar';
import GroupChat from '../groupchat/GroupChat';
import './Dashboard.css';
import { toast } from 'react-toastify';

import NewNote from '../newnote/NewNote';
import MyNotes from '../mynotes/MyNotes';
import Profile from '../profile/Profile';
import { getGospelLibraryUrl } from '../../utils/gospelLibraryMapper';
import { useLanguage } from '../../context/LanguageContext';
import { getTodayReadingPlan } from '../../data/DailyReadingPlan';
import WelcomeStoryModal from '../welcomestorymodal/WelcomeStoryModal';
import Donate from '../donate/Donate';
import Mascot from '../mascot/Mascot';
import Footer from '../footer/Footer';
import { DashboardSkeleton } from '../skeleton/Skeleton';
import NotificationPromptModal from './NotificationPromptModal';

// Hooks
import { useDashboardSync } from './hooks/useDashboardSync';
import { useDashboardGroups } from './hooks/useDashboardGroups';
import { useDashboardNotifications } from './hooks/useDashboardNotifications';
import { useDashboardHabitPace } from './hooks/useDashboardHabitPace';
import { useDashboardWarnings } from './hooks/useDashboardWarnings';
import { useDashboardInvitations } from './hooks/useDashboardInvitations';
import { useDashboardActions } from './hooks/useDashboardActions';

const Dashboard: FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, language, isLoaded, translateChapterField } = useLanguage();

  // Initialize state from URL query parameters or location state
  const getInitialState = () => {
    const gid = searchParams.get('groupId');
    const viewParam = searchParams.get('view');
    const openNewNote = searchParams.get('openNewNote');

    return {
      activeGroupId: gid || location.state?.initialGroupId || null as string | null,
      selectedView: gid ? 2 : (viewParam ? parseInt(viewParam) : (location.state?.initialView !== undefined ? location.state.initialView : 0)),
      isModalOpen: openNewNote === 'true'
    };
  };

  const initialState = getInitialState();
  const [selectedView, setSelectedView] = useState<number>(initialState.selectedView);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(initialState.isModalOpen);

  const [showWelcomeStory, setShowWelcomeStory] = useState<boolean>(false);
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState<boolean>(false);
  const [newNickname, setNewNickname] = useState<string>('');
  const [unityOverrides, setUnityOverrides] = useState<Record<string, number>>({});

  // 1. Core Sync Hook
  const syncState = useDashboardSync();
  const loading = syncState.status === 'loading';
  const error = syncState.status === 'error' ? syncState.message : null;
  const user = syncState.user;
  const userData = syncState.userData;

  // 2. Groups Hook
  const { userGroups, activeGroupId, setActiveGroupId, loadingGroupStates } = useDashboardGroups(userData, initialState.activeGroupId);

  // 3. Habit Pace Hook
  const { 
    showAutoKickModal, setShowAutoKickModal, 
    autoKickStep, setAutoKickStep,
    selectedKickDays, setSelectedKickDays,
    kickConfirmInput, setKickConfirmInput,
    autoKickError,
    handleAutoKickSubmit 
  } = useDashboardHabitPace(userData, loading, false, t);

  // 4. Invitation Hook
  const { isJoiningInvite } = useDashboardInvitations(user, userData, showWelcomeStory, setActiveGroupId, setSelectedView, t);

  // 5. Warnings Hook
  const { warnings } = useDashboardWarnings(userData, userGroups);

  // 6. Notifications Hook
  const { 
    latestNoteNotification,
    setLatestNoteNotification,
    showNotifPrompt, 
    handleEnableNotifications, handleCloseNotifPrompt 
  } = useDashboardNotifications(userData, userGroups, selectedView, loading, showWelcomeStory, showAutoKickModal, isJoiningInvite, loadingGroupStates, activeGroupId, t);

  const { markWelcomeStorySeen, updateNickname, syncNotificationReadStatus } = useDashboardActions(user, userData);

  const todayPlan = getTodayReadingPlan();

  const getReadingPlanUrl = (script: string) => {
    return getGospelLibraryUrl(null, script, language);
  };

  useEffect(() => {
    if (location.state?.initialView !== undefined) {
      setSelectedView(location.state.initialView);
    }
    if (location.state?.initialGroupId) {
      setActiveGroupId(location.state.initialGroupId);
    }

    if (searchParams.has('groupId') || searchParams.has('openNewNote') || searchParams.has('view')) {
      navigate(location.pathname, { replace: true });
    }
  }, [searchParams, location.pathname, location.state, navigate, setActiveGroupId]);

  useEffect(() => {
    if (!loading && userData && userData.uid && userData.hasSeenWelcomeStory === undefined && userData.hasSetKickThreshold === true) {
      const timer = setTimeout(() => setShowWelcomeStory(true), 500);
      return () => clearTimeout(timer);
    }
  }, [userData, loading, setShowWelcomeStory]);

  // Body class manipulation for modals should ideally be managed via contexts or head components,
  // but we'll remove direct DOM manipulation to maintain proper React data flow.
  // We recommend using custom hooks (e.g. useScrollLock) or <dialog> instead of data-attributes on body.

  const handleCloseWelcomeStory = async () => {
    setShowWelcomeStory(false);
    if (await markWelcomeStorySeen()) {
      // no-op: state update already handled by external sync
    }
  };

  const handleUnityUpdate = (percentage: number) => {
    if (activeGroupId && unityOverrides[activeGroupId] !== percentage) {
      setUnityOverrides(prev => ({ ...prev, [activeGroupId]: percentage }));
    }
  };

  const handleUpdateProfile = async () => {
    if (!newNickname.trim() || !user || !userData) return;
    const success = await updateNickname(newNickname);
    if (success) {
      toast.success(t('groupChat.nicknameChanged'));
      setShowEditProfileModal(false);
      setNewNickname('');
    }
  };

  if (loading || !isLoaded) {
    return (
      <div className='App Dashboard'>
        <div className='AppGlass Grid'>
          <Sidebar
            selected={selectedView}
            setSelected={setSelectedView}
            userGroups={[]}
            activeGroupId={activeGroupId}
            setActiveGroupId={setActiveGroupId}
            userData={userData}
          />
          <DashboardSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    const isQuotaError = error.toLowerCase().includes('quota exceeded') || error.toLowerCase().includes('resource-exhausted');
    if (isQuotaError) {
      return (
        <div className='App Dashboard error-screen-container'>
          <div className='AppGlass error-glass-card'>
            <div className="error-icon-large">🛠️</div>
            <h2 className="error-title-large">{t('systemErrors.quotaExceededTitle')}</h2>
            <p className="error-message-detail">{t('systemErrors.quotaExceededMessage')}</p>
            <button onClick={() => window.location.reload()} className="retry-btn">Retry</button>
          </div>
        </div>
      );
    }
    return <div className='App Dashboard error-screen-container'>Error: {error}</div>;
  }

  if (!user) {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    return <Navigate to={isStandalone ? "/welcome" : "/"} replace />;
  }

  if (!userData) return null;

  // Enrich userGroups with real-time unity scores from active sessions
  const enrichedUserGroups = userGroups.map(group => {
    if (unityOverrides[group.id] !== undefined) {
      return { ...group, unityPercentageOverride: unityOverrides[group.id] };
    }
    return group;
  });

  const hasGroups = enrichedUserGroups.length > 0;

  return (
    <>
      <div className={`AppGlass Grid ${selectedView === 2 ? 'view-fixed' : ''}`}>
        <Sidebar
          selected={selectedView}
          setSelected={setSelectedView}
          userGroups={enrichedUserGroups}
          activeGroupId={activeGroupId}
          setActiveGroupId={setActiveGroupId}
          hideMobile={isInputFocused || isJoiningInvite}
          userData={userData}
        />
        <div className={`DashboardContent ${selectedView === 2 ? 'group-chat-view' : ''}`}>
          {selectedView === 0 && (
            <div className="dashboard-view-content">
              {isJoiningInvite && (
                <div className="joining-overlay">
                  <div className="loading-spinner"></div>
                  <h3 title="Joining group...">{t('joinGroup.joiningFromInvite')}</h3>
                </div>
              )}
            <div className="dashboard-inner-wrapper">
              <div className="dashboard-header dashboard-header-main">
              <div>
                <h2 className="dashboard-title-text">Scripture Habit</h2>
                <p className="welcome-text welcome-text-small">
                  {t('dashboard.welcomeBack')}, <strong>{userData.nickname}</strong>!
                  <button title="Edit Profile" className="edit-profile-btn" onClick={() => { setNewNickname(userData.nickname || ''); setShowEditProfileModal(true); }}>
                    <UilPen size="16" />
                  </button>
                </p>
              </div>
            </div>

            {warnings.length > 0 && (
              <div className="warning-banner">
                {warnings.map((warn, i) => (
                  <div key={i}>{t('dashboard.inactivityWarning', { name: warn.name, hours: warn.hoursRemaining })}</div>
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
                    className="mini-progress-fill mini-progress-fill-transition"
                    style={{ width: `${((userData.daysStudiedCount || 0) % 7) / 7 * 100}%` }}
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

              {latestNoteNotification && (
                <div
                  className="note-notification"
                  onClick={async () => {
                    const gid = latestNoteNotification.groupId;
                    const totalMsgs = latestNoteNotification.totalMessages;

                    setActiveGroupId(gid);
                    setSelectedView(2);
                    if (setLatestNoteNotification) setLatestNoteNotification(null);

                    if (user && gid != null) {
                      await syncNotificationReadStatus(gid, totalMsgs);
                    }
                  }}
                >
                  <span>{latestNoteNotification.type === 'note' ? '📖' : '💬'}</span>
                  {t(latestNoteNotification.type === 'note' ? 'dashboard.postedANote' : 'dashboard.sentAMessage', { nickname: latestNoteNotification.nickname })}
                </div>
              )}

              <div className="inspiration-card inspiration-interactive-card"
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
            </div>
          )}

          {selectedView === 1 && <MyNotes userData={userData} isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen} userGroups={enrichedUserGroups} />}
          {selectedView === 2 && activeGroupId && <GroupChat groupId={activeGroupId} userData={userData} userGroups={enrichedUserGroups} onInputFocusChange={setIsInputFocused} isExternalModalOpen={isModalOpen} onBack={() => setSelectedView(0)} onGroupSelect={(gid) => setActiveGroupId(gid)} initialShowInviteModal={!!location.state?.showInviteModal} onUnityUpdate={handleUnityUpdate} />}
          {selectedView === 3 && <Profile userData={userData} stats={{ streak: userData?.streakCount || 0, totalNotes: userData?.totalNotes || 0, daysStudied: userData?.daysStudiedCount || 0 }} />}
          {selectedView === 4 && <Donate userData={userData} />}
        </div>
      </div>

      <NewNote isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} userData={userData} userGroups={enrichedUserGroups} />
      <WelcomeStoryModal isOpen={showWelcomeStory} onClose={handleCloseWelcomeStory} userData={userData} />
      <NotificationPromptModal isOpen={showNotifPrompt} onConfirm={handleEnableNotifications} onClose={handleCloseNotifPrompt} t={t} />

      {showEditProfileModal && (
        <div className="leave-modal-overlay">
          <div className="leave-modal-content">
            <h3>{t('groupChat.changeNickname')}</h3>
            <input type="text" className="delete-confirmation-input" value={newNickname} onChange={(e) => setNewNickname(e.target.value)} placeholder={t('groupChat.enterNewNickname')} />
            <div className="leave-modal-actions">
              <button className="modal-btn cancel" onClick={() => setShowEditProfileModal(false)}>{t('groupChat.cancel')}</button>
              <button className="modal-btn primary" onClick={handleUpdateProfile} disabled={!newNickname.trim() || newNickname === userData.nickname}>{t('groupChat.save')}</button>
            </div>
          </div>
        </div>
      )}

      {showAutoKickModal && (
        <div className="leave-modal-overlay">
          <div className="leave-modal-content auto-kick-setup">
            {autoKickStep === 0 ? (
              <>
                <h2 className="auto-kick-init-title-styled">{t('groupChat.autoKickInitTitle')}</h2>
                <p className="auto-kick-init-desc-styled">{t('groupChat.autoKickInitDesc')}</p>
                <div className="auto-kick-grid-options-styled">
                  {[3, 5, 7].map(d => (
                    <button 
                      key={d} 
                      onClick={() => setSelectedKickDays(d)} 
                      className={`auto-kick-day-option-styled ${selectedKickDays === d ? 'selected' : 'unselected'}`}
                    >
                      {d} {t('dashboard.days')}
                    </button>
                  ))}
                </div>
                <button className="modal-btn primary mt-2 w-100" onClick={() => setAutoKickStep(1)}>{t('groupChat.next')}</button>
              </>
            ) : autoKickStep === 1 ? (
              <>
                <h2 className="auto-kick-init-title-styled">{t('groupChat.autoKickConfirmTitle')}</h2>
                <p className="auto-kick-confirm-warning-styled">{t('groupChat.autoKickWarning')}</p>
                <p className="mt-1">{t('groupChat.autoKickConfirmText').replace('{days}', selectedKickDays.toString())}</p>
                <input type="number" title="Days Threshold" placeholder="7" className="delete-confirmation-input auto-kick-confirm-input-styled" value={kickConfirmInput} onChange={(e) => setKickConfirmInput(e.target.value)} />
                {autoKickError && <p className="auto-kick-error-text-styled">{autoKickError}</p>}
                <button className="modal-btn primary mt-1 w-100" onClick={handleAutoKickSubmit}>{t('groupChat.save')}</button>
              </>
            ) : (
              <div className="text-center p-1">
                <p className="font-bold-large">{t('groupChat.autoKickSuccess')}</p>
                <button className="modal-btn primary mt-1" onClick={() => setShowAutoKickModal(false)}>OK</button>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedView !== 2 && <Footer />}
    </>
  );
};

export default Dashboard;
