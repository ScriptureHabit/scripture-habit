import { useState, useEffect, FC } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { UilPlus, UilPen } from '@iconscout/react-unicons';
import Sidebar from '../Sidebar/Sidebar';
import GroupChat from '../GroupChat/GroupChat';
import './Dashboard.css';
import { toast } from 'react-toastify';

import NewNote from '../NewNote/NewNote';
import MyNotes from '../MyNotes/MyNotes';
import Profile from '../Profile/Profile';
import { getGospelLibraryUrl } from '../../Utils/gospelLibraryMapper';
import { useLanguage } from '../../Context/LanguageContext';
import { getTodayReadingPlan } from '../../Data/DailyReadingPlan';
import WelcomeStoryModal from '../WelcomeStoryModal/WelcomeStoryModal';
import Donate from '../Donate/Donate';
import Mascot from '../Mascot/Mascot';
import Footer from '../Footer/Footer';
import { DashboardSkeleton } from '../Skeleton/Skeleton';
import NotificationPromptModal from './NotificationPromptModal';

// Hooks
import { useDashboardSync } from './hooks/useDashboardSync';
import { useDashboardGroups } from './hooks/useDashboardGroups';
import { useDashboardNotifications } from './hooks/useDashboardNotifications';
import { useDashboardHabitPace } from './hooks/useDashboardHabitPace';
import { useDashboardWarnings } from './hooks/useDashboardWarnings';
import { useDashboardInvitations } from './hooks/useDashboardInvitations';

const Dashboard: FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, language, isLoaded, translateChapterField } = useLanguage();

  // Initialize state from URL query parameters or location state
  const getInitialState = () => {
    const searchParams = new URLSearchParams(location.search);
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

  // 1. Core Sync Hook
  const { user, userData, loading, error } = useDashboardSync();

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
  } = useDashboardHabitPace(userData, loading, false /* placeholder for isJoiningInvite until hook 6 */, t);

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
  } = useDashboardNotifications(userData, userGroups, selectedView, loading, showWelcomeStory, showAutoKickModal, isJoiningInvite, loadingGroupStates, t);

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

    const searchParams = new URLSearchParams(location.search);
    if (searchParams.has('groupId') || searchParams.has('openNewNote') || searchParams.has('view')) {
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, location.state, navigate]);

  useEffect(() => {
    if (!loading && userData && userData.uid && userData.hasSeenWelcomeStory === undefined && userData.hasSetKickThreshold === true) {
      setTimeout(() => setShowWelcomeStory(true), 500);
    }
  }, [userData, loading]);

  useEffect(() => {
    const isAnyModalOpen = showWelcomeStory || showAutoKickModal || showNotifPrompt || isJoiningInvite || showEditProfileModal || isModalOpen;
    if (isAnyModalOpen) {
      document.body.setAttribute('data-dashboard-modal-open', 'true');
    } else {
      document.body.removeAttribute('data-dashboard-modal-open');
    }
  }, [showWelcomeStory, showAutoKickModal, showNotifPrompt, isJoiningInvite, showEditProfileModal, isModalOpen]);

  const handleCloseWelcomeStory = async () => {
    setShowWelcomeStory(false);
    if (user && userData && userData.hasSeenWelcomeStory === undefined) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          hasSeenWelcomeStory: true
        });
      } catch (error) {
        console.error("Error marking welcome story as seen:", error);
      }
    }
  };

  const handleUpdateProfile = async () => {
    if (!newNickname.trim() || !user || !userData) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        nickname: newNickname.trim()
      });
      toast.success(t('groupChat.nicknameChanged'));
      setShowEditProfileModal(false);
      setNewNickname('');
    } catch (error: any) {
      console.error("Error updating nickname:", error);
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
        <div className='App Dashboard' style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className='AppGlass' style={{
            padding: '2rem', textAlign: 'center', maxWidth: '500px', width: '90%',
            background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(15px)',
            borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.4)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)', display: 'flex', flexDirection: 'column', gap: '1.5rem'
          }}>
            <div style={{ fontSize: '3rem' }}>🛠️</div>
            <h2 style={{ color: '#2d3748', margin: 0, fontSize: '1.5rem', fontWeight: '800' }}>{t('systemErrors.quotaExceededTitle')}</h2>
            <p style={{ color: '#4a5568', margin: 0, lineHeight: '1.6', fontSize: '1rem' }}>{t('systemErrors.quotaExceededMessage')}</p>
            <button onClick={() => window.location.reload()} className="retry-btn">Retry</button>
          </div>
        </div>
      );
    }
    return <div className='App Dashboard'>Error: {error}</div>;
  }

  if (!user) {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    return <Navigate to={isStandalone ? "/welcome" : "/"} replace />;
  }

  if (!userData) return null;

  const hasGroups = (userData.groupIds && userData.groupIds.length > 0) || userData.groupId;

  return (
    <>
      <div className='AppGlass Grid'>
        <Sidebar
          selected={selectedView}
          setSelected={setSelectedView}
          userGroups={userGroups}
          activeGroupId={activeGroupId}
          setActiveGroupId={setActiveGroupId}
          hideMobile={isInputFocused || isJoiningInvite}
          userData={userData}
        />
        {selectedView === 0 && (
          <div className="DashboardContent">
            {isJoiningInvite && (
              <div className="joining-overlay">
                <div className="loading-spinner"></div>
                <h3>{t('joinGroup.joiningFromInvite')}</h3>
              </div>
            )}
            <div className="dashboard-inner-wrapper">
              <div className="dashboard-header" style={{ paddingTop: '20px' }}>
              <div>
                <h2 style={{ fontSize: '2.4rem', fontWeight: 'bold', color: '#242d49', margin: '0 0 10px 0', display: 'block' }}>
                  Scripture Habit
                </h2>
                <p className="welcome-text" style={{ marginTop: '0' }}>
                  {t('dashboard.welcomeBack')}, <strong>{userData.nickname}</strong>!
                  <button className="edit-profile-btn" onClick={() => { setNewNickname(userData.nickname || ''); setShowEditProfileModal(true); }}>
                    <UilPen size="16" />
                  </button>
                </p>
              </div>
            </div>

            {warnings.length > 0 && (
              <div className="warning-banner">
                {warnings.map((warn, i) => (
                  <div key={i}>⚠️ {language === 'ja'
                    ? `【警告】${warn.name}での活動が${Math.max(1, warn.days)}日以上ありません。今日投稿しないと退出になります！`
                    : `Warning: You have been inactive in ${warn.name} for over ${Math.max(1, warn.days)} days.`}
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
                    className="mini-progress-fill"
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

                    if (userData?.uid) {
                      try {
                        const userGroupStateRef = doc(db, 'users', userData.uid, 'groupStates', gid);
                        const groupRef = doc(db, 'groups', gid);

                        await Promise.all([
                          setDoc(userGroupStateRef, {
                            readMessageCount: totalMsgs,
                            lastReadAt: serverTimestamp()
                          }, { merge: true }),
                          updateDoc(groupRef, {
                            [`memberLastReadAt.${userData.uid}`]: serverTimestamp()
                          })
                        ]);
                      } catch (err: any) {
                        console.error("Background read status update failed:", err);
                      }
                    }
                  }}
                >
                  <span>{latestNoteNotification.type === 'note' ? '📖' : '💬'}</span>
                  {t(latestNoteNotification.type === 'note' ? 'dashboard.postedANote' : 'dashboard.sentAMessage', { nickname: latestNoteNotification.nickname })}
                </div>
              )}

              <div className="inspiration-card"
                style={{ position: 'relative', cursor: 'pointer', transition: 'transform 0.2s' }}
                onClick={() => setShowWelcomeStory(true)}
              >
                <blockquote className="inspiration-quote">
                  {t('dashboard.inspirationQuote')}
                </blockquote>
                <p className="inspiration-source">{t('dashboard.inspirationSource')}</p>
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '10px',
                  background: 'white',
                  padding: '2px 8px',
                  borderRadius: '12px 12px 12px 0',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  color: '#4A5568',
                  border: '1px solid #E2E8F0',
                  minWidth: '24px',
                  textAlign: 'center'
                }}>
                  <span className="typing-dots"></span>
                </div>
              </div>
            </div>

            <div className="dashboard-split-row">
              <div className="reading-plan-section">
                <div className="reading-plan-card" style={{
                  background: 'rgba(255, 255, 255, 0.6)',
                  padding: '1.2rem',
                  borderRadius: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  backdropFilter: 'blur(10px)',
                  textAlign: 'center'
                }}>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', color: '#4a5568' }}>{t('dashboard.todaysComeFollowMe')}</h3>
                  {todayPlan ? (
                    <div>
                      <p style={{ fontSize: '0.9rem', color: '#718096', marginBottom: '0.5rem' }}>{todayPlan.date}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center' }}>
                        {todayPlan.scripts.map((script, idx) => {
                          const url = getReadingPlanUrl(script);
                          const displayScript = translateChapterField(script);

                          return (
                            <a
                              key={idx}
                              href={url || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#6B46C1', fontWeight: 'bold', textDecoration: 'none', fontSize: '1.1rem' }}
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

        {selectedView === 1 && <MyNotes userData={userData} isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen} userGroups={userGroups} />}
        {selectedView === 2 && activeGroupId && <GroupChat groupId={activeGroupId} userData={userData} userGroups={userGroups} onInputFocusChange={setIsInputFocused} isExternalModalOpen={isModalOpen} onBack={() => setSelectedView(0)} onGroupSelect={(gid) => setActiveGroupId(gid)} />}
        {selectedView === 3 && <Profile userData={userData} stats={{ streak: userData?.streakCount || 0, totalNotes: userData?.totalNotes || 0, daysStudied: userData?.daysStudied || 0 }} />}
        {selectedView === 4 && <Donate userData={userData} />}
      </div>

      <NewNote isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} userData={userData} userGroups={userGroups} />
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
                <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>{t('groupChat.autoKickInitTitle')}</h2>
                <p style={{ color: 'var(--gray)', lineHeight: '1.6' }}>{t('groupChat.autoKickInitDesc')}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '1.5rem' }}>
                  {[3, 5, 7].map(d => (
                    <button key={d} onClick={() => setSelectedKickDays(d)} style={{ padding: '15px', borderRadius: '12px', border: selectedKickDays === d ? '2px solid var(--pink)' : '1px solid #ddd', background: selectedKickDays === d ? '#ffe0e3' : 'white', fontWeight: 'bold' }}>{d} {t('dashboard.days')}</button>
                  ))}
                </div>
                <button className="modal-btn primary" onClick={() => setAutoKickStep(1)} style={{ marginTop: '2rem', width: '100%' }}>{t('groupChat.next')}</button>
              </>
            ) : autoKickStep === 1 ? (
              <>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>{t('groupChat.autoKickConfirmTitle')}</h2>
                <p style={{ color: '#e53e3e', fontWeight: 'bold' }}>{t('groupChat.autoKickWarning')}</p>
                <p style={{ marginTop: '1rem' }}>{t('groupChat.autoKickConfirmText').replace('{days}', selectedKickDays.toString())}</p>
                <input type="number" className="delete-confirmation-input" style={{ width: '80px', textAlign: 'center', margin: '1rem auto', display: 'block', fontSize: '1.5rem' }} value={kickConfirmInput} onChange={(e) => setKickConfirmInput(e.target.value)} />
                {autoKickError && <p style={{ color: '#e53e3e', fontSize: '0.8rem' }}>{autoKickError}</p>}
                <button className="modal-btn primary" onClick={handleAutoKickSubmit} style={{ marginTop: '1rem', width: '100%' }}>{t('groupChat.save')}</button>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '1rem' }}>
                <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{t('groupChat.autoKickSuccess')}</p>
                <button className="modal-btn primary" onClick={() => setShowAutoKickModal(false)} style={{ marginTop: '1rem' }}>OK</button>
              </div>
            )}
          </div>
        </div>
      )}

      <Footer />
    </>
  );
};

export default Dashboard;