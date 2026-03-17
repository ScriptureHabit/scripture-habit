import { useState, useEffect, FC } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { safeStorage } from '../../Utils/storage';
import { auth, db } from '../../firebase';
import { doc, onSnapshot, collection, updateDoc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { UilPlus, UilPen } from '@iconscout/react-unicons';
import Sidebar from '../Sidebar/Sidebar';
import GroupChat from '../GroupChat/GroupChat';
import './Dashboard.css';
import Button from '../Button/Button';
import { Capacitor } from '@capacitor/core';
import { toast } from 'react-toastify';

import NewNote from '../NewNote/NewNote';
import MyNotes from '../MyNotes/MyNotes';
import Profile from '../Profile/Profile';
import { getGospelLibraryUrl } from '../../Utils/gospelLibraryMapper';
import { translateChapterField } from '../../Utils/bookNameTranslations';
import { useLanguage } from '../../Context/LanguageContext';
import { getTodayReadingPlan } from '../../Data/DailyReadingPlan';
import WelcomeStoryModal from '../WelcomeStoryModal/WelcomeStoryModal';
import Donate from '../Donate/Donate';
import Mascot from '../Mascot/Mascot';
import Footer from '../Footer/Footer';
import { DashboardSkeleton } from '../Skeleton/Skeleton';
import { requestNotificationPermission } from '../../Utils/notificationHelper';
import NotificationPromptModal from './NotificationPromptModal';
import { UserData } from '../../types/user';
import { Group } from '../../types/chat';

interface NotificationInfo {
  type: 'note' | 'message';
  nickname: string;
  time: number;
  groupId: string;
  groupName: string;
  totalMessages: number;
}

interface WarningInfo {
  name: string;
  days: number;
}

const Dashboard: FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

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
  const [activeGroupId, setActiveGroupId] = useState<string | null>(initialState.activeGroupId);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(initialState.isModalOpen);

  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [personalNotesCount, setPersonalNotesCount] = useState<number | null>(null);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [rawUserGroups, setRawUserGroups] = useState<Group[]>([]);
  const [groupStates, setGroupStates] = useState<Record<string, any>>({});
  const [loadingGroupStates, setLoadingGroupStates] = useState<boolean>(true);
  const [latestNoteNotification, setLatestNoteNotification] = useState<NotificationInfo | null>(null);

  const [showWelcomeStory, setShowWelcomeStory] = useState<boolean>(false);
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);
  const [warnings, setWarnings] = useState<WarningInfo[]>([]);
  const [showEditProfileModal, setShowEditProfileModal] = useState<boolean>(false);
  const [newNickname, setNewNickname] = useState<string>('');
  const [isJoiningInvite, setIsJoiningInvite] = useState<boolean>(false);
  const [showNotifPrompt, setShowNotifPrompt] = useState<boolean>(false);
  
  // Auto Kick / Habit Pace
  const [showAutoKickModal, setShowAutoKickModal] = useState<boolean>(false);
  const [autoKickStep, setAutoKickStep] = useState<number>(0);
  const [selectedKickDays, setSelectedKickDays] = useState<number>(3);
  const [kickConfirmInput, setKickConfirmInput] = useState<string>('');
  const [autoKickError, setAutoKickError] = useState<string>('');
  
  const { t, language } = useLanguage();

  const todayPlan = getTodayReadingPlan();

  const getReadingPlanUrl = (script: string) => {
    // Simply call the smart mapper without an explicit volume.
    // gospelLibraryMapper.js now handles the detection.
    return getGospelLibraryUrl(null, script, language);
  };

  useEffect(() => {
    if (location.state?.initialView !== undefined) {
      setSelectedView(location.state.initialView);
    }
    if (location.state?.initialGroupId) {
      setActiveGroupId(location.state.initialGroupId);
    }

    // URL Cleanup: if parameters were used to initialize state, clean them from the URL
    // so they don't re-trigger on refresh. We use navigate with replace: true
    // so it doesn't add to the history stack.
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.has('groupId') || searchParams.has('openNewNote') || searchParams.has('view')) {
      navigate(location.pathname, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, location.state, navigate]);

  useEffect(() => {
    // Show notification prompt after a delay on dashboard
    // BUT only if no other onboarding modals are open
    if (selectedView === 0 && !loading && userData && !showWelcomeStory && !showAutoKickModal && !isJoiningInvite) {
      const timer = setTimeout(() => {
        const isPermissionDefault = (window as any).Notification && (window as any).Notification.permission === 'default';
        const lastPrompt = safeStorage.get('lastNotifPrompt');
        const now = Date.now();
        const oneWeek = 7 * 24 * 60 * 60 * 1000;

        if (isPermissionDefault && (!lastPrompt || now - parseInt(lastPrompt) > oneWeek)) {
          setShowNotifPrompt(true);
        }
      }, 5000); // 5 seconds instead of 3 to give breathing room
      return () => clearTimeout(timer);
    }
  }, [selectedView, loading, userData, showWelcomeStory, showAutoKickModal, isJoiningInvite]);

  const handleEnableNotifications = async () => {
    setShowNotifPrompt(false);
    safeStorage.set('lastNotifPrompt', Date.now().toString());
    if (userData?.uid) {
      await requestNotificationPermission(userData.uid, (key, defaultText) => t(key) || defaultText);
    }
  };

  const handleCloseNotifPrompt = () => {
    setShowNotifPrompt(false);
    safeStorage.set('lastNotifPrompt', Date.now().toString());
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth!, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Notification permission is now requested manually via the bell icon
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          // Use onSnapshot for real-time updates to user profile
          const unsubUser = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data() as any;
              setUserData({ uid: currentUser.uid, ...data });

              // Show welcome story ONLY AFTER habit pace is set
              if (data.hasSeenWelcomeStory === undefined && data.hasSetKickThreshold === true) {
                setTimeout(() => setShowWelcomeStory(true), 500);
              }
              setLoading(false);
              setError(null);
            } else {
              // Sign of deletion or missing profile - keep quiet and let navigate() handle it
              console.log("User profile document no longer exists (might be deleting account).");
              setLoading(false);
            }
          }, (err: any) => {
            // Silence "permission-denied" errors during account deletion or logout
            if (err.code === 'permission-denied') {
              console.log("Silenced permission error during possible logout/deletion.");
              setLoading(false);
              return;
            }
            console.error("Error fetching user data:", err);
            setError(err.message);
            setLoading(false);
          });
          return () => unsubUser();
        } catch (err: any) {
          console.error("Error setting up user listener:", err);
          setError(err.message);
          setLoading(false);
        }
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Habit Pace Modal Trigger
  useEffect(() => {
    // 招待コードの処理中などはモーダルを出さない
    const inviteCode = safeStorage.get('pendingInviteCode');
    
    // Pace modal has higher priority than welcome story for new users
    if (!loading && userData && userData.uid && 
        userData.hasSetKickThreshold !== true && 
        !inviteCode && !isJoiningInvite) {
      setShowAutoKickModal(true);
    }
  }, [userData, loading, isJoiningInvite]);

  // Handle global modal marker for App components (InstallPrompt, CookieConsent)
  useEffect(() => {
    const isAnyModalOpen = showWelcomeStory || showAutoKickModal || showNotifPrompt || isJoiningInvite || showEditProfileModal || isModalOpen;
    if (isAnyModalOpen) {
      document.body.setAttribute('data-dashboard-modal-open', 'true');
    } else {
      document.body.removeAttribute('data-dashboard-modal-open');
    }
  }, [showWelcomeStory, showAutoKickModal, showNotifPrompt, isJoiningInvite, showEditProfileModal, isModalOpen]);

  const handleAutoKickSubmit = async () => {
    const inputNum = parseInt(kickConfirmInput, 10);
    if (inputNum !== selectedKickDays) {
      setAutoKickError(t('groupChat.autoKickErrorMismatch'));
      setKickConfirmInput('');
      return;
    }

    setAutoKickError('');
    if (autoKickStep === 1) {
      setAutoKickStep(2);
      setKickConfirmInput('');
      return;
    }

    // Step 2 -> Submit
    try {
      const idToken = await auth?.currentUser?.getIdToken();
      if (!idToken) throw new Error("No idToken");

      // Using global API endpoint that updates user and all their groups
      const API_BASE_URL = Capacitor.isNativePlatform() ? 'https://scripturehabit.app' : '';
      const response = await fetch(`${API_BASE_URL}/api/update-kick-threshold`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          threshold: selectedKickDays
        })
      });

      if (response.ok) {
        toast.success(t('groupChat.autoKickSuccess'));
        setShowAutoKickModal(false);
      } else {
        const errorData = await response.json();
        toast.error(`Failed to update pace: ${errorData.error || response.statusText}`);
      }
    } catch (error: any) {
      console.error('Error updating threshold:', error);
      toast.error(`An error occurred: ${error.message}`);
    }
  };

  // --- Just-In-Time Data Migration (Level Initialization) ---
  useEffect(() => {
    const migrateLevelData = async () => {
      // Trigger migration if missing OR if it's clearly incorrect (less than streak)
      const needsMigration = userData && (
        userData.daysStudiedCount === undefined ||
        (userData.daysStudiedCount < (userData.streakCount || 0))
      );

      if (!user || !userData || !needsMigration) return;

      console.log("Migration/Fix triggered: calculating accurate daysStudiedCount...");
      try {
        const notesRef = collection(db, 'users', user.uid, 'notes');
        const notesSnapshot = await getDocs(notesRef);

        const studyDays = new Set<string>();
        notesSnapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data.createdAt) {
            const date = data.createdAt.toDate();
            // Use local date string (YYYY-MM-DD) instead of UTC to avoid shifting days
            const dateStr = date.toLocaleDateString('sv-SE'); // 'sv-SE' gives YYYY-MM-DD
            studyDays.add(dateStr);
          }
        });

        // The real count should be the maximum of unique days with notes OR the current streak
        const initialDaysCount = Math.max(studyDays.size, userData.streakCount || 0);

        // Only update if the value is different from what we currently have
        if (initialDaysCount !== userData.daysStudiedCount) {
          await updateDoc(doc(db, 'users', user.uid), {
            daysStudiedCount: initialDaysCount,
            totalNotes: userData.totalNotes || notesSnapshot.size
          });
          console.log(`Level data corrected: ${initialDaysCount} days studied.`);
        }
      } catch (err) {
        console.error("Error during level data migration:", err);
      }
    };

    migrateLevelData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userData?.daysStudiedCount, userData?.streakCount, userData?.uid]);
  // -----------------------------------------------------------

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

  // Fetch user groups details
  useEffect(() => {
    if (!userData) return;

    const groupIds: string[] = userData.groupIds || (userData.groupId ? [userData.groupId] : []);

    if (groupIds.length === 0) {
      setRawUserGroups([]);
      return;
    }

    // Set active group if not set
    if (!activeGroupId && groupIds.length > 0) {
      setActiveGroupId(groupIds[0]);
    }

    const fetchGroups = async () => {
      const unsubscribers: (() => void)[] = [];
      const groupsData: Record<string, any> = {};

      groupIds.forEach(gid => {
        const unsub = onSnapshot(doc(db, 'groups', gid), (docSnap) => {
          if (docSnap.exists()) {
            groupsData[gid] = { id: gid, ...docSnap.data() };
            // Update state with new data
            setRawUserGroups(prev => {
              // Re-map based on groupIds order to keep consistency
              const newGroups = groupIds
                .map(id => groupsData[id] || prev.find(g => g.id === id))
                .filter(Boolean);
              return newGroups;
            });
          }
        }, (err: any) => {
          if (err.code !== 'permission-denied') {
            console.error(`Error fetching group ${gid}:`, err);
          }
        });
        unsubscribers.push(unsub);
      });

      return () => {
        unsubscribers.forEach(unsub => unsub());
      };
    };

    const cleanupPromise = fetchGroups();
    return () => {
      cleanupPromise.then(cleanup => cleanup && cleanup());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(userData?.groupIds), userData?.groupId]);

  // Fetch user group states (read counts)
  useEffect(() => {
    if (!userData?.uid) return;

    setLoadingGroupStates(true);
    const groupStatesRef = collection(db, 'users', userData.uid, 'groupStates');
    const unsubscribe = onSnapshot(groupStatesRef, (snapshot) => {
      const states: Record<string, any> = {};
      snapshot.forEach(doc => {
        states[doc.id] = doc.data();
      });
      setGroupStates(states);
      setLoadingGroupStates(false);
    }, (err: any) => {
      if (err.code !== 'permission-denied') {
        console.error("Error fetching group states:", err);
      }
      setLoadingGroupStates(false);
    });

    return () => unsubscribe();

  }, [userData?.uid]);

  // Combine raw groups with unread counts
  useEffect(() => {
    const combinedGroups = rawUserGroups.map(group => {
      const state = groupStates[group.id];
      // If still loading states, assume everything is read to prevent flash of unread count
      // If loaded and no state exists, then it's truly unread (readCount 0)
      const readCount = loadingGroupStates ? (group.messageCount || 0) : (state?.readMessageCount || 0);
      const totalCount = group.messageCount || 0;
      const unreadCount = Math.max(0, totalCount - readCount);

      return {
        ...group,
        unreadCount
      };
    });
    setUserGroups(combinedGroups as Group[]);

  }, [rawUserGroups, groupStates, loadingGroupStates]);

  // Update activeGroupId if the user leaves the current group or if we need to validate the current selection
  useEffect(() => {
    // IMPORTANT: Do not reset activeGroupId while initial data is loading
    if (loading) return;

    if (userGroups.length > 0) {
      // Check if the currently active group is loaded in userGroups
      const isActiveGroupLoaded = userGroups.find(g => g.id === activeGroupId);

      if (!isActiveGroupLoaded) {
        // If not loaded, check if it's at least in the user's group list (pending load)
        // This prevents resetting activeGroupId while the specific group data is being fetched
        const userGroupIds = userData?.groupIds || (userData?.groupId ? [userData.groupId] : []);
        const isMemberOfActiveGroup = activeGroupId && userGroupIds.includes(activeGroupId);

        if (!isMemberOfActiveGroup) {
          // Only reset if the user is NOT a member of the active group
          setActiveGroupId(userGroups[0].id);
        }
      }
    } else {
      // Only reset if user truly has no groups (avoid resetting during loading)
      const hasGroups = userData && ((userData.groupIds && userData.groupIds.length > 0) || userData.groupId);
      if (!hasGroups) {
        setActiveGroupId(null);
      }
    }
  }, [userGroups, userData, activeGroupId, loading]);



  // No longer using real-time listener for the entire collection to get count
  // personalNotesCount is now derived from userData.totalNotes
  useEffect(() => {
    if (userData) {
      setPersonalNotesCount(userData.totalNotes || 0);
    }
  }, [userData]);

  // Check for inactivity warnings
  useEffect(() => {
    if (!userData || userGroups.length === 0) return;

    const newWarnings: WarningInfo[] = [];
    const now = new Date();

    userGroups.forEach(group => {
      const memberLastActive = group.memberLastActive || {};
      const lastActiveTimestamp = memberLastActive[userData.uid];

      if (lastActiveTimestamp) {
        const lastActiveDate = (lastActiveTimestamp as any).toDate ? (lastActiveTimestamp as any).toDate() : new Date((lastActiveTimestamp as any).seconds * 1000);
        // diff in ms
        const diffMs = now.getTime() - lastActiveDate.getTime();
        // diff in days
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        // Warn if within 1 day of threshold (or over it, in case cron hasn't run yet)
        const threshold = (group.memberKickThresholds && group.memberKickThresholds[userData.uid]) || userData.kickThreshold || 3;
        if (diffDays >= threshold - 1) {
          newWarnings.push({ name: group.name || 'Group', days: Math.floor(diffDays) });
        }
      }
    });

    setWarnings(newWarnings);

  }, [userGroups, userData]);

  // Check for recent notes from others to show notification
  useEffect(() => {
    if (!userGroups || userGroups.length === 0 || !userData || loadingGroupStates) return;

    // Filter groups where someone ELSE posted a note today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    let mostRecent: NotificationInfo | null = null;

    userGroups.forEach(group => {
      const noteTime = group.lastNoteAt ? (group.lastNoteAt.toMillis ? group.lastNoteAt.toMillis() : (group.lastNoteAt.seconds * 1000)) : 0;
      const messageTime = group.lastMessageAt ? (group.lastMessageAt.toMillis ? group.lastMessageAt.toMillis() : (group.lastMessageAt.seconds * 1000)) : 0;

      // Determine which one is newer and should be considered
      let currentType: 'note' | 'message' | '' = '';
      let currentTime = 0;
      let currentNickname = '';
      let currentUid = '';

      if (noteTime >= messageTime && noteTime > 0) {
        currentType = 'note';
        currentTime = noteTime;
        currentNickname = group.lastNoteByNickname || '';
        currentUid = group.lastNoteByUid || '';
      } else if (messageTime > noteTime && messageTime > 0) {
        currentType = 'message';
        currentTime = messageTime;
        currentNickname = group.lastMessageByNickname || '';
        currentUid = group.lastMessageByUid || '';
      }

      if (currentTime > 0 && currentUid !== userData.uid) {
        // Only show if newer than today AND the group has unread messages
        if (currentTime >= todayTime && (group.unreadCount || 0) > 0) {
          if (!mostRecent || currentTime > mostRecent.time) {
            mostRecent = {
              type: currentType as 'note' | 'message',
              nickname: currentNickname || 'Someone',
              time: currentTime,
              groupId: group.id,
              groupName: group.name || '',
              totalMessages: group.messageCount || 0
            };
          }
        }
      }
    });

    setLatestNoteNotification(mostRecent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userGroups, userData?.uid, groupStates, loadingGroupStates]);

  // --- Invitation Handling ---
  useEffect(() => {
    const processPendingInvite = async () => {
      const inviteCode = safeStorage.get('pendingInviteCode');
      if (!inviteCode || !user || !userData || showWelcomeStory || isJoiningInvite) return;

      setIsJoiningInvite(true);
      console.log("Processing pending invite code:", inviteCode);

      try {
        const API_BASE = Capacitor.isNativePlatform() ? 'https://scripturehabit.app' : '';
        const idToken = await user.getIdToken();
        const resp = await fetch(`${API_BASE}/api/join-group`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ inviteCode })
        });

        if (resp.ok) {
          const result = await resp.json();
          const joinedGroupId = result.groupId;
          safeStorage.remove('pendingInviteCode');
          
          setTimeout(() => {
            if (joinedGroupId) setActiveGroupId(joinedGroupId);
            setSelectedView(2);
            setIsJoiningInvite(false);
            toast.success(`🎉 ${t('joinGroup.joiningFromInviteSuccess')}`);
          }, 1000);
        } else {
          const errText = await resp.text();
          
          if (errText.includes('already in this group')) {
            console.log("User already in this group");
          } else {
            console.error("Failed to join via invite link:", errText);
          }
          safeStorage.remove('pendingInviteCode');
          setIsJoiningInvite(false);
        }

      } catch (error) {
        console.error("Error processing pending invite:", error);
        safeStorage.remove('pendingInviteCode');
        setIsJoiningInvite(false);
      }
    };

    if (!showWelcomeStory && userData && user) {
      processPendingInvite();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userData, showWelcomeStory, t]);

  if (loading) {
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
            padding: '2rem',
            textAlign: 'center',
            maxWidth: '500px',
            width: '90%',
            background: 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(15px)',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            animation: 'fadeIn 0.5s ease-out'
          }}>
            <div style={{ fontSize: '3rem' }}>🛠️</div>
            <h2 style={{ color: '#2d3748', margin: 0, fontSize: '1.5rem', fontWeight: '800' }}>
              {t('systemErrors.quotaExceededTitle')}
            </h2>
            <p style={{ color: '#4a5568', margin: 0, lineHeight: '1.6', fontSize: '1rem' }}>
              {t('systemErrors.quotaExceededMessage')}
            </p>
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              background: 'rgba(107, 70, 193, 0.1)',
              borderRadius: '12px',
              fontSize: '0.9rem',
              color: '#FF919D',
              fontWeight: '600'
            }}>
              Expected Reset: 17:00 JST / 8:00 AM UTC
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: '1rem',
                padding: '0.8rem 1.5rem',
                background: 'linear-gradient(135deg, #FF919D 0%, #4a90e2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return <div className='App Dashboard' style={{ color: 'red', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Error: {error}</div>;
  }

  if (!user) {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    return <Navigate to={isStandalone ? "/welcome" : "/"} replace />;
  }

  if (!userData) {
    return (
      <div className='App Dashboard'>
        <div className='AppGlass welcome'>
          <h1>Welcome!</h1>
          <p>Your user profile is being set up or could not be found.</p>
          <Link to="/group-form">
            <Button className="create-btn">Create a Group</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Allow access if user has groups, even if groupId is not set (migration case)
  const hasGroups = (userData.groupIds && userData.groupIds.length > 0) || userData.groupId;

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
      // toast.error(t('groupChat.errorChangeNickname'));
    }
  };

  return (
    <div className='App Dashboard'>
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
              <div className="joining-overlay" style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(255, 255, 255, 0.8)',
                zIndex: 2000,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(10px)'
              }}>
                <div className="loading-spinner" style={{ marginBottom: '1rem' }}></div>
                <h3>{t('joinGroup.joiningFromInvite')}</h3>
              </div>
            )}
            <div className="dashboard-header">
              <div>
                <h1>Scripture Habit</h1>
                <p className="welcome-text">
                  {t('dashboard.welcomeBack')}, <strong>{userData.nickname}</strong>!
                  <button
                    className="edit-profile-btn"
                    onClick={() => {
                      setNewNickname(userData.nickname || '');
                      setShowEditProfileModal(true);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      marginLeft: '0.5rem',
                      color: 'var(--gray)',
                      verticalAlign: 'middle',
                      padding: '4px',
                      display: 'inline-flex',
                      alignItems: 'center'
                    }}
                  >
                    <UilPen size="16" />
                  </button>
                </p>
              </div>
            </div>

            {warnings.length > 0 && (
              <div className="warning-banner" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {warnings.map((warn, i) => (
                  <div key={i}>
                    ⚠️ {language === 'ja'
                      ? `【警告】${warn.name}での活動が${Math.max(1, warn.days)}日以上ありません。今日投稿しないと退出になります！`
                      : `Warning: You have been inactive in ${warn.name} for over ${Math.max(1, warn.days)} days. Post today to avoid removal!`}
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

                    // Immediately switch view and clear notification locally
                    setActiveGroupId(gid);
                    setSelectedView(2);
                    setLatestNoteNotification(null);

                    // Update read status in background
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
                          const displayScript = translateChapterField(script, language);

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


            <Footer />
          </div>
        )}

        {selectedView === 1 && userData && (
          <MyNotes userData={userData} isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen} userGroups={userGroups as any} />
        )}
        {selectedView === 2 && (
          <GroupChat
            groupId={activeGroupId || ""}
            userData={userData}
            userGroups={userGroups}
            isActive={true}
            onInputFocusChange={setIsInputFocused}
            onBack={() => setSelectedView(0)}
            onGroupSelect={setActiveGroupId}
            isExternalModalOpen={isModalOpen || showEditProfileModal || showWelcomeStory || showNotifPrompt || isJoiningInvite}
          />
        )}
        {selectedView === 3 && userData && (
          <Profile
            userData={userData}
            stats={{
              streak: userData.streakCount || 0,
              totalNotes: personalNotesCount !== null ? personalNotesCount : 0,
              daysStudied: userData.daysStudiedCount || 0
            }}
          />
        )}
        {selectedView === 4 && (
          <Donate userData={userData} />
        )}

        {userData && <NewNote isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} userData={userData} userGroups={userGroups as any} currentGroupId={activeGroupId} />}

        <WelcomeStoryModal
          isOpen={showWelcomeStory}
          onClose={handleCloseWelcomeStory}
          userData={userData}
        />

        {/* Edit Profile Modal */}
        {showEditProfileModal && (
          <div className="leave-modal-overlay" style={{ zIndex: 2000 }}>
            <div className="leave-modal-content">
              <h3>{t('groupChat.changeNickname')}</h3>
              <input
                type="text"
                className="delete-confirmation-input"
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                placeholder={t('groupChat.enterNewNickname') || ''}
                style={{ marginTop: '1rem', marginBottom: '1rem' }}
              />
              <div className="leave-modal-actions">
                <button
                  className="modal-btn cancel"
                  onClick={() => { setShowEditProfileModal(false); setNewNickname(''); }}
                >
                  {t('groupChat.cancel')}
                </button>
                <button
                  className="modal-btn primary"
                  onClick={handleUpdateProfile}
                  disabled={!newNickname.trim() || newNickname === userData.nickname}
                >
                  {t('groupChat.save')}
                </button>
              </div>
            </div>
          </div>
        )}

        <NotificationPromptModal
          isOpen={showNotifPrompt}
          onClose={handleCloseNotifPrompt}
          onConfirm={handleEnableNotifications}
          t={t as any}
        />

        {/* Global Habit Pace Setup Modal */}
        {showAutoKickModal && (
          <div className="leave-modal-overlay guide-modal-overlay" style={{ zIndex: 3000 }}>
            <div className="leave-modal-content guide-modal-content auto-kick-setup-modal">
              <div className="guide-image-container">
                <img src="/images/mascot.png" alt="Mascot" className="guide-bird-image" />
              </div>
              <h3>{t('groupChat.autoKickSelectionTitle')}</h3>

              {autoKickStep === 0 && (
                <div className="kick-setup-step">
                  <p className="guide-intro">{t('groupChat.autoKickSelectionMessage')}</p>
                  <div className="kick-days-options">
                    {[3, 4, 5, 6, 7].map(days => (
                      <button
                        key={days}
                        className={`modal-btn ${selectedKickDays === days ? 'primary' : 'outline'}`}
                        onClick={() => setSelectedKickDays(days)}
                      >
                        {t('groupChat.autoKickChoiceLabel').replace('{days}', days.toString())}
                      </button>
                    ))}
                  </div>
                  <p className="guide-rule-detail" style={{ marginTop: '1rem', fontSize: '0.8rem', opacity: 0.8 }}>
                    {t('groupChat.autoKickSelectionDescription')}
                  </p>
                  <button className="modal-btn primary" onClick={() => setAutoKickStep(1)} style={{ marginTop: '1.5rem', width: '100%' }}>
                    {t('groupChat.confirm')}
                  </button>
                </div>
              )}

              {autoKickStep === 1 && (
                <div className="kick-setup-step">
                  <label className="input-label" style={{ textAlign: 'center', display: 'block' }}>
                    {t('groupChat.autoKickConfirmMessage')}
                  </label>
                  <input
                    type="number"
                    value={kickConfirmInput}
                    onChange={(e) => setKickConfirmInput(e.target.value)}
                    className="profile-input"
                    placeholder={selectedKickDays.toString()}
                    style={{ textAlign: 'center', fontSize: '1.5rem', marginTop: '1rem', width: '100%' }}
                    autoFocus
                  />
                  {autoKickError && <p style={{ color: 'var(--red)', fontSize: '0.8rem', marginTop: '0.5rem' }}>{autoKickError}</p>}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button className="modal-btn outline" onClick={() => setAutoKickStep(0)} style={{ flex: 1 }}>{t('groupChat.cancel')}</button>
                    <button className="modal-btn primary" onClick={handleAutoKickSubmit} style={{ flex: 1 }}>{t('groupChat.confirm')}</button>
                  </div>
                </div>
              )}

              {autoKickStep === 2 && (
                <div className="kick-setup-step">
                  <label className="input-label" style={{ textAlign: 'center', display: 'block' }}>
                    {t('groupChat.autoKickReconfirmMessage')}
                  </label>
                  <input
                    type="number"
                    value={kickConfirmInput}
                    onChange={(e) => setKickConfirmInput(e.target.value)}
                    className="profile-input"
                    placeholder={selectedKickDays.toString()}
                    style={{ textAlign: 'center', fontSize: '1.5rem', marginTop: '1rem', width: '100%' }}
                    autoFocus
                  />
                  {autoKickError && <p style={{ color: 'var(--red)', fontSize: '0.8rem', marginTop: '0.5rem' }}>{autoKickError}</p>}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button className="modal-btn outline" onClick={() => setAutoKickStep(1)} style={{ flex: 1 }}>{t('groupChat.cancel')}</button>
                    <button className="modal-btn primary" onClick={handleAutoKickSubmit} style={{ flex: 1 }}>{t('groupChat.confirm')}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default Dashboard;