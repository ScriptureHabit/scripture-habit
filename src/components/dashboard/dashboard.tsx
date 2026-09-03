import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { lazyWithRetry } from '../../utils/lazy-with-retry';

// Core Dashboard Components (Synchronous for instant Overview render)
import Footer from '../footer/footer';
import { DashboardSkeleton } from '../skeleton/skeleton';
import Sidebar from '../sidebar/sidebar';
import DashboardLayout from './components/dashboard-layout';
import DashboardOverview from './components/dashboard-overview';

// Lazy-loaded Sub-components and Modals (Split into lightweight on-demand chunks)
const GroupChat = lazyWithRetry(() => import('../groupchat/group-chat'));
const NewNote = lazyWithRetry(() => import('../newnote/new-note'));
const MyNotes = lazyWithRetry(() => import('../mynotes/my-notes'));
const Profile = lazyWithRetry(() => import('../profile/profile'));
const Donate = lazyWithRetry(() => import('../donate/donate'));
const DashboardModals = lazyWithRetry(() => import('./components/dashboard-modals'));
const JoinSuccessModal = lazyWithRetry(() => import('../joinsuccessmodal/join-success-modal'));
const MilestoneModal = lazyWithRetry(() => import('../milestone/milestone-modal'));
const LevelUpModal = lazyWithRetry(() => import('../levelup/level-up-modal'));
const TimeCapsuleModal = lazyWithRetry(() => import('../timecapsule/time-capsule-modal').then(m => ({ default: m.TimeCapsuleModal })));
const TimeCapsuleUnlockModal = lazyWithRetry(() => import('../timecapsule/time-capsule-unlock-modal').then(m => ({ default: m.TimeCapsuleUnlockModal })));

// Styles
import './dashboard.css';

// Utils & Stores
import { useModalStore } from '../../store/use-modal-store';
import { useChatStore } from '../../store/use-chat-store';
import { getGospelLibraryUrl } from '../../utils/gospel-library-mapper';
import { useLanguage } from '../../hooks/use-language';
import { getTodayReadingPlan } from '../../data/daily-reading-plan';
import { enrichGroupUnity, calculateNearestKickDate } from '../../utils/group-utils';


// Hooks
import { useDashboardSync } from './hooks/use-dashboard-sync';
import { useDashboardGroups } from './hooks/use-dashboard-groups';
import { useDashboardNotifications } from './hooks/use-dashboard-notifications';
import { useDashboardHabitPace } from './hooks/use-dashboard-habit-pace';
import { useDashboardWarnings } from './hooks/use-dashboard-warnings';
import { useDashboardInvitations } from './hooks/use-dashboard-invitations';
import { useDashboardActions } from './hooks/use-dashboard-actions';
import { useToday } from '../../hooks/use-today';
import { useUnreadAudioAlert } from '../../hooks/use-unread-audio-alert';
import { useLetterAvailability } from '../../hooks/use-letter-availability';
import { useApiWarmupOnMount } from '../../utils/api-warmup';

const Dashboard = () => {
  useApiWarmupOnMount();
  const location = useLocation();
  // Capture these immediately to avoid unmount loops if location.state is cleared
  const initialGroupIdRef = useRef<string | undefined>(location.state?.groupId || location.state?.initialGroupId);
  const initialViewRef = useRef<number | undefined>(location.state?.initialView);
  const initialShowInviteModalRef = useRef<boolean>(!!location.state?.showInviteModal);
  const initialShowJoinSuccessRef = useRef<boolean>(!!location.state?.showJoinSuccessModal);

  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, language, isLoaded, translateChapterField } = useLanguage();
  
  const { activeModal, setActiveModal } = useModalStore();

  const [internalSelectedView, setInternalSelectedView] = useState<number>(() => {
    return location.state?.initialView ?? 0;
  });

  const selectedView = useMemo(() => {
    if (location.pathname.includes('/profile')) return 3;
    const viewParam = searchParams.get('view');
    if (viewParam !== null) {
      const parsed = parseInt(viewParam, 10);
      if (!isNaN(parsed)) return parsed;
    }
    const gid = searchParams.get('groupId') || location.state?.groupId || location.state?.initialGroupId;
    if (gid) return 2;
    return internalSelectedView;
  }, [location.pathname, location.state, searchParams, internalSelectedView]);

  const setSelectedView = (view: number) => {
    setInternalSelectedView(view);
  };
  const [showWelcomeStory, setShowWelcomeStory] = useState<boolean>(false);
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState<boolean>(false);
  const [newNickname, setNewNickname] = useState<string>('');
  const [unityOverrides, setUnityOverrides] = useState<Record<string, number>>({});
  const today = useToday(); // Triggers re-render at midnight local time
  // 0. Consumption of initial state
  const { setShowInviteModal } = useChatStore();

  const [showJoinSuccessModal, setShowJoinSuccessModal] = useState<boolean>(false);
  
  // 1. Core Hooks
  const syncState = useDashboardSync();
  const { user, userData, status } = syncState;
  const { isLetterAvailable } = useLetterAvailability(userData);
  const errorMessage = syncState.status === 'error' ? syncState.message : null;
  const paramGroupId = searchParams.get('groupId') || location.state?.groupId || location.state?.initialGroupId || null;
  const { userGroups, activeGroupId, setActiveGroupId } = useDashboardGroups(userData, paramGroupId);
  const loading = status === 'loading' && !userData;

  useEffect(() => {
    // If we have initialShowInviteModalRef.current=true, we want to show it.
    // We set it in the global store so it persists across re-renders/unmounts of GroupChat.
    if (initialShowInviteModalRef.current && !loading) {
      setShowInviteModal(true);
      initialShowInviteModalRef.current = false; // Consumed
    }

    // Consume navigation state so it doesn't re-trigger on reload/render loop
    if ((initialGroupIdRef.current || initialViewRef.current) && location.state) {
      initialGroupIdRef.current = undefined;
      initialViewRef.current = undefined;
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [loading, setShowInviteModal, location.state, location.pathname, navigate]); // Only on mount/loading change

  // Show join success modal after group chat view is active (from join-group page navigation)
  useEffect(() => {
    if (initialShowJoinSuccessRef.current && !loading && selectedView === 2) {
      const timer = setTimeout(() => {
        setShowJoinSuccessModal(true);
        initialShowJoinSuccessRef.current = false;
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [loading, selectedView]);
  const { 
    showAutoKickModal, autoKickStep, setAutoKickStep,
    selectedKickDays, setSelectedKickDays, handleAutoKickSubmit 
  } = useDashboardHabitPace(userData, loading, false, t);

  const { isJoiningInvite } = useDashboardInvitations(
    user, userData, showWelcomeStory, setActiveGroupId, setSelectedView, t,
    () => {
      // Wait for group chat view to render before showing modal
      setTimeout(() => {
        setShowJoinSuccessModal(true);
      }, 800);
    }
  );
  const { warnings } = useDashboardWarnings(userData, userGroups);

  const referenceDate = useMemo(() => {
    void today;
    return new Date();
  }, [today]);

  const enrichedUserGroups = useMemo(() => {
    return userGroups.map(group => {
      const enriched = enrichGroupUnity(group, group.recentMessages || [], unityOverrides[group.id], referenceDate);
      return {
        ...enriched,
        _date: today
      };
    });
  }, [userGroups, unityOverrides, today, referenceDate]);

  const kickDate = useMemo(() => {
    return calculateNearestKickDate(userData, enrichedUserGroups);
  }, [userData, enrichedUserGroups]);

  const { showNotifPrompt, handleEnableNotifications, handleCloseNotifPrompt } = useDashboardNotifications(userData, t);
  const { markWelcomeStorySeen, updateNickname, clearLastRecentGroup } = useDashboardActions(user, userData);

  // Play unread sound alert on app start (session-capped) and new messages
  useUnreadAudioAlert(enrichedUserGroups, userData?.uid, selectedView === 2, activeGroupId);

  // 2. Effects

  // Clear unity overrides at midnight local time
  useEffect(() => {
    queueMicrotask(() => {
      setUnityOverrides({});
    });
  }, [today]);

  useEffect(() => {
    setActiveModal(null);
  }, [activeGroupId, setActiveModal]);

  useEffect(() => {
    if (searchParams.get('openNewNote') === 'true') {
      setActiveModal('newNote');
      // Clear only transient deep-link modal param
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('openNewNote');
      const nextSearch = nextParams.toString();
      navigate(
        { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '' },
        { replace: true }
      );
    }
  }, [searchParams, location.pathname, navigate, setActiveModal]);

  // 2. Onboarding Modal Flow Evaluator (State Machine Approach)
  useEffect(() => {
    if (loading || !userData || !userData.uid) return;

    const sessionWelcomeSeen = sessionStorage.getItem(`welcome_seen_${userData.uid}`) === 'true';
    const needsWelcomeStory = !sessionWelcomeSeen && (userData.hasSeenWelcomeStory === false || userData.hasSeenWelcomeStory === undefined);
    if (needsWelcomeStory) {
      const timer = setTimeout(() => setShowWelcomeStory(true), 500);
      return () => clearTimeout(timer);
    }
  }, [userData, loading, showAutoKickModal, selectedView]);

  // 3. Handlers
  const handleCloseWelcomeStory = async () => {
    setShowWelcomeStory(false);
    if (userData?.uid) {
      sessionStorage.setItem(`welcome_seen_${userData.uid}`, 'true');
    }
    await markWelcomeStorySeen();
  };

  const handleUpdateProfile = async () => {
    if (!newNickname.trim() || !user || !userData) return;
    if (await updateNickname(newNickname)) {
      toast.success(t('groupChat.nicknameChanged'));
      setShowEditProfileModal(false);
      setNewNickname('');
    }
  };

  const handleUnityUpdate = (percentage: number) => {
    if (activeGroupId && unityOverrides[activeGroupId] !== percentage) {
      setUnityOverrides(prev => ({ ...prev, [activeGroupId]: percentage }));
    }
  };

  // 4. Render Logic
  if (loading || !isLoaded) {
    return (
      <div className='App Dashboard'>
        <div className='AppGlass Grid'>
          <Sidebar selected={selectedView} setSelected={setSelectedView} userGroups={[]} activeGroupId={activeGroupId} setActiveGroupId={setActiveGroupId} currentUserId={userData?.uid} isLetterAvailable={isLetterAvailable} />
          <DashboardSkeleton quoteText={t('dashboard.inspirationQuote')} quoteSource={t('dashboard.inspirationSource')} />
        </div>
      </div>
    );
  }

  if (errorMessage) {
    const isQuotaError = errorMessage.toLowerCase().includes('quota exceeded') || errorMessage.toLowerCase().includes('resource-exhausted');
    return (
      <div className='App Dashboard error-screen-container'>
        <div className='AppGlass error-glass-card'>
          <div className="error-icon-large">{isQuotaError ? '🛠️' : '⛔'}</div>
          <h2 className="error-title-large">{isQuotaError ? t('systemErrors.quotaExceededTitle') : 'Error'}</h2>
          <p className="error-message-detail text-center">{isQuotaError ? t('systemErrors.quotaExceededMessage') : errorMessage}</p>
          <button onClick={() => window.location.reload()} className="retry-btn">Retry</button>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') return <Navigate to={`/${language}/welcome`} replace state={{ from: location }} />;
  if (!userData) return null;



  const isModalOpen = activeModal === 'newNote';
  const setIsModalOpen = (open: boolean) => setActiveModal(open ? 'newNote' : null);
  const hasActiveModal = showWelcomeStory || showEditProfileModal || showAutoKickModal || showJoinSuccessModal || isModalOpen || !!activeModal;

  return (
    <>
      <DashboardLayout
        selectedView={selectedView}
        setSelectedView={setSelectedView}
        userGroups={enrichedUserGroups}
        activeGroupId={activeGroupId}
        setActiveGroupId={setActiveGroupId}
        isInputFocused={isInputFocused}
        isJoiningInvite={isJoiningInvite}
        currentUserId={userData?.uid}
        isLetterAvailable={isLetterAvailable}
      >
        {selectedView === 0 && (
          <DashboardOverview 
            t={t} userData={userData} warnings={warnings} todayPlan={getTodayReadingPlan() || null} 
            getReadingPlanUrl={(script) => getGospelLibraryUrl(null, script, language)}
            translateChapterField={translateChapterField} isJoiningInvite={isJoiningInvite} hasGroups={enrichedUserGroups.length > 0} 
            setIsModalOpen={setIsModalOpen} setShowWelcomeStory={setShowWelcomeStory} 
            setShowEditProfileModal={setShowEditProfileModal} setNewNickname={setNewNickname}
            kickDate={kickDate} hasActiveModal={hasActiveModal}
            onGoToGroupChat={() => {
              // Always open the very first group when multiple groups exist
              const targetGid = enrichedUserGroups[0]?.id || (userData.groupIds && userData.groupIds[0]) || userData.groupId || activeGroupId;
              if (targetGid) {
                setActiveGroupId(targetGid);
                setSelectedView(2);
              }
            }}
            onRejoinSuccess={(groupId) => {
              setActiveGroupId(groupId);
              setSelectedView(2);
              navigate(`/${language}/dashboard?groupId=${encodeURIComponent(groupId)}&view=2`);
            }}
            onClearRecentGroup={clearLastRecentGroup}
          />
        )}
        {selectedView === 1 && (
          <Suspense fallback={<DashboardSkeleton />}>
            <MyNotes userData={userData} isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen} userGroups={enrichedUserGroups} />
          </Suspense>
        )}
        {selectedView === 2 && activeGroupId && (
          <Suspense fallback={<DashboardSkeleton />}>
            <GroupChat 
              groupId={activeGroupId} userData={userData} userGroups={enrichedUserGroups} 
              onInputFocusChange={setIsInputFocused} isExternalModalOpen={isModalOpen} 
              onBack={() => { setActiveGroupId(null); setSelectedView(0); navigate(`/${language}/dashboard`); }} onGroupSelect={setActiveGroupId} 
              onUnityUpdate={handleUnityUpdate} isActive={selectedView === 2}
            />
          </Suspense>
        )}
        {selectedView === 3 && (
          <Suspense fallback={<DashboardSkeleton />}>
            <Profile userData={userData} stats={{ streak: userData.streakCount || 0, totalNotes: userData.totalNotes || 0, daysStudied: userData.daysStudiedCount || 0 }} />
          </Suspense>
        )}
        {selectedView === 4 && (
          <Suspense fallback={<DashboardSkeleton />}>
            <Donate userData={userData} />
          </Suspense>
        )}
        {selectedView !== 2 && <Footer />}
      </DashboardLayout>

      {isModalOpen && (
        <Suspense fallback={null}>
          <NewNote isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} userData={userData} userGroups={enrichedUserGroups} />
        </Suspense>
      )}

      {hasActiveModal && (
        <Suspense fallback={null}>
          <DashboardModals 
            t={t} userData={userData}
            showWelcomeStory={showWelcomeStory} onCloseWelcomeStory={handleCloseWelcomeStory}
            showNotifPrompt={showNotifPrompt} handleEnableNotifications={handleEnableNotifications} handleCloseNotifPrompt={handleCloseNotifPrompt}
            showEditProfileModal={showEditProfileModal} setShowEditProfileModal={setShowEditProfileModal} 
            newNickname={newNickname} setNewNickname={setNewNickname} handleUpdateProfile={handleUpdateProfile}
            showAutoKickModal={showAutoKickModal} autoKickStep={autoKickStep} setAutoKickStep={setAutoKickStep}
            selectedKickDays={selectedKickDays} setSelectedKickDays={setSelectedKickDays}
            handleAutoKickSubmit={handleAutoKickSubmit}
          />
        </Suspense>
      )}

      {/* Join Success Welcome Modal (from invite link) */}
      {showJoinSuccessModal && (
        <Suspense fallback={null}>
          <JoinSuccessModal
            onClose={() => setShowJoinSuccessModal(false)}
          />
        </Suspense>
      )}

      {/* Study Days Milestone & Level Up Celebration Modals */}
      <Suspense fallback={null}>
        <LevelUpModal />
        <MilestoneModal />
      </Suspense>

      {/* Time Capsule Modals (Creation and Unlock) */}
      <Suspense fallback={null}>
        <TimeCapsuleModal userData={userData} />
        <TimeCapsuleUnlockModal />
      </Suspense>
    </>
  );
};

export default Dashboard;


