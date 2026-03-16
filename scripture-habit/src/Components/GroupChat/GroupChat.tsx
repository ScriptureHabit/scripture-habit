import { useState, useEffect, useRef, useLayoutEffect, useMemo, FC, FormEvent, Fragment } from 'react';
import { safeStorage } from '../../Utils/storage';
import { Capacitor } from '@capacitor/core';
import { db, auth } from '../../firebase';
import { UilSignOutAlt, UilCopy, UilTrashAlt, UilTimes, UilArrowLeft, UilPlusCircle, UilUsersAlt, UilPen, UilCommentAlt } from '@iconscout/react-unicons';
import { collection, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc, arrayRemove, arrayUnion, getDoc, getDocs, limit, startAfter, increment, runTransaction, where, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import NewNote from '../NewNote/NewNote';
import { NOTE_HEADER_REGEX, removeNoteHeader } from '../../Utils/noteUtils';
import './GroupChat.css';
import { useLanguage } from '../../Context/LanguageContext';
import confetti from 'canvas-confetti';
import MessageItem from './MessageItem';
import MessageInput from './MessageInput';
import GroupChatModals from './GroupChatModals';
import { useGroupMessages } from './useGroupMessages';
import GroupMenuItem from './GroupMenuItem';
import { UserData } from '../../types/user';
import { Group, Message, UserProfile } from '../../types/chat';

interface GroupChatProps {
  groupId: string;
  userData: UserData;
  userGroups?: Group[];
  isActive?: boolean;
  onInputFocusChange?: (focused: boolean) => void;
  onBack?: () => void;
  onGroupSelect?: (groupId: string) => void;
  isExternalModalOpen?: boolean;
}

interface ContextMenu {
  show: boolean;
  x: number;
  y: number;
  messageId: string | null;
  message?: Message | null;
}

interface UnityModalData {
  posted: { id: string; nickname: string }[];
  notPosted: { id: string; nickname: string }[];
}

const GroupChat: FC<GroupChatProps> = ({ groupId, userData, userGroups = [], isActive = false, onInputFocusChange, onBack, onGroupSelect, isExternalModalOpen = false }) => {
  const { language, t } = useLanguage();
  const API_BASE = Capacitor.isNativePlatform() ? 'https://scripturehabit.app' : '';
  const navigate = useNavigate();
  const [newMessage, setNewMessage] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [isNewNoteOpen, setIsNewNoteOpen] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [membersList, setMembersList] = useState<UserProfile[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenu>({ show: false, x: 0, y: 0, messageId: null });
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editText, setEditText] = useState('');
  const [showDeleteMessageModal, setShowDeleteMessageModal] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const [noteToEdit, setNoteToEdit] = useState<any>(null);
  const [showReactionsModal, setShowReactionsModal] = useState(false);
  const [reactionsToShow, setReactionsToShow] = useState<any[]>([]);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const [isRecapLoading, setIsRecapLoading] = useState(false);
  const [showInactivityPolicyBanner, setShowInactivityPolicyBanner] = useState(false);
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newTranslatedName, setNewTranslatedName] = useState('');
  const [newTranslatedDesc, setNewTranslatedDesc] = useState('');
  const [selectedMember, setSelectedMember] = useState<UserProfile | null>(null);
  const [showUnityModal, setShowUnityModal] = useState(false);
  const [unityModalData, setUnityModalData] = useState<UnityModalData>({ posted: [], notPosted: [] });
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportedMessage, setReportedMessage] = useState<Message | null>(null);
  const [reportReason, setReportReason] = useState('inappropriate');
  const [cheerTarget, setCheerTarget] = useState<UserProfile | null>(null);
  const [isSendingCheer, setIsSendingCheer] = useState(false);
  const [cheeredTodayUids, setCheeredTodayUids] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [showAddNoteTooltip, setShowAddNoteTooltip] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [translatedTexts, setTranslatedTexts] = useState<Record<string, string>>({});
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());
  const [translatedGroupName, setTranslatedGroupName] = useState('');
  const [translatedGroupDesc, setTranslatedGroupDesc] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousScrollHeightRef = useRef(0);
  const scrollDebounceRef = useRef<any>(null);
  const {
    messages, setMessages,
    groupData,
    loading,
    userReadCount, setUserReadCount,
    initialScrollDone, setInitialScrollDone,
    hasMoreOlder, setHasMoreOlder,
    membersMap,
    currentGroupIdRef,
    prevMessageCountRef,
    latestMessageRef
  } = useGroupMessages(groupId, userData, t);

  const groupNameTranslateRef = useRef<{ id: string | null; lang: string | null; textHash?: number }>({ id: null, lang: null });
  const groupDescTranslateRef = useRef<{ id: string | null; lang: string | null; textHash?: number }>({ id: null, lang: null });

  useEffect(() => {
    const fetchCheers = async () => {
      if (!userData?.uid) return;
      try {
        const timeZone = userData.timeZone || 'UTC';
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone });
        const q = query(
          collection(db, 'cheers'),
          where('senderUid', '==', userData.uid),
          where('date', '==', todayStr)
        );
        const snapshot = await getDocs(q);
        const uids = new Set<string>();
        snapshot.forEach(doc => {
          uids.add(doc.data().targetUid);
        });
        setCheeredTodayUids(uids);
      } catch (err) {
        console.error("Error fetching cheers:", err);
      }
    };
    fetchCheers();
  }, [userData?.uid, userData?.timeZone]);



  useEffect(() => {
    // Reset on group switch
    setTranslatedGroupName('');
    setTranslatedGroupDesc('');

    // Reset refs when group ID changes
    if (groupNameTranslateRef.current.id !== groupId) {
      groupNameTranslateRef.current = { id: groupId, lang: null };
      groupDescTranslateRef.current = { id: groupId, lang: null };
    }

    const autoTranslateGroupInfo = async () => {
      if (!groupData?.name || !language) return;

      // 1. Check Firestore first
      const savedTrans = groupData.translations?.[language];
      const nameToSet = savedTrans?.name;
      const descToSet = savedTrans?.description;

      // If we have both (or appropriate partials), set and done.
      // Note: If description is empty string in original, we don't need translation for it.
      const needsName = !nameToSet;
      const needsDesc = groupData.description && !descToSet;

      if (!needsName && !needsDesc) {
        if (nameToSet) setTranslatedGroupName(nameToSet);
        if (descToSet) setTranslatedGroupDesc(descToSet);
        return;
      }

      // Set what we have so far
      if (nameToSet) setTranslatedGroupName(nameToSet);
      if (descToSet) setTranslatedGroupDesc(descToSet);

      const translateText = async (text: string, type: string) => {
        if (!text) return '';

        // Ref check
        const currentRef = type === 'group_name' ? groupNameTranslateRef : groupDescTranslateRef;
        if (currentRef.current.lang === language && currentRef.current.textHash === text.length) {
          // Already attempted
          return sessionStorage.getItem(`trans_${type}_${groupId}_${language}`) || ''; // Fallback to session
        }

        const cacheKey = `trans_${type}_${groupId}_${language}`;
        const cached = sessionStorage.getItem(cacheKey);

        if (cached) {
          currentRef.current = { id: groupId, lang: language, textHash: text.length };
          return cached;
        }

        currentRef.current = { id: groupId, lang: language, textHash: text.length };

        try {
          if (!auth) return '';
          const idToken = await auth.currentUser?.getIdToken();
          if (!idToken) return '';
          const response = await fetch(`${API_BASE}/api/translate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              text,
              targetLanguage: language
            })
          });

          if (response.ok) {
            const data = await response.json();
            if (data.translatedText) {
              sessionStorage.setItem(cacheKey, data.translatedText);
              return data.translatedText;
            }
          }
        } catch (e) {
          console.error(`Failed to auto-translate ${type}:`, e);
        }
        return '';
      };

      // Perform necessary translations
      const namePromise = needsName ? translateText(groupData.name, 'group_name') : Promise.resolve(null);
      const descPromise = needsDesc ? translateText(groupData.description || '', 'group_desc') : Promise.resolve(null);

      const [newName, newDesc] = await Promise.all([namePromise, descPromise]);

      if (newName) setTranslatedGroupName(newName);
      if (newDesc) setTranslatedGroupDesc(newDesc);

      // Save to Firestore if we got new data
      if (newName || newDesc) {
        try {
          const updatePayload: any = {};
          if (newName) updatePayload[`translations.${language}.name`] = newName;
          if (newDesc) updatePayload[`translations.${language}.description`] = newDesc;

          const groupRef = doc(db, 'groups', groupId);
          await updateDoc(groupRef, updatePayload);

        } catch (e) {
          console.error("Error saving translations:", e);
        }
      }
    };

    autoTranslateGroupInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, groupData?.name, groupData?.description, groupData?.translations, language]);



  // Show tooltip every 6 visits
  useEffect(() => {
    if (!groupId) return;

    // Clean up old localStorage key (migration)
    const oldKey = safeStorage.get('hasSeenAddNoteTooltip');
    if (oldKey) {
      safeStorage.remove('hasSeenAddNoteTooltip');
    }

    // Get current visit count
    const visitCountStr = safeStorage.get('groupChatVisitCount');
    const visitCount = visitCountStr ? parseInt(visitCountStr, 10) : 0;

    // Increment visit count
    const newVisitCount = visitCount + 1;
    safeStorage.set('groupChatVisitCount', newVisitCount.toString());

    // Show tooltip every 2th visit (1, 7, 13, 19, ...)
    if (newVisitCount % 2 === 1) {
      // Show tooltip after a short delay for better UX
      const timer = setTimeout(() => {
        setShowAddNoteTooltip(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [groupId]);


  const handleDismissTooltip = () => {
    setShowAddNoteTooltip(false);
  };

  const handleDismissInactivityBanner = () => {
    setShowInactivityPolicyBanner(false);
    safeStorage.set('hasDismissedInactivityPolicy', 'true');
  };

  // Robust ownership check
  const isOwner = useMemo(() => {
    if (!groupData?.ownerUserId || !userData?.uid) return false;
    return String(groupData.ownerUserId).trim() === String(userData.uid).trim();
  }, [groupData, userData]);


  // Log whenever messages or groupData updates to see incoming data




  const inputPlaceholder = useMemo(() => {
    const typeMessageRaw = t('groupChat.typeMessage');
    let candidates = [];

    if (Array.isArray(typeMessageRaw)) {
      // If it's an array (humorous list), add all items to increase their frequency
      candidates = [...typeMessageRaw];
    } else {
      // If string (other languages), just add the single string
      candidates.push(typeMessageRaw);
    }

    // Add other placeholders to the pool
    // In Japanese, these will be "diluted" by the many humorous options, appearing less frequently
    const inactivityThreshold = userData?.kickThreshold || 3;
    candidates.push(t('groupChat.placeholderInactivity', { days: inactivityThreshold }));
    candidates.push(t('groupChat.placeholderShare'));
    candidates.push(t('groupChat.placeholderEncourage'));

    return candidates[Math.floor(Math.random() * candidates.length)];
  }, [t, userData?.kickThreshold]); // Re-roll when language or threshold changes

  // Fetch user's read count when entering the group
  useEffect(() => {
    if (!groupId || !userData?.uid) return;

    let cancelled = false;
    const currentGroupId = groupId; // Capture current groupId

    const fetchReadCount = async () => {
      try {
        const userGroupStateRef = doc(db, 'users', userData.uid, 'groupStates', currentGroupId);
        // Use getDocFromServer to bypass cache
        const { getDocFromServer } = await import('firebase/firestore');
        const stateSnap = await getDocFromServer(userGroupStateRef);

        // Check if this request is still valid (groupId hasn't changed)
        if (cancelled) {
          return;
        }

        if (stateSnap.exists()) {
          const data = stateSnap.data();
          setUserReadCount(data.readMessageCount || 0);
        } else {
          setUserReadCount(0);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error fetching read count:", error);
          setUserReadCount(0);
        }
      }
    };

    fetchReadCount();

    return () => {
      cancelled = true;
    };
  }, [groupId, userData?.uid]);

  // Update read status when viewing the group (only when isActive and after initial scroll)
  useEffect(() => {
    if (!isActive || !userData || !groupId || !groupData || !initialScrollDone) return;

    // CRITICAL: Validate that groupData belongs to the current groupId
    if (groupData._groupId !== groupId) {
      return;
    }

    // Check if this is still the current group
    if (groupId !== currentGroupIdRef.current) {
      return;
    }

    // Cache values at effect start to prevent stale closures
    const cachedGroupId = groupId;
    // Use the maximum of the recorded count and the actual message list length to handle race conditions
    const cachedMessageCount = Math.max(groupData?.messageCount || 0, messages.length);
    let cancelled = false;

    const updateReadStatus = async () => {
      // Double check that groupId hasn't changed using ref
      if (cancelled || cachedGroupId !== currentGroupIdRef.current) {
        return;
      }

      // Optimization: Only update if the read count has actually increased
      // or if we haven't recorded a read timestamp in the group doc yet.
      // We also check if the last recorded timestamp is older than the last message.
      const hasReadTimestamp = groupData?.memberLastReadAt && groupData.memberLastReadAt[userData.uid];
      if (userReadCount !== null && cachedMessageCount <= userReadCount && hasReadTimestamp) {
        return;
      }

      const userGroupStateRef = doc(db, 'users', userData.uid, 'groupStates', cachedGroupId);

      try {
        // Prepare updates
        const updateTasks = [];

        // 1. Update personal state
        updateTasks.push(setDoc(userGroupStateRef, {
          readMessageCount: cachedMessageCount,
          lastReadAt: serverTimestamp()
        }, { merge: true }));

        // 2. Update group document with member's last read time for read-indicator
        const groupRef = doc(db, 'groups', cachedGroupId);
        updateTasks.push(updateDoc(groupRef, {
          [`memberLastReadAt.${userData.uid}`]: serverTimestamp()
        }));

        await Promise.all(updateTasks);

        // Update local state to prevent immediate re-run
        setUserReadCount(cachedMessageCount);
      } catch (error) {
        if (!cancelled) {
          console.error("Error updating read status:", error);
        }
      }
    };

    updateReadStatus();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, userData?.uid, isActive, initialScrollDone, messages.length, userReadCount, groupData?.messageCount]);

  // Track previous message count to only auto-scroll on new messages, not updates


  // Scroll to bottom using the end ref
  // Scroll to bottom using the container ref directly (safer than scrollIntoView which can shift viewport)
  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  };

  // Scroll to first unread message
  const scrollToFirstUnread = (firstUnreadIndex: number) => {
    if (!containerRef.current) return false;
    const messageElements = containerRef.current.querySelectorAll('.message-wrapper, .message.system-message');

    if (messageElements[firstUnreadIndex]) {
      const element = messageElements[firstUnreadIndex] as HTMLElement;
      // Calculate position relative to container
      const container = containerRef.current;
      const elementTop = element.offsetTop;

      // Scroll exactly to that position minus header offset
      // Assuming container is positioned relative or simply scrolling content
      container.scrollTop = elementTop - 100; // 100px buffer for header

      return true;
    }
    return false;
  };

  // Handle initial scroll - use useLayoutEffect for synchronous execution after DOM updates
  useLayoutEffect(() => {
    // Wait until we have all messages loaded (compare with groupData.messageCount)
    const expectedMessageCount = groupData?.messageCount || 0;
    // If loading is finished and we have messages (or it's empty group), proceed.
    // Do NOT block on expectedMessageCount mismatch, as that causes deadlocks if counts are out of sync.
    if (userReadCount === null || loading) return;
    if (messages.length === 0 && expectedMessageCount > 0) return; // Still loading messages?


    // Initial scroll - go to first unread message or bottom
    if (!initialScrollDone) {
      let scrolled = false;

      // 1. Try to restore last viewed position from LocalStorage
      if (userData?.uid) {
        const lastViewedMsgId = safeStorage.get(`last_viewed_msg_${groupId}_${userData.uid}`);
        if (lastViewedMsgId) {
          const targetEl = containerRef.current?.querySelector(`#message-${lastViewedMsgId}`) as HTMLElement | null;
          if (targetEl && containerRef.current) {
            // Scroll to this element with a slight offset for context. 
            // We use 'auto' behavior for instant jump on load.
            const offset = 20;
            containerRef.current.scrollTop = targetEl.offsetTop - offset;
            scrolled = true;
          }
        }
      }

      // 2. If no saved position, try unread messages
      if (!scrolled) {
        // If there are unread messages
        if (userReadCount < messages.length) {
          scrolled = scrollToFirstUnread(userReadCount);
        }
      }

      // 3. Fallback to bottom
      if (!scrolled) {
        scrollToBottom();
      }

      setInitialScrollDone(true);
      prevMessageCountRef.current = messages.length;
    }
  }, [messages, userReadCount, loading, initialScrollDone, groupData?.messageCount, groupId, userData?.uid]);

  // Handle new messages - scroll to bottom ONLY if a new message arrived at the bottom
  useEffect(() => {
    if (!initialScrollDone || messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];
    const prevLastMsgId = latestMessageRef.current?.id;

    // If we have more messages than before AND the last message is different, it means a new message came in.
    if (messages.length > prevMessageCountRef.current) {
      if (lastMsg.id !== prevLastMsgId) {
        scrollToBottom();
      }
    }

    prevMessageCountRef.current = messages.length;
    latestMessageRef.current = lastMsg;
  }, [messages, initialScrollDone]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [newMessage]);

  const handleShowMembers = async () => {
    setShowMobileMenu(false);
    setShowMembersModal(true);

    if (!groupData || !groupData.members || groupData.members.length === 0) {
      setMembersList([]);
      return;
    }

    setMembersLoading(true);
    try {
      const memberPromises = groupData.members.map(userId => getDoc(doc(db, 'users', userId)));
      const memberSnapshots = await Promise.all(memberPromises);

      const members = memberSnapshots.map(snap => {
        if (snap.exists()) {
          return { id: snap.id, ...snap.data() };
        }
        return { id: snap.id, nickname: 'Unknown User' };
      });

      setMembersList(members);
    } catch (error) {
      console.error("Error fetching members:", error);
      toast.error(t('groupChat.errorLoadMembers') || "Failed to load members list");
    } finally {
      setMembersLoading(false);
    }
  };

  const handleShowUnityModal = async () => {
    if (!groupData || !groupData.members) return;

    setShowUnityModal(true);

    const timeZone = userData?.timeZone || 'UTC';
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    // Exclude members who joined today from the calculation
    const memberJoinedAt = groupData.memberJoinedAt || {};
    const eligibleMemberIds = groupData.members.filter(uid => {
      const joinedTs = memberJoinedAt[uid];
      if (!joinedTs) return true; // No record = existing member
      let joinedTime = 0;
      if (joinedTs?.toDate) joinedTime = joinedTs.toDate().getTime();
      else if (joinedTs?.seconds) joinedTime = joinedTs.seconds * 1000;
      return joinedTime < todayTime;
    });

    const uniquePosters = new Set<string>();

    // SOURCE 1: dailyActivity
    if (groupData.dailyActivity?.activeMembers && (groupData.dailyActivity.date === todayStr || groupData.dailyActivity.date === new Date().toDateString())) {
      groupData.dailyActivity.activeMembers.forEach(uid => uniquePosters.add(uid));
    }

    // SOURCE 2: memberLastActive
    if (groupData.memberLastActive) {
      Object.entries(groupData.memberLastActive).forEach(([uid, ts]: [string, any]) => {
        let activeTime = 0;
        if (ts?.toDate) activeTime = ts.toDate().getTime();
        else if (ts?.seconds) activeTime = ts.seconds * 1000;
        if (activeTime >= todayTime) uniquePosters.add(uid);
      });
    }

    // SOURCE 3: Messages
    messages.forEach(msg => {
      let msgTime = 0;
      if (msg.createdAt?.toDate) msgTime = msg.createdAt.toDate().getTime();
      else if (msg.createdAt?.seconds) msgTime = msg.createdAt.seconds * 1000;
      if (msgTime >= todayTime && msg.senderId !== 'system' && !msg.isSystemMessage && msg.isNote) {
        uniquePosters.add(msg.senderId!);
      }
    });

    // Only count eligible members (not new today)
    const postedUids = Array.from(uniquePosters).filter(uid => eligibleMemberIds.includes(uid));
    const notPostedUids = eligibleMemberIds.filter(uid => !postedUids.includes(uid));

    setMembersLoading(true);
    try {
      const allUids = Array.from(new Set([...postedUids, ...notPostedUids]));
      const missingUids = allUids.filter(uid => !membersList.some(m => m.id === uid));

      let updatedMembersList = [...membersList];
      if (missingUids.length > 0) {
        const memberPromises = missingUids.map(uid => getDoc(doc(db, 'users', uid)));
        const memberSnapshots = await Promise.all(memberPromises);
        const newMembers = memberSnapshots.map(snap => snap.exists() ? { id: snap.id, ...snap.data() } as UserProfile : { id: snap.id, nickname: 'Unknown' } as UserProfile);
        updatedMembersList = [...membersList, ...newMembers];
        setMembersList(updatedMembersList);
      }

      const posted = postedUids.map(uid => ({ id: uid, nickname: updatedMembersList.find(m => m.id === uid)?.nickname || 'Unknown' }));
      const notPosted = notPostedUids.map(uid => ({ id: uid, nickname: updatedMembersList.find(m => m.id === uid)?.nickname || 'Unknown' }));

      setUnityModalData({ posted, notPosted });
    } catch (error) {
      console.error("Error fetching unity modal data:", error);
    } finally {
      setMembersLoading(false);
    }
  };

  const handleCheerClick = (member: UserProfile) => {
    if (member.id === userData?.uid) return;
    setCheerTarget(member);
  };

  const handleSendCheer = async () => {
    if (!cheerTarget) return;
    setIsSendingCheer(true);
    try {
      if (!auth) throw new Error("Firebase Auth not initialized");
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("No auth token");
      const response = await fetch(`${API_BASE}/api/send-cheer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          targetUid: cheerTarget.id,
          groupId: groupId,
          senderNickname: userData?.nickname || 'Someone',
          language: language
        })
      });

      if (response.ok && cheerTarget.id) {
        toast.success(t('groupChat.cheerSent') || "Cheer sent!");
        setCheeredTodayUids(prev => {
          const next = new Set<string>(prev);
          if (cheerTarget.id) next.add(cheerTarget.id);
          return next;
        });
      } else {
        const data = await response.json();
        if (data.error === 'alreadySent') {
          toast.info(t('groupChat.cheerAlreadySent') || "You've already sent a cheer to this member today.");
        } else {
          toast.error(t('groupChat.errorSendMessage') || "Failed to send cheer.");
        }
      }
    } catch (error) {
      console.error('Error sending cheer:', error);
      toast.error(t('groupChat.errorSendMessage') || "Failed to send cheer.");
    } finally {
      setIsSendingCheer(false);
      setCheerTarget(null);
    }
  };

  const handleUserProfileClick = async (userId: string | null) => {
    if (!userId || userId === 'system') return;

    // Check if we already have this user in our membersList
    const cachedMember = membersList.find(m => m.id === userId);
    if (cachedMember) {
      setSelectedMember(cachedMember);
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        setSelectedMember({ id: userDoc.id, ...userDoc.data() });
      } else {
        toast.error(t('groupChat.errorUserNotFound') || "User profile not found");
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      toast.error(t('groupChat.errorLoadProfile') || "Failed to load user profile");
    }
  };

  const handleScroll = () => {
    // Check for load previous trigger
    if (initialScrollDone && containerRef.current) {
      if (containerRef.current.scrollTop === 0 && hasMoreOlder && !isLoadingOlder) {
        loadMoreOlderMessages();
      }
    }

    // Do not save scroll position if we are still initializing or loading older
    if (!initialScrollDone || isLoadingOlder) return;

    if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);

    scrollDebounceRef.current = setTimeout(() => {
      if (!containerRef.current || !userData) return;
      const container = containerRef.current;
      const scrollTop = container.scrollTop;

      // Find the top-most visible message
      const messageElements = container.querySelectorAll('[id^="message-"]');
      let topMessageId = null;

      // We want to find the first message that is essentially "at the top" of the view
      // A message is at the top if its offsetTop is >= scrollTop
      for (const el of Array.from(messageElements)) {
        const htmlEl = el as HTMLElement;
        // 50px buffer to allow for partially scrolled messages
        if (htmlEl.offsetTop >= scrollTop - 50) {
          topMessageId = htmlEl.id.replace('message-', '');
          break;
        }
      }

      if (topMessageId) {
        safeStorage.set(`last_viewed_msg_${groupId}_${userData.uid}`, topMessageId);
      }
    }, 200) as any; // 200ms debounce
  };

  useLayoutEffect(() => {
    if (previousScrollHeightRef.current > 0 && containerRef.current) {
      const newHeight = containerRef.current.scrollHeight;
      const diff = newHeight - previousScrollHeightRef.current;
      if (diff > 0) {
        containerRef.current.scrollTop = diff;
      }
      previousScrollHeightRef.current = 0;
    }
  }, [messages]);

  const loadMoreOlderMessages = async () => {
    if (isLoadingOlder || !hasMoreOlder || messages.length === 0) return;

    if (containerRef.current) {
      previousScrollHeightRef.current = containerRef.current.scrollHeight;
    }

    setIsLoadingOlder(true);
    try {
      const oldestMsg = messages[0];
      if (!oldestMsg.createdAt) {
        setIsLoadingOlder(false);
        return;
      }

      const messagesRef = collection(db, 'groups', groupId, 'messages');
      const q = query(
        messagesRef,
        orderBy('createdAt', 'desc'),
        startAfter(oldestMsg.createdAt),
        limit(20)
      );

      const snaps = await getDocs(q);
      if (snaps.empty) {
        setHasMoreOlder(false);
        previousScrollHeightRef.current = 0;
      } else {
        const newOlderMsgs = snaps.docs.map(d => ({ id: d.id, ...d.data() } as Message)).reverse();
        setMessages(prev => [...newOlderMsgs, ...prev]);
      }
    } catch (e) {
      console.error("Error loading older messages", e);
      previousScrollHeightRef.current = 0;
    } finally {
      setIsLoadingOlder(false);
    }
  };

  const handleSendMessage = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (newMessage.trim() === '' || !userData) return;

    // Capture states before clearing for the API call
    const messageToSend = newMessage;
    const replyToData = replyTo;

    // Optimistically prepare reply data
    let replyData: any = null;
    if (replyToData) {
      let replyText;
      if (replyToData.isNote || replyToData.isEntry) {
        replyText = t('groupChat.studyNote');
      } else if (replyToData.text) {
        replyText = replyToData.text.substring(0, 50) + (replyToData.text.length > 50 ? '...' : '');
      } else {
        replyText = 'Image/Note';
      }

      replyData = {
        id: replyToData.id,
        senderNickname: replyToData.senderNickname || '',
        text: replyText,
        isNote: !!(replyToData.isNote || replyToData.isEntry)
      };
    }

    // 1. Optimistic UI: Clear input immediately to eliminate lag
    setNewMessage('');
    setReplyTo(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // 2. Optimistic UI: Add temporary message to the list to show immediately
    const optimisticMsgId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: optimisticMsgId,
      text: messageToSend,
      senderId: userData.uid,
      senderNickname: userData.nickname,
      senderPhotoURL: userData.profilePicUrl || userData.photoURL || null,
      createdAt: { seconds: Math.floor(Date.now() / 1000) },
      isNote: false,
      replyTo: replyData,
      isOptimistic: true
    };

    setMessages(prev => [...prev, optimisticMsg]);

    try {
      if (!auth) throw new Error("Firebase Auth not initialized");
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("No auth token");

      const response = await fetch(`${API_BASE}/api/post-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          groupId,
          text: messageToSend,
          replyTo: replyData
        })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      // Remove the optimistic message once the API responds.
      // The real message will be brought in by the Firestore snapshot listener almost simultaneously.
      setMessages(prev => prev.filter(m => m.id !== optimisticMsgId));

      // Update local read count in background
      const newReadCount = (groupData?.messageCount || messages.length) + 1;
      setUserReadCount(newReadCount);

    } catch (e: any) {
      console.error("Error sending message:", e);
      // Remove temp message if failed
      setMessages(prev => prev.filter(m => m.id !== optimisticMsgId));
      // Restore the message in input so user doesn't lose it if it fails
      setNewMessage(messageToSend);
      toast.error(`${t('groupChat.errorSendMessage') || 'Failed to send message'}: ${e.message || e}`);
    }
  };

  const handleReply = (msg: Message) => {
    setReplyTo(msg);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleLeaveGroup = async () => {
    if (!userData || !groupId) return;
    if (isLeaving) return;

    setIsLeaving(true);

    try {
      if (!auth) throw new Error("Firebase Auth not initialized");
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("No auth token");

      const response = await fetch(`${API_BASE}/api/leave-group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ groupId })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to leave group');
      }

      toast.success(t('groupChat.leftGroupSuccess') || "You have left the group.");
      navigate('/dashboard');
    } catch (error: any) {
      console.error("Error leaving group:", error);
      toast.error(`${t('groupChat.errorLeaveGroup') || 'Failed to leave group'}: ${error.message}`);
    } finally {
      setShowLeaveModal(false);
      setIsLeaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!userData || !groupId || !groupData) return;

    if (deleteConfirmationName !== groupData.name) {
      toast.error(t('groupChat.errorGroupNameMismatch') || "Group name does not match.");
      return;
    }

    // Verify ownership
    if (groupData.ownerUserId !== userData.uid) {
      toast.error(t('groupChat.errorOnlyOwnerDelete') || "Only the group owner can delete this group.");
      return;
    }

    try {
      if (!auth) throw new Error("Firebase Auth not initialized");
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("No auth token");

      const response = await fetch(`${API_BASE}/api/delete-group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ groupId })
      });

      if (!response.ok) {
        const text = await response.text();
        // If it's a 404/not found, it might already be deleted, so we can treat as success or specific error
        if (response.status === 404) {
          toast.success(t('groupChat.groupAlreadyDeleted') || "Group already deleted.");
          navigate('/dashboard');
          return;
        }
        throw new Error(text || 'Failed to delete group');
      }

      toast.success(t('groupChat.groupDeletedSuccess') || "Group deleted successfully.");
      navigate('/dashboard');
    } catch (error: any) {
      console.error("Error deleting group:", error);
      toast.error(`${t('groupChat.errorDeleteGroup') || 'Failed to delete group'}: ${error.message}`);
    } finally {
      setShowDeleteModal(false);
    }
  };

  const handleUpdateGroupName = async () => {
    if (!userData || !groupId || !groupData || !newGroupName.trim()) return;

    if (groupData.ownerUserId !== userData.uid) {
      toast.error(t('groupChat.errorOnlyOwnerChangeName') || "Only the group owner can change the group name.");
      return;
    }

    try {
      const updatePayload: any = {
        name: newGroupName.trim(),
        description: newGroupDescription.trim()
      };

      // Only update translation if language is present and user modified something
      if (language) {
        // If the user provided a translation, save it. 
        // Note: We use dot notation for nested fields update in Firestore
        if (newTranslatedName.trim()) {
          updatePayload[`translations.${language}.name`] = newTranslatedName.trim();
        }
        if (newTranslatedDesc.trim()) {
          updatePayload[`translations.${language}.description`] = newTranslatedDesc.trim();
        }
      }

      const groupRef = doc(db, 'groups', groupId);
      await updateDoc(groupRef, updatePayload);

      // Update local state immediately to reflect changes without waiting for round trip
      if (language && newTranslatedName.trim()) setTranslatedGroupName(newTranslatedName.trim());
      if (language && newTranslatedDesc.trim()) setTranslatedGroupDesc(newTranslatedDesc.trim());

      toast.success(t('groupChat.groupNameChanged'));
      setShowEditNameModal(false);
      setNewGroupName('');
      setNewGroupDescription('');
      setNewTranslatedName('');
      setNewTranslatedDesc('');
    } catch (error) {
      console.error("Error updating group name:", error);
      toast.error(t('groupChat.errorChangeGroupName'));
    }
  };

  const handleGenerateWeeklyRecap = async () => {
    if (!userData || !groupId || isRecapLoading) return;

    // Optional: Check if user is owner, or just let anyone generate for engagement (but maybe rate limit or only owner?)
    // For now, let's restrict to owner to avoid spamming system messages
    if (groupData?.ownerUserId !== userData.uid) {
      toast.error(t('groupChat.errorOnlyOwnerWeeklyRecap') || "Only the group owner can generate the weekly recap.");
      return;
    }

    setIsRecapLoading(true);
    toast.info(t('groupChat.generatingWeeklyRecap') || "Generating weekly recap... This may take a moment.");
    setShowMobileMenu(false);

    try {
      const response = await fetch(`${API_BASE}/api/generate-weekly-recap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groupId,
          language: language || 'en'
        })
      });

      if (response.status === 429) {
        toast.info(t('groupChat.recapRateLimit') || "Weekly recap can only be generated once a week.");
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to generate recap');
      }

      const data = await response.json();
      if (data.message && data.message.includes('No notes found')) {
        toast.info(t('groupChat.noNotesForRecap') || "No notes found for this week.");
      } else {
        toast.success(t('groupChat.weeklyRecapGenerated') || "Weekly recap generated!");
      }

    } catch (error) {
      console.error("Error generating recap:", error);
      toast.error(t('groupChat.errorWeeklyRecap') || "Failed to generate weekly recap.");
    } finally {
      setIsRecapLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      // Allow default behavior (newline)
      e.stopPropagation();
    }
  };

  useEffect(() => {
    (window as any).logTouch = (msg: string) => {
      const el = document.getElementById('touch-debug');
      if (el) {
        const time = new Date().toISOString().split('T')[1].slice(0, 12);
        el.innerHTML += `<div>[${time}] ${msg}</div>`;
        if (el.children.length > 8) el.firstChild?.remove();
      }
    };
    return () => {
      delete (window as any).logTouch;
    };
  }, []);

  // Context menu handler (triggered instantly on click now)
  const handleMessageClick = (msg: Message, e: any) => {
    // Get click coordinates (or touch if it was a tap translated to click)
    let x, y;
    if (e.clientX !== undefined) {
      x = e.clientX;
      y = e.clientY;
    } else if (e.touches && e.touches[0]) {
      x = e.touches[0].clientX;
      y = e.touches[0].clientY;
    } else {
      x = window.innerWidth / 2;
      y = window.innerHeight / 2;
    }

    setContextMenu({
      show: true,
      x: x,
      y: y,
      messageId: msg.id,
      message: msg
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ show: false, x: 0, y: 0, messageId: null, message: null });
  };

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.show) {
        closeContextMenu();
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [contextMenu.show]);

  const handleEditMessage = (msg: Message) => {
    if (msg.isNote || msg.isEntry) {
      // For notes/entries, open NewNote modal in edit mode
      // We need to convert the message to a note-like object for NewNote
      setNoteToEdit({
        id: msg.id,
        text: msg.text,
        scripture: msg.scripture,
        chapter: msg.chapter,
        groupMessageId: msg.id, // Mark this as coming from group chat
        groupId: groupId
      });
      closeContextMenu();
    } else {
      // For regular messages, use the simple edit modal
      setEditingMessage(msg);
      setEditText(msg.text || '');
      closeContextMenu();
    }
  };

  const handleSaveEdit = async () => {
    if (!editingMessage || !editText.trim()) return;

    try {
      const messageRef = doc(db, 'groups', groupId, 'messages', editingMessage.id);
      await updateDoc(messageRef, {
        text: editText,
        editedAt: serverTimestamp(),
        isEdited: true
      });

      setMessages(prev => prev.map(m =>
        m.id === editingMessage.id
          ? { ...m, text: editText, isEdited: true, editedAt: { seconds: Date.now() / 1000 } as any }
          : m
      ));

      toast.success(t('groupChat.messageEdited'));
      setEditingMessage(null);
      setEditText('');
    } catch (error) {
      console.error('Error editing message:', error);
      toast.error(t('groupChat.errorEditMessage') || 'Failed to edit message');
    }
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditText('');
  };

  const handleDeleteMessageClick = (msg: Message) => {
    setMessageToDelete(msg);
    setShowDeleteMessageModal(true);
    closeContextMenu();
  };

  const handleConfirmDeleteMessage = async () => {
    if (!messageToDelete) return;

    try {
      const messageRef = doc(db, 'groups', groupId, 'messages', messageToDelete.id);

      // Only delete the group message, NOT the personal note
      await deleteDoc(messageRef);

      // Decrement message count
      const groupRef = doc(db, 'groups', groupId);
      await updateDoc(groupRef, {
        messageCount: increment(-1),
        ...(messageToDelete.isNote ? { noteCount: increment(-1) } : {}) // Decrement noteCount if it was a note
      });

      setMessages(prev => prev.filter(m => m.id !== messageToDelete.id));

      toast.success(t('groupChat.messageDeleted'));
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error(t('groupChat.errorDeleteMessage') || 'Failed to delete message');
    } finally {
      setMessageToDelete(null);
      setShowDeleteMessageModal(false);
    }
  };

  // Handle adding/removing reaction
  const handleToggleReaction = async (msg: Message) => {
    if (!userData || !groupId) return;
    closeContextMenu();

    try {
      const messageRef = doc(db, 'groups', groupId, 'messages', msg.id);
      const reactions = msg.reactions || [];
      const existingReaction = reactions.find(r => r.odU === userData.uid);

      if (existingReaction) {
        // Remove reaction
        await updateDoc(messageRef, {
          reactions: arrayRemove(existingReaction)
        });

        // Optimistic Remove
        setMessages(prev => prev.map(m => {
          if (m.id === msg.id) {
            return { ...m, reactions: (m.reactions || []).filter(r => r.odU !== userData.uid) };
          }
          return m;
        }));
      } else {
        // Add reaction
        await updateDoc(messageRef, {
          reactions: arrayUnion({
            odU: userData.uid,
            nickname: userData.nickname || 'Unknown',
            emoji: '👍'
          })
        });

        // Optimistic Add (with duplicate prevention)
        setMessages(prev => prev.map(m => {
          if (m.id === msg.id) {
            const currentReactions = m.reactions || [];
            // If already present (e.g. from onSnapshot), don't add again
            if (currentReactions.some(r => r.odU === userData.uid)) return m;
            return { ...m, reactions: [...currentReactions, { odU: userData.uid, nickname: userData.nickname || 'Unknown', emoji: '👍' }] };
          }
          return m;
        }));
      }
    } catch (error) {
      console.error('Error toggling reaction:', error);
    }
  };

  // Show reactions modal
  const handleShowReactions = (reactions: any[]) => {
    setReactionsToShow(reactions || []);
    setShowReactionsModal(true);
  };

  const handleTranslateMessage = async (msg: Message) => {
    if (translatingIds.has(msg.id)) return;

    // If already translated, clear it (toggle)
    if (translatedTexts[msg.id]) {
      setTranslatedTexts(prev => {
        const next = { ...prev };
        delete next[msg.id];
        return next;
      });
      return;
    }

    setTranslatingIds(prev => {
      const next = new Set<string>(prev);
      next.add(msg.id);
      return next;
    });

    try {
      if (!auth) throw new Error("Firebase Auth not initialized");
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("No auth token");

      let textToTranslate = msg.text || '';
      const isNote = msg.isNote || msg.isEntry || msg.text?.match(NOTE_HEADER_REGEX);

      if (isNote) {
        // Extract only the comment for translation
        const body = removeNoteHeader(msg.text || '');
        const chapterMatch = body.match(/\*\*(?:Chapter|Title|Speech|Talk):\*\* (.*?)(?:\n|$)/);
        const scriptureMatch = body.match(/\*\*Scripture:\*\* (.*?)(?:\n|$)/);

        if (chapterMatch && chapterMatch.index !== undefined) {
          textToTranslate = body.substring(chapterMatch.index + chapterMatch[0].length).trim();
        } else if (scriptureMatch && scriptureMatch.index !== undefined) {
          textToTranslate = body.substring(scriptureMatch.index + scriptureMatch[0].length).trim();
        } else {
          textToTranslate = body;
        }
      }

      const response = await fetch(`${API_BASE}/api/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          text: textToTranslate,
          targetLanguage: language
        })
      });

      if (!response.ok) throw new Error('Translation failed');

      const data = await response.json();
      setTranslatedTexts(prev => ({ ...prev, [msg.id]: data.translatedText }));
    } catch (error) {
      console.error("Error translating message:", error);
      toast.error(t('groupChat.errorTranslation') || "Failed to translate message");
    } finally {
      setTranslatingIds(prev => {
        const next = new Set<string>(prev);
        next.delete(msg.id);
        return next;
      });
    }
  };

  const handleReportClick = (msg: Message) => {
    setReportedMessage(msg);
    setReportReason('inappropriate');
    setShowReportModal(true);
    setContextMenu({ ...contextMenu, show: false });
  };

  const confirmReport = async () => {
    if (!reportedMessage || !userData) return;

    try {
      if (!auth) throw new Error("Firebase Auth not initialized");
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("No auth token");

      const response = await fetch(`${API_BASE}/api/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          messageId: reportedMessage.id,
          groupId: groupId,
          reporterNickname: userData.nickname || 'Unknown',
          reportedUserId: reportedMessage.senderId,
          reportedUserNickname: reportedMessage.senderNickname,
          messageText: reportedMessage.text,
          reason: reportReason
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit report');
      }

      toast.success(t('groupChat.reportSuccess') || "Report sent successfully.");
      setShowReportModal(false);
      setReportedMessage(null);
    } catch (error) {
      console.error("Error submitting report:", error);
      toast.error("Failed to submit report. Please try again.");
    }
  };

  const togglePublicStatus = async () => {
    if (!groupData || !groupId) return;
    try {
      const groupRef = doc(db, 'groups', groupId);
      await updateDoc(groupRef, {
        isPublic: !groupData.isPublic
      });
      toast.success(t('groupChat.groupStatusUpdated', { status: !groupData.isPublic ? t('groupChat.public') : t('groupChat.private') }) || `Group is now ${!groupData.isPublic ? 'Public' : 'Private'}`);
    } catch (error) {
      console.error("Error updating group status:", error);
      toast.error(t('groupChat.errorUpdateGroupStatus') || "Failed to update group status");
    }
  };


  const handleCopyInviteLink = () => {
    if (groupData && groupData.inviteCode) {
      const baseUrl = window.location.origin;
      const inviteLink = `${baseUrl}/join/${groupData.inviteCode}?openExternalBrowser=1`;
      navigator.clipboard.writeText(inviteLink);
      toast.success(t('groupChat.inviteLinkCopied'));
    }
  };

  const handleShareLine = () => {
    if (groupData && groupData.inviteCode) {
      const inviteLink = `${window.location.origin}/join/${groupData.inviteCode}?openExternalBrowser=1`;
      const text = t('groupChat.inviteMessage')
        .replace('{groupName}', groupData.name)
        .replace('{inviteLink}', inviteLink);
      const url = `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
      window.open(url, '_blank');
    }
  };

  const handleShareWhatsApp = () => {
    if (groupData && groupData.inviteCode) {
      const inviteLink = `${window.location.origin}/join/${groupData.inviteCode}?openExternalBrowser=1`;
      const text = t('groupChat.inviteMessage')
        .replace('{groupName}', groupData.name)
        .replace('{inviteLink}', inviteLink);
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
    }
  };

  const handleShareMessenger = async () => {
    if (groupData && groupData.inviteCode) {
      const inviteLink = `${window.location.origin}/join/${groupData.inviteCode}?openExternalBrowser=1`;
      const text = t('groupChat.inviteMessage')
        .replace('{groupName}', groupData.name || '')
        .replace('{inviteLink}', inviteLink);

      // 1. Try Native Web Share API (Best for Mobile)
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Scripture Habit',
            text: text,
            url: inviteLink,
          });
          return;
        } catch (err: any) {
          console.log("Native share failed", err);
          // If user cancelled, don't fall back
          if (err.name === 'AbortError') return;
        }
      }

      // 2. Fallback: Copy and Open Messenger.com (Desktop)
      navigator.clipboard.writeText(text);
      toast.info(t('groupChat.inviteLinkCopied'));
      window.open('https://www.messenger.com/', '_blank');
    }
  };

  const handleShareInstagram = async () => {
    if (groupData && groupData.inviteCode) {
      const inviteLink = `${window.location.origin}/join/${groupData.inviteCode}?openExternalBrowser=1`;
      const text = t('groupChat.inviteMessage')
        .replace('{groupName}', groupData.name || '')
        .replace('{inviteLink}', inviteLink);

      // 1. Try Native Web Share API (Best for Mobile)
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Scripture Habit',
            text: text,
            url: inviteLink,
          });
          return;
        } catch (err: any) {
          console.log("Native share failed", err);
          if (err.name === 'AbortError') return;
        }
      }

      // 2. Fallback: Copy and Open Instagram
      navigator.clipboard.writeText(text);
      toast.info(t('groupChat.inviteLinkCopied'));
      window.open('https://www.instagram.com/', '_blank');
    }
  };

  /* 
   * Check if weekly recap is available (7 day cooldown)
   */
  const getLastRecapDate = () => {
    if (groupData?.lastRecapGeneratedAt?.toDate) {
      return groupData.lastRecapGeneratedAt.toDate();
    }
    // Handle specific case where it might be a raw timestamp object (if not converted by Firestore SDK yet in some edge cases)
    if (groupData?.lastRecapGeneratedAt?.seconds) {
      return new Date(groupData.lastRecapGeneratedAt.seconds * 1000);
    }
    return null;
  };

  const lastRecapDate = getLastRecapDate();
  const daysSinceLastRecap = lastRecapDate
    ? (new Date().getTime() - lastRecapDate.getTime()) / (1000 * 60 * 60 * 24)
    : 100; // if never generated, treat as long time ago

  const isRecapAvailable = daysSinceLastRecap >= 7;

  const handleRecapClick = (e: React.MouseEvent) => {
    if (isRecapLoading) return;
    if (!isRecapAvailable) {
      e.stopPropagation();
      toast.info(t('groupChat.recapRateLimit') || "Weekly recap can only be generated once a week.");
      return;
    }
    handleGenerateWeeklyRecap();
  };

  const isAnyModalOpen = showLeaveModal || showDeleteModal || showDeleteMessageModal || editingMessage || showReactionsModal || isNewNoteOpen || noteToEdit || showEditNameModal || showMembersModal || showUnityModal || showInviteModal || showReportModal || cheerTarget || isExternalModalOpen;

  // Calculate Unity Score (Percentage of members who posted today)
  const unityPercentage = useMemo(() => {
    if (!groupData?.members || groupData.members.length === 0 || groupData?._groupId !== groupId) return 0;

    const timeZone = userData?.timeZone || 'UTC';
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    // Exclude members who joined today (they haven't had a chance to post yet)
    const memberJoinedAt = groupData.memberJoinedAt || {};
    const eligibleMembers = groupData.members.filter(uid => {
      const joinedTs = memberJoinedAt[uid];
      if (!joinedTs) return true; // No join record = existing member, always eligible
      let joinedTime = 0;
      if (joinedTs?.toDate) joinedTime = joinedTs.toDate().getTime();
      else if (joinedTs?.seconds) joinedTime = joinedTs.seconds * 1000;
      return joinedTime < todayTime; // Exclude if joined today
    });

    if (eligibleMembers.length === 0) return 0;

    const uniquePosters = new Set<string>();

    // SOURCE 1: dailyActivity (Current day metadata)
    if (groupData.dailyActivity?.activeMembers && (groupData.dailyActivity.date === todayStr || groupData.dailyActivity.date === new Date().toDateString())) {
      groupData.dailyActivity.activeMembers.forEach(uid => uniquePosters.add(uid));
    }

    // SOURCE 2: memberLastActive (Per-member note tracking)
    if (groupData.memberLastActive) {
      Object.entries(groupData.memberLastActive).forEach(([uid, ts]: [string, any]) => {
        let activeTime = 0;
        if (ts?.toDate) activeTime = ts.toDate().getTime();
        else if (ts?.seconds) activeTime = ts.seconds * 1000;

        if (activeTime >= todayTime) {
          uniquePosters.add(uid);
        }
      });
    }

    // SOURCE 3: Recent messages (Fallback for safety)
    messages.forEach(msg => {
      let msgTime = 0;
      if (msg.createdAt?.toDate) msgTime = msg.createdAt.toDate().getTime();
      else if (msg.createdAt?.seconds) msgTime = msg.createdAt.seconds * 1000;

      if (msgTime >= todayTime && msg.senderId !== 'system' && !msg.isSystemMessage && msg.isNote) {
        uniquePosters.add(msg.senderId!);
      }
    });

    // Only count posters who are eligible members (not new today)
    const eligiblePostersCount = [...uniquePosters].filter(uid => eligibleMembers.includes(uid)).length;
    const score = Math.round((eligiblePostersCount / eligibleMembers.length) * 100);
    return Math.min(100, Math.max(0, score));
  }, [messages, groupData, groupId, userData?.timeZone]);

  // Synchronize Daily Activity Data removed because it caused infinite loops and quota issues.
  // Daily activity is now updated explicitly when sending messages/notes.

  // Track previous percentage to trigger effect only on change
  useEffect(() => {
    if (!userData?.uid || !groupId) return;

    if (unityPercentage === 100) {
      const timeZone = userData?.timeZone || 'UTC';
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone });
      const storageKey = `unity_firework_${groupId}_${userData.uid}`;
      const lastSeen = safeStorage.get(storageKey);

      if (lastSeen !== todayStr) {
        // Fire confetti!
        const duration = 3 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval = setInterval(function () {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            return clearInterval(interval);
          }

          const particleCount = 50 * (timeLeft / duration);
          confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
          confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);

        // Mark as seen for today
        safeStorage.set(storageKey, todayStr);

        // EXTRA: Send a system message to the chat if not already sent today
        // Use group-level tracking to prevent duplicates from multiple users
        const groupRef = doc(db, 'groups', groupId);

        // Check if announcement was already sent today at group level using a transaction to prevent duplicates
        const checkAndSendAnnouncement = async () => {
          try {
            await runTransaction(db, async (transaction) => {
              const groupSnap = await transaction.get(groupRef);
              if (!groupSnap.exists()) return;

              const lastAnnouncementDate = groupSnap.data()?.lastUnityAnnouncementDate;

              // If no announcement was sent today, send one
              if (lastAnnouncementDate !== todayStr) {
                // Update the group's last announcement date first to "lock" it
                transaction.update(groupRef, {
                  lastUnityAnnouncementDate: todayStr
                });

                // Add the message inside the transaction
                const messagesRef = collection(db, 'groups', groupId, 'messages');
                const newMessageRef = doc(messagesRef);
                transaction.set(newMessageRef, {
                  senderId: 'system',
                  isSystemMessage: true,
                  messageType: 'unityAnnouncement',
                  createdAt: serverTimestamp()
                });
              }
            });
          } catch (err) {
            console.error("Error sending unity announcement:", err);
          }
        };

        checkAndSendAnnouncement();
      }
    }
  }, [unityPercentage, groupId, userData?.uid, userData?.timeZone]);

  if (!groupId) return null;

  return (
    <div className="GroupChat" >
      <NewNote
        isOpen={isNewNoteOpen || noteToEdit !== null}
        onClose={() => {
          setIsNewNoteOpen(false);
          setNoteToEdit(null);
        }}
        userData={userData}
        isGroupContext={true}
        userGroups={userGroups}
        currentGroupId={groupId}
        noteToEdit={noteToEdit}
      />
      <div className="chat-header">
        <div className="header-left">
          {onBack && (
            <div className="back-button" onClick={onBack}>
              <UilArrowLeft size="24" />
            </div>
          )}
          <h2 style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <span className="group-name-text" title={groupData ? groupData.name : t('groupChat.groupName')}>
              {groupData ? (translatedGroupName || groupData.name) : t('groupChat.groupName')}
            </span>
            {groupData?.ownerUserId === userData?.uid && (
              <button
                className="edit-group-name-btn"
                onClick={() => {
                  setNewGroupName(groupData.name);
                  setNewGroupDescription(groupData.description || '');
                  // Initialize with current translated values or fallbacks
                  setNewTranslatedName(translatedGroupName || groupData.translations?.[language]?.name || '');
                  setNewTranslatedDesc(translatedGroupDesc || groupData.translations?.[language]?.description || '');
                  setShowEditNameModal(true);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--gray)',
                  cursor: 'pointer',
                  marginLeft: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px',
                  borderRadius: '50%',
                  transition: 'background 0.2s',
                  flexShrink: 0
                }}
                title={t('groupChat.changeGroupName')}
              >
                <UilPen size="18" />
              </button>
            )}
            {groupData?.members && <span className="member-count-badge" style={{ flexShrink: 0 }}>({groupData.members.length})</span>}

            {groupData && (
              <div className="unity-score-container">
                <span
                  className={`unity-score-badge ${unityPercentage === 100 ? 'celestial' : ''}`}
                  onClick={handleShowUnityModal}
                  title="Unity Score: members active today"
                >
                  <span className="unity-icon">
                    {unityPercentage === 100 ? '☀️' :
                      unityPercentage >= 66 ? '🌕' :
                        unityPercentage >= 33 ? '🌠' :
                          '🌑'}
                  </span>
                  <span className="unity-percent-text">{unityPercentage}%</span>
                </span>
              </div>
            )}

          </h2>
        </div>
        {groupData && (
          <>
            {/* Desktop header - hidden on mobile */}
            <div className="header-right desktop-only">
              {isOwner && (
                <div className="group-status-toggle">
                  <span className="status-label">{groupData.isPublic ? t('groupChat.public') : t('groupChat.private')}</span>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={groupData.isPublic || false}
                      onChange={togglePublicStatus}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
              )}
              <div className="invite-code-wrapper">
                <div className="invite-code-display" onClick={() => setShowInviteModal(true)} title={t('groupChat.inviteLink')}>
                  <span>{t('groupChat.inviteLink')}</span>
                  <UilCopy size="16" className="copy-icon" />
                </div>
              </div>

              <div className="invite-code-display members-btn-desktop" onClick={handleShowMembers} title={t('groupChat.members')}>
                <UilUsersAlt size="16" className="copy-icon" />
                <span className="desktop-members-label">{t('groupChat.members')}</span>
              </div>

              {isOwner && (
                <div
                  className={`invite-code-display members-btn-desktop ${(!isRecapAvailable || isRecapLoading) ? 'disabled' : ''}`}
                  onClick={handleRecapClick}
                  title={!isRecapAvailable ? (t('groupChat.recapRateLimit') || "Weekly recap available next week") : (t('groupChat.generateWeeklyRecap') || "Weekly Recap")}
                  style={{
                    marginRight: '8px',
                    opacity: (!isRecapAvailable || isRecapLoading) ? 0.5 : 1,
                    cursor: (!isRecapAvailable || isRecapLoading) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>📊</span>
                  {isRecapLoading && <div className="spinner-mini"></div>}
                </div>
              )}

              {isOwner ? (
                <button className="leave-group-btn delete-group-btn" onClick={() => setShowDeleteModal(true)} title={t('groupChat.deleteGroup')}>
                  <UilTrashAlt size="20" />
                </button>
              ) : (
                <button className="leave-group-btn" onClick={() => setShowLeaveModal(true)} title={t('groupChat.leaveGroup')}>
                  <UilSignOutAlt size="20" />
                </button>
              )}
            </div>

            {/* Mobile hamburger menu button */}
            <div className="hamburger-container mobile-only">
              {groupData.members && groupData.members.length === 1 && (
                <div className="header-invite-btn-mobile" onClick={() => setShowInviteModal(true)} title={t('groupChat.inviteLink')}>
                  <span style={{ fontSize: '1.2rem' }}>🎁</span>
                </div>
              )}
              <button
                className="hamburger-btn"
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                aria-label="Menu"
              >
                <span className={`hamburger-icon ${showMobileMenu ? 'open' : ''}`}>
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Mobile menu overlay - placed outside chat-header for proper positioning */}
      {showMobileMenu && groupData && (
        <div className="mobile-menu-overlay" onClick={() => setShowMobileMenu(false)}>
          <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-menu-header">
              <h3>{translatedGroupName || groupData.name}</h3>
              <button className="close-menu-btn" onClick={() => setShowMobileMenu(false)}>
                <UilTimes size="24" />
              </button>
            </div>

            <div className="mobile-menu-content">
              {/* Invite Link Section */}
              <div className="mobile-menu-item invite-section" onClick={() => { setShowInviteModal(true); setShowMobileMenu(false); }}>
                <div className="menu-item-icon">
                  <UilCopy size="20" />
                </div>
                <div className="menu-item-content">
                  <span className="menu-item-label">{t('groupChat.inviteLink')}</span>
                </div>
              </div>

              {/* Public/Private Toggle (Owner only) */}
              {isOwner && (
                <div className="mobile-menu-item toggle-section">
                  <div className="menu-item-content">
                    <span className="menu-item-label">{groupData.isPublic ? t('groupChat.public') : t('groupChat.private')}</span>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={groupData.isPublic || false}
                      onChange={() => { togglePublicStatus(); }}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
              )}

              {/* Change Group Name (Owner only) */}
              {isOwner && (
                <div className="mobile-menu-item" onClick={() => {
                  setNewGroupName(groupData.name);
                  setNewGroupDescription(groupData.description || '');
                  setNewTranslatedName(translatedGroupName || groupData.translations?.[language]?.name || '');
                  setNewTranslatedDesc(translatedGroupDesc || groupData.translations?.[language]?.description || '');
                  setShowMobileMenu(false);
                  setShowEditNameModal(true);
                }}>
                  <div className="menu-item-icon">
                    <UilPen size="20" />
                  </div>
                  <div className="menu-item-content">
                    <span className="menu-item-label">{t('groupChat.changeGroupName')}</span>
                  </div>
                </div>
              )}

              {/* Members List Item */}
              <div className="mobile-menu-item" onClick={handleShowMembers}>
                <div className="menu-item-icon">
                  <UilUsersAlt size="20" />
                </div>
                <div className="menu-item-content">
                  <span className="menu-item-label">{t('groupChat.members')}</span>
                </div>
              </div>

              <div className="mobile-menu-divider"></div>

              {/* Weekly Recap - Owner Only */}
              {isOwner && (
                <div
                  className={`mobile-menu-item ${(!isRecapAvailable || isRecapLoading) ? 'disabled' : ''}`}
                  onClick={(e) => {
                    if (isRecapLoading) return;
                    if (!isRecapAvailable) {
                      e.stopPropagation();
                      toast.info(t('groupChat.recapRateLimit') || "Weekly recap can only be generated once a week.");
                    } else {
                      handleGenerateWeeklyRecap();
                    }
                  }}
                  style={{
                    opacity: (!isRecapAvailable || isRecapLoading) ? 0.5 : 1,
                    cursor: (!isRecapAvailable || isRecapLoading) ? 'not-allowed' : 'pointer'
                  }}
                >
                  <div className="menu-item-icon">
                    {isRecapLoading ? <div className="spinner-mini"></div> : <span style={{ fontSize: '1.2rem' }}>📊</span>}
                  </div>
                  <div className="menu-item-content">
                    <span className="menu-item-label">{isRecapLoading ? (t('groupChat.generatingWeeklyRecap') || "Generating...") : (t('groupChat.generateWeeklyRecap') || "Weekly Recap")}</span>
                    {!isRecapAvailable && !isRecapLoading && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--red)' }}>
                        {Math.ceil(7 - daysSinceLastRecap) > 0
                          ? (t('groupChat.daysLeft') || "{days} days left").replace('{days}', String(Math.ceil(7 - daysSinceLastRecap)))
                          : (t('groupChat.availableSoon') || "Available soon")}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="mobile-menu-divider"></div>

              {/* Leave/Delete Group */}
              {isOwner ? (
                <div
                  className="mobile-menu-item danger"
                  onClick={() => { setShowMobileMenu(false); setShowDeleteModal(true); }}
                >
                  <div className="menu-item-icon">
                    <UilTrashAlt size="20" />
                  </div>
                  <span className="menu-item-label">{t('groupChat.deleteGroup')}</span>
                </div>
              ) : (
                <div
                  className="mobile-menu-item danger"
                  onClick={() => { setShowMobileMenu(false); setShowLeaveModal(true); }}
                >
                  <div className="menu-item-icon">
                    <UilSignOutAlt size="20" />
                  </div>
                  <span className="menu-item-label">{t('groupChat.leaveGroup')}</span>
                </div>
              )}

              {/* Group List Section */}
              <div className="mobile-menu-divider"></div>
              <div className="mobile-menu-section-title" style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', color: 'var(--gray)', fontWeight: '600' }}>
                My Groups
              </div>
              <div className="mobile-groups-list">
                {userGroups.map((group) => (
                  <GroupMenuItem
                    key={group.id}
                    group={group}
                    currentGroupId={groupId}
                    language={language}
                    onSelect={() => {
                      if (onGroupSelect) onGroupSelect(group.id);
                      setShowMobileMenu(false);
                    }}
                    timeZone={userData?.timeZone}
                  />
                ))}
              </div>
              {userGroups.length < 12 && (
                <>
                  <div className="mobile-menu-divider"></div>
                  <div
                    className="mobile-menu-item"
                    onClick={() => {
                      navigate('/group-options');
                      setShowMobileMenu(false);
                    }}
                  >
                    <div className="menu-item-icon">
                      <UilPlusCircle size="20" />
                    </div>
                    <span className="menu-item-label">{t('sidebar.joinCreateGroup')}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showInactivityPolicyBanner && (
        <div className="inactivity-policy-banner">
          <span>{t('groupChat.inactivityPolicyBanner', { days: userData?.kickThreshold || 3 })}</span>
          <button className="inactivity-policy-dismiss" onClick={handleDismissInactivityBanner}>
            <UilTimes size="16" />
          </button>
        </div>
      )}

      <div
        className="messages-container"
        ref={containerRef}
        onScroll={handleScroll}
        onClick={() => {
          if (editingMessage) handleCancelEdit();
          if (replyTo) setReplyTo(null);
          // if contextMenu is open, close it
          if (contextMenu.show) setContextMenu({ show: false, x: 0, y: 0, messageId: null });
        }}
      >
        {loading && <div className="loading-spinner"><div className="spinner"></div></div>}
        {!loading && hasMoreOlder && (
          <div className="load-more-container">
            {isLoadingOlder ? (
              <div className="spinner"></div>
            ) : (
              <button
                className="load-more-btn"
                onClick={loadMoreOlderMessages}
                disabled={isLoadingOlder}
              >
                {t('groupChat.loadPreviousMessages') === 'groupChat.loadPreviousMessages' ? 'Load previous messages' : t('groupChat.loadPreviousMessages')}
              </button>
            )}
          </div>
        )}

        {messages.map((msg, index) => {
          const showDateDivider = index === 0 ||
            new Date(messages[index - 1].createdAt?.toDate?.() || messages[index - 1].createdAt?.seconds * 1000).toDateString() !==
            new Date(msg.createdAt?.toDate?.() || msg.createdAt?.seconds * 1000).toDateString();

          const messageDate = new Date(msg.createdAt?.toDate?.() || msg.createdAt?.seconds * 1000 || Date.now());

          return (
            <Fragment key={msg.id}>
              {showDateDivider && (
                <div className="date-separator">
                  <span>
                    {messageDate.toLocaleDateString(language, {
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              )}

              <MessageItem
                msg={msg}
                userData={userData}
                t={t}
                handleMessageClick={handleMessageClick}
                handleEditMessage={handleEditMessage}
                handleDeleteMessageClick={handleDeleteMessageClick}
                handleReply={handleReply}
                handleTranslateMessage={handleTranslateMessage}
                translatingIds={translatingIds}
                handleToggleReaction={handleToggleReaction}
                handleReportClick={handleReportClick}
                handleUserProfileClick={handleUserProfileClick}
                groupData={groupData}
                translatedTexts={translatedTexts}
                language={language}
                handleShowReactions={handleShowReactions}
                membersMap={membersMap}
              />
              {/* Unread Message Divider */}
              {userReadCount !== null && index === Math.max(0, userReadCount - 1) && index < messages.length - 1 && msg.senderId !== 'system' && (
                <div className="unread-divider">
                  <span>{t('groupChat.newMessages')}</span>
                </div>
              )}
            </Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Context Menu for long press */}
      {contextMenu.show && contextMenu.message && (
        <>
          <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, background: 'transparent' }} onClick={closeContextMenu} />
          <div
            className="message-context-menu"
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              transform: 'translate(-50%, -100%)',
              zIndex: 1001,
              marginTop: '-10px' // Offset to show above finger
            }}
          >
            <button style={{ display: 'flex', alignItems: 'center', gap: '14px', justifyContent: 'flex-start' }} onClick={() => {
              handleReply(contextMenu.message!);
              closeContextMenu();
            }}>
              <div style={{ width: '22px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <UilCommentAlt size="18" />
              </div>
              <span style={{ flex: 1 }}>{t('groupChat.reply') || "Reply"}</span>
            </button>

            {contextMenu.message.senderId !== userData?.uid && (
              <button style={{ display: 'flex', alignItems: 'center', gap: '14px', justifyContent: 'flex-start' }} onClick={() => {
                handleToggleReaction(contextMenu.message!);
                closeContextMenu();
              }}>
                <div style={{ width: '22px', fontSize: '18px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  👍
                </div>
                <span style={{ flex: 1 }}>{contextMenu.message?.reactions?.find(r => r.odU === userData?.uid) ? t('groupChat.unlike') : t('groupChat.like')}</span>
              </button>
            )}

            {contextMenu.message.senderId === userData?.uid && (
              <button style={{ display: 'flex', alignItems: 'center', gap: '14px', justifyContent: 'flex-start' }} onClick={() => {
                handleEditMessage(contextMenu.message!);
                closeContextMenu();
              }}>
                <div style={{ width: '22px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <UilPen size="18" />
                </div>
                <span style={{ flex: 1 }}>{t('groupChat.editMessage') || "Edit"}</span>
              </button>
            )}

            {/* ONLY show delete for YOUR OWN messages, as requested. (Owners can moderator-delete from elsewhere or we hide it here per user's specific request) */}
            {contextMenu.message.senderId === userData?.uid && (
              <button className="delete-option" style={{ display: 'flex', alignItems: 'center', gap: '14px', justifyContent: 'flex-start' }} onClick={() => {
                handleDeleteMessageClick(contextMenu.message!);
                closeContextMenu();
              }}>
                <div style={{ width: '22px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <UilTrashAlt size="18" />
                </div>
                <span style={{ flex: 1 }}>{t('groupChat.deleteMessage') || "Delete"}</span>
              </button>
            )}

            <button style={{ display: 'flex', alignItems: 'center', gap: '14px', justifyContent: 'flex-start' }} onClick={() => {
              handleTranslateMessage(contextMenu.message!);
              closeContextMenu();
            }}>
              <div style={{ width: '22px', fontSize: '18px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {translatingIds.has(contextMenu.message!.id) ? '⏳' : '✨'}
              </div>
              <span style={{ flex: 1 }}>{t('groupChat.translate') || "Translate"}</span>
            </button>

            {contextMenu.message.senderId !== userData?.uid && (
              <button style={{ display: 'flex', alignItems: 'center', gap: '14px', justifyContent: 'flex-start' }} onClick={() => {
                handleReportClick(contextMenu.message!);
                closeContextMenu();
              }}>
                <div style={{ width: '22px', fontSize: '18px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  🚩
                </div>
                <span style={{ flex: 1 }}>{t('groupChat.report')}</span>
              </button>
            )}
          </div>
        </>
      )}

      <GroupChatModals
        t={t}
        language={language}
        userData={userData}
        groupData={groupData}

        showLeaveModal={showLeaveModal}
        setShowLeaveModal={setShowLeaveModal}
        isLeaving={isLeaving}
        handleLeaveGroup={handleLeaveGroup}

        showDeleteModal={showDeleteModal}
        setShowDeleteModal={setShowDeleteModal}
        deleteConfirmationName={deleteConfirmationName}
        setDeleteConfirmationName={setDeleteConfirmationName}
        handleDeleteGroup={handleDeleteGroup}

        showEditNameModal={showEditNameModal}
        setShowEditNameModal={setShowEditNameModal}
        newGroupName={newGroupName}
        setNewGroupName={setNewGroupName}
        newGroupDescription={newGroupDescription}
        setNewGroupDescription={setNewGroupDescription}
        newTranslatedName={newTranslatedName}
        setNewTranslatedName={setNewTranslatedName}
        newTranslatedDesc={newTranslatedDesc}
        setNewTranslatedDesc={setNewTranslatedDesc}
        handleUpdateGroupName={handleUpdateGroupName}
        translatedGroupName={translatedGroupName}
        translatedGroupDesc={translatedGroupDesc}

        showDeleteMessageModal={showDeleteMessageModal}
        setShowDeleteMessageModal={setShowDeleteMessageModal}
        messageToDelete={messageToDelete}
        setMessageToDelete={setMessageToDelete}
        handleConfirmDeleteMessage={handleConfirmDeleteMessage}

        editingMessage={editingMessage}
        editText={editText}
        setEditText={setEditText}
        handleCancelEdit={handleCancelEdit}
        handleSaveEdit={handleSaveEdit}

        showReactionsModal={showReactionsModal}
        setShowReactionsModal={setShowReactionsModal}
        reactionsToShow={reactionsToShow}

        showMembersModal={showMembersModal}
        setShowMembersModal={setShowMembersModal}
        membersList={membersList}
        membersLoading={membersLoading}
        setSelectedMember={setSelectedMember}

        showUnityModal={showUnityModal}
        setShowUnityModal={setShowUnityModal}
        unityPercentage={unityPercentage}
        unityModalData={unityModalData}
        cheeredTodayUids={cheeredTodayUids}
        handleCheerClick={handleCheerClick}

        cheerTarget={cheerTarget}
        setCheerTarget={setCheerTarget as (target: UserProfile | null) => void}
        isSendingCheer={isSendingCheer}
        handleSendCheer={handleSendCheer}

        showReportModal={showReportModal}
        setShowReportModal={setShowReportModal}
        reportReason={reportReason}
        setReportReason={setReportReason}
        confirmReport={confirmReport}

        selectedMember={selectedMember}
        handleUserProfileClick={handleUserProfileClick}



        showInviteModal={showInviteModal}
        setShowInviteModal={setShowInviteModal}
        handleCopyInviteLink={handleCopyInviteLink}
        handleShareLine={handleShareLine}
        handleShareWhatsApp={handleShareWhatsApp}
        handleShareMessenger={handleShareMessenger}
        handleShareInstagram={handleShareInstagram}
      />

      <MessageInput
        handleSendMessage={handleSendMessage}
        isAnyModalOpen={isAnyModalOpen}
        replyTo={replyTo}
        setReplyTo={setReplyTo}
        t={t}
        textareaRef={textareaRef}
        newMessage={newMessage}
        setNewMessage={setNewMessage}
        handleKeyDown={handleKeyDown}
        onInputFocusChange={onInputFocusChange}
        containerRef={containerRef}
        inputPlaceholder={inputPlaceholder}
        showAddNoteTooltip={showAddNoteTooltip}
        handleDismissTooltip={handleDismissTooltip}
        setIsNewNoteOpen={setIsNewNoteOpen}
      />
    </div >
  );
};

export default GroupChat; 