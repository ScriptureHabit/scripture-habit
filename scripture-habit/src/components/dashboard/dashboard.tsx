import { useState, useEffect, useRef, FC, useMemo, useCallback } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';

// Components
import GroupChat from '../groupchat/group-chat';
import NewNote from '../newnote/new-note';
import MyNotes from '../mynotes/my-notes';
import Profile from '../profile/profile';
import Donate from '../donate/donate';
import Footer from '../footer/footer';
import { DashboardSkeleton } from '../skeleton/skeleton';
import Sidebar from '../sidebar/sidebar';
import TourGuide from '../tourguide/tour-guide';

// Refactored Sub-components
import DashboardLayout from './components/dashboard-layout';
import DashboardOverview from './components/dashboard-overview';
import DashboardModals from './components/dashboard-modals';
import JoinSuccessModal from '../joingroup/join-success-modal';

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

const Dashboard: FC = () => {
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

  // Initialize state from URL or location
  const getInitialState = useCallback(() => {
    const gid = searchParams.get('groupId');
    const viewParam = searchParams.get('view');
    const openNewNote = searchParams.get('openNewNote');
    
    const isProfile = location.pathname.includes('/profile');
    const selectedView = viewParam 
      ? parseInt(viewParam) 
      : (isProfile ? 3 : (gid ? 2 : (initialViewRef.current ?? 0)));
    
    const activeGroupId = gid || initialGroupIdRef.current || null;
    
    return {
      activeGroupId,
      selectedView,
      isModalOpen: openNewNote === 'true'
    };
  }, [searchParams, location.pathname]);

  const initialState = useMemo(() => getInitialState(), [getInitialState]); // Memoize to prevent re-calculation loops
  const [selectedView, setSelectedView] = useState<number>(initialState.selectedView);
  const [showWelcomeStory, setShowWelcomeStory] = useState<boolean>(false);
  const [showTourGuide, setShowTourGuide] = useState<boolean>(false);
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
  const errorMessage = syncState.status === 'error' ? syncState.message : null;
  const { userGroups, activeGroupId, setActiveGroupId, isLoading: groupsLoading } = useDashboardGroups(userData, initialState.activeGroupId);
  const loading = status === 'loading' || groupsLoading;

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
    showAutoKickModal, setShowAutoKickModal, autoKickStep, setAutoKickStep,
    selectedKickDays, setSelectedKickDays, kickConfirmInput, setKickConfirmInput,
    autoKickError, handleAutoKickSubmit 
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
  const { markWelcomeStorySeen, markTourSeen, updateNickname } = useDashboardActions(user, userData);

  // 2. Effects

  // Clear unity overrides at midnight local time
  useEffect(() => {
    setUnityOverrides({});
  }, [today]);

  useEffect(() => {
    setActiveModal(null);
  }, [activeGroupId, setActiveModal]);

  useEffect(() => {
    if (location.state?.initialView !== undefined) setSelectedView(location.state.initialView);
    if (location.state?.initialGroupId) setActiveGroupId(location.state.initialGroupId);

    // Sync view state with localized URL paths
    const path = location.pathname;
    if (path.includes('/profile')) {
      if (selectedView !== 3) setSelectedView(3);
    } else if (path.includes('/dashboard')) {
      // Only force back to default view (0) if we are coming from Profile (3)
      // Views 1 (Stats) and 2 (Chat) are valid sub-views of /dashboard.
      if (selectedView === 3) setSelectedView(0);
    }

    if (searchParams.has('groupId') || searchParams.has('openNewNote') || searchParams.has('view')) {
      const gid = searchParams.get('groupId');
      const v = searchParams.get('view');
      const openNote = searchParams.get('openNewNote');

      if (gid) setActiveGroupId(gid);
      
      if (v) {
        setSelectedView(parseInt(v));
      } else if (gid) {
        // Only force view 2 if we aren't already on a dashboard sub-view (1 or 2)
        // or if we specifically want to switch to chat for a new groupId.
        setSelectedView(2); 
      }

      if (openNote === 'true') setActiveModal('newNote');
      
      // Clear the search params after consumption
      navigate(location.pathname, { replace: true });
    }
  }, [searchParams, location.pathname, location.state, navigate, setActiveGroupId, setActiveModal, selectedView]);

  useEffect(() => {
    if (!loading && userData && userData.uid && userData.hasSeenWelcomeStory === undefined) {
      const timer = setTimeout(() => setShowWelcomeStory(true), 500);
      return () => clearTimeout(timer);
    }
  }, [userData, loading]);

  useEffect(() => {
    // Skip tour guide during automated E2E testing to prevent overlays from blocking playwright clicks
    const isE2E = typeof navigator !== 'undefined' && navigator.webdriver;
    if (isE2E) return;

    if (!loading && userData && userData.uid && 
        userData.hasSeenWelcomeStory === true && 
        userData.hasSetKickThreshold === true && 
        userData.hasSeenTour !== true &&
        !showAutoKickModal &&
        selectedView === 0) {
      const timer = setTimeout(() => setShowTourGuide(true), 800);
      return () => clearTimeout(timer);
    }
  }, [userData, loading, showAutoKickModal, selectedView]);


  // 3. Handlers
  const handleCloseWelcomeStory = async () => {
    setShowWelcomeStory(false);
    await markWelcomeStorySeen();
  };

  const handleCloseTourGuide = async () => {
    setShowTourGuide(false);
    await markTourSeen();
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
          <Sidebar selected={selectedView} setSelected={setSelectedView} userGroups={[]} activeGroupId={activeGroupId} setActiveGroupId={setActiveGroupId} />
          <DashboardSkeleton />
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

  if (status === 'unauthenticated') return <Navigate to="/welcome" replace state={{ from: location }} />;
  if (!userData) return null;



  const isModalOpen = activeModal === 'newNote';
  const setIsModalOpen = (open: boolean) => setActiveModal(open ? 'newNote' : null);

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
      >
        {selectedView === 0 && (
          <DashboardOverview 
            t={t} userData={userData} warnings={warnings} todayPlan={getTodayReadingPlan() || null} 
            getReadingPlanUrl={(script) => getGospelLibraryUrl(null, script, language)}
            translateChapterField={translateChapterField} isJoiningInvite={isJoiningInvite} hasGroups={enrichedUserGroups.length > 0} 
            setIsModalOpen={setIsModalOpen} setShowWelcomeStory={setShowWelcomeStory} 
            setShowEditProfileModal={setShowEditProfileModal} setNewNickname={setNewNickname}
            kickDate={kickDate}
          />
        )}
        {selectedView === 1 && <MyNotes userData={userData} isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen} userGroups={enrichedUserGroups} />}
        {selectedView === 2 && activeGroupId && (
          <GroupChat 
            groupId={activeGroupId} userData={userData} userGroups={enrichedUserGroups} 
            onInputFocusChange={setIsInputFocused} isExternalModalOpen={isModalOpen} 
            onBack={() => { setActiveGroupId(null); setSelectedView(0); }} onGroupSelect={setActiveGroupId} 
             // initialShowInviteModal prop removed, using global store instead
            onUnityUpdate={handleUnityUpdate} isActive={selectedView === 2}
          />
        )}
        {selectedView === 3 && <Profile userData={userData} stats={{ streak: userData.streakCount || 0, totalNotes: userData.totalNotes || 0, daysStudied: userData.daysStudiedCount || 0 }} />}
        {selectedView === 4 && <Donate userData={userData} />}
        {selectedView !== 2 && <Footer />}
      </DashboardLayout>

      <NewNote isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} userData={userData} userGroups={enrichedUserGroups} />
      
      <DashboardModals 
        t={t} userData={userData}
        showWelcomeStory={showWelcomeStory} onCloseWelcomeStory={handleCloseWelcomeStory}
        showNotifPrompt={showNotifPrompt} handleEnableNotifications={handleEnableNotifications} handleCloseNotifPrompt={handleCloseNotifPrompt}
        showEditProfileModal={showEditProfileModal} setShowEditProfileModal={setShowEditProfileModal} 
        newNickname={newNickname} setNewNickname={setNewNickname} handleUpdateProfile={handleUpdateProfile}
        showAutoKickModal={showAutoKickModal} autoKickStep={autoKickStep} setAutoKickStep={setAutoKickStep}
        selectedKickDays={selectedKickDays} setSelectedKickDays={setSelectedKickDays}
        kickConfirmInput={kickConfirmInput} setKickConfirmInput={setKickConfirmInput}
        autoKickError={autoKickError} handleAutoKickSubmit={handleAutoKickSubmit} setShowAutoKickModal={setShowAutoKickModal}
      />

      <TourGuide 
        isOpen={showTourGuide} 
        onClose={handleCloseTourGuide} 
        t={t}
        userData={userData}
      />

      {/* Join Success Welcome Modal (from invite link) */}
      {showJoinSuccessModal && (
        <JoinSuccessModal
          onClose={() => setShowJoinSuccessModal(false)}
        />
      )}

    </>
  );
};

export default Dashboard;


