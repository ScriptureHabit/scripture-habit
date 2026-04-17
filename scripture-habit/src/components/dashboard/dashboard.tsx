
import { useState, useEffect, useRef, FC, useMemo } from 'react';
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

// Refactored Sub-components
import DashboardLayout from './components/dashboard-layout';
import DashboardOverview from './components/dashboard-overview';
import DashboardModals from './components/dashboard-modals';

// Styles
import './dashboard.css';

// Utils & Stores
import { useModalStore } from '../../store/use-modal-store';
import { getGospelLibraryUrl } from '../../utils/gospel-library-mapper';
import { useLanguage } from '../../hooks/use-language';
import { getTodayReadingPlan } from '../../data/daily-reading-plan';
import { enrichGroupUnity } from '../../utils/group-utils';

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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, language, isLoaded, translateChapterField } = useLanguage();
  console.log('[Dashboard] Render', { isLoaded, status: isLoaded ? 'Ready' : 'Loading' });
  
  const { activeModal, setActiveModal } = useModalStore();
  const progressRef = useRef<HTMLDivElement>(null);

  // Initialize state from URL or location
  const getInitialState = () => {
    const gid = searchParams.get('groupId');
    const viewParam = searchParams.get('view');
    const openNewNote = searchParams.get('openNewNote');
    
    // Default to Chat (2) if groupId is provided but view is missing
    const initialView = viewParam 
      ? parseInt(viewParam) 
      : (gid ? 2 : (location.state?.initialView ?? 0));
    
    return {
      activeGroupId: gid || location.state?.initialGroupId || null as string | null,
      selectedView: initialView,
      isModalOpen: openNewNote === 'true'
    };
  };

  const initialState = getInitialState();
  const [selectedView, setSelectedView] = useState<number>(initialState.selectedView);
  const [showWelcomeStory, setShowWelcomeStory] = useState<boolean>(false);
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState<boolean>(false);
  const [newNickname, setNewNickname] = useState<string>('');
  const [unityOverrides, setUnityOverrides] = useState<Record<string, number>>({});
  const today = useToday(); // Triggers re-render at midnight local time



  // 1. Core Hooks
  const syncState = useDashboardSync();
  const { user, userData, status } = syncState;
  const errorMessage = syncState.status === 'error' ? syncState.message : null;
  const loading = status === 'loading';

  const { userGroups, activeGroupId, setActiveGroupId } = useDashboardGroups(userData, initialState.activeGroupId);
  const { 
    showAutoKickModal, setShowAutoKickModal, autoKickStep, setAutoKickStep,
    selectedKickDays, setSelectedKickDays, kickConfirmInput, setKickConfirmInput,
    autoKickError, handleAutoKickSubmit 
  } = useDashboardHabitPace(userData, loading, false, t);

  const { isJoiningInvite } = useDashboardInvitations(user, userData, showWelcomeStory, setActiveGroupId, setSelectedView, t);
  const { warnings } = useDashboardWarnings(userData, userGroups);

  const referenceDate = useMemo(() => {
    // We include 'today' to ensure this date object refreshes at midnight
    return new Date();
  }, [today]);

  const enrichedUserGroups = useMemo(() => {
    return userGroups.map(group => {
      const enriched = enrichGroupUnity(group, unityOverrides[group.id], referenceDate);
      return {
        ...enriched,
        _date: today
      };
    });
  }, [userGroups, unityOverrides, today, referenceDate]);
  const { showNotifPrompt, handleEnableNotifications, handleCloseNotifPrompt } = useDashboardNotifications(userData, t);
  const { markWelcomeStorySeen, updateNickname } = useDashboardActions(user, userData);

  // 2. Effects
  useEffect(() => {
    if (progressRef.current && (userData?.daysStudiedCount !== undefined)) {
      const percentage = ((userData.daysStudiedCount || 0) % 7) / 7 * 100;
      progressRef.current.style.width = `${percentage}%`;
    }
  }, [userData?.daysStudiedCount]);

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

    if (searchParams.has('groupId') || searchParams.has('openNewNote') || searchParams.has('view')) {
      const gid = searchParams.get('groupId');
      const v = searchParams.get('view');
      const openNote = searchParams.get('openNewNote');

      console.log('[Dashboard] Processing searchParams', { gid, v, openNote });

      if (gid) setActiveGroupId(gid);
      if (v) setSelectedView(parseInt(v));
      else if (gid) setSelectedView(2); // Switch to chat if only groupId is provided

      if (openNote === 'true') setActiveModal('newNote');
      
      console.log('[Dashboard] Navigating to clear searchParams');
      navigate(location.pathname, { replace: true });
    }
  }, [searchParams, location.pathname, location.state, navigate, setActiveGroupId, setActiveModal]);

  useEffect(() => {
    if (!loading && userData && userData.uid && userData.hasSeenWelcomeStory === undefined && userData.hasSetKickThreshold === true) {
      const timer = setTimeout(() => setShowWelcomeStory(true), 500);
      return () => clearTimeout(timer);
    }
  }, [userData, loading]);

  // 3. Handlers
  const handleCloseWelcomeStory = async () => {
    setShowWelcomeStory(false);
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

  if (status === 'unauthenticated') return <Navigate to="/welcome" replace />;
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
            setShowEditProfileModal={setShowEditProfileModal} setNewNickname={setNewNickname} progressRef={progressRef}
          />
        )}
        {selectedView === 1 && <MyNotes userData={userData} isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen} userGroups={enrichedUserGroups} />}
        {selectedView === 2 && activeGroupId && (
          <GroupChat 
            groupId={activeGroupId} userData={userData} userGroups={enrichedUserGroups} 
            onInputFocusChange={setIsInputFocused} isExternalModalOpen={isModalOpen} 
            onBack={() => setSelectedView(0)} onGroupSelect={setActiveGroupId} 
            initialShowInviteModal={!!location.state?.showInviteModal} onUnityUpdate={handleUnityUpdate} isActive={selectedView === 2}
          />
        )}
        {selectedView === 3 && <Profile userData={userData} stats={{ streak: userData.streakCount || 0, totalNotes: userData.totalNotes || 0, daysStudied: userData.daysStudiedCount || 0 }} />}
        {selectedView === 4 && <Donate userData={userData} />}
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

      {selectedView !== 2 && <Footer />}
    </>
  );
};

export default Dashboard;


