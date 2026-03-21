import { useState, useEffect, useRef, useMemo, FC, Fragment, KeyboardEvent } from 'react';
import { safeStorage } from '../../Utils/storage';
import { Capacitor } from '@capacitor/core';
import { db, auth } from '../../firebase';
import { UilTrashAlt, UilTimes, UilArrowLeft, UilPen, UilCommentAlt, UilCopy, UilUsersAlt, UilAnalysis } from '@iconscout/react-unicons';
import { collection, query, serverTimestamp, doc, updateDoc, getDoc, getDocs, where, addDoc, Timestamp } from 'firebase/firestore';
import { toast } from 'react-toastify';
import NewNote from '../NewNote/NewNote';
import './GroupChat.css';
import { useLanguage } from '../../Context/LanguageContext';
import MessageItem from './SubComponents/MessageItem';
import MessageInput from './SubComponents/MessageInput';
import GroupMenuItem from './SubComponents/GroupMenuItem';
import GroupChatModals from './GroupChatModals';
import { UserData } from '../../types/user';
import { Group, Message, UserProfileBrief } from '../../types/chat';

// Hooks
import { useGroupMessages } from './hooks/useGroupMessages';
import { useUnityScore } from './hooks/useUnityScore';
import { useGroupActions } from './hooks/useGroupActions';
import { useMessageActions } from './hooks/useMessageActions';
import { useGroupChatUI } from './hooks/useGroupChatUI';
import { useScrollManager } from './hooks/useScrollManager';
import { useRecapManager } from './hooks/useRecapManager';
import { useUnityDetails } from './hooks/useUnityDetails';

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
  showBelow?: boolean;
}

const GroupChat: FC<GroupChatProps> = ({ groupId, userData, userGroups = [], onInputFocusChange, onBack, onGroupSelect, isExternalModalOpen = false }) => {
  const { language, t, tArray, isLoaded } = useLanguage();
  const API_BASE = Capacitor.isNativePlatform() ? 'https://scripturehabit.app' : '';

  // Primary Data Hooks
  const {
    messages, setMessages,
    groupData,
    loading,
    userReadCount,
    initialScrollDone, setInitialScrollDone,
    hasMoreOlder, setHasMoreOlder,
    membersMap,
    latestMessageRef,
    prevMessageCountRef
  } = useGroupMessages(groupId, userData, t);

  // Feature Hooks
  const { 
    translatedGroupName, translatedGroupDesc, 
    showAddNoteTooltip, setShowAddNoteTooltip,
    showInactivityPolicyBanner, setShowInactivityPolicyBanner 
  } = useGroupChatUI(groupId, groupData, language || 'en', API_BASE);

  const unityPercentage = useUnityScore(groupId, userData, groupData, messages);
  
  const { 
    isLeaving, handleLeaveGroup, handleDeleteGroup, togglePublicStatus, handleUpdateGroupName
  } = useGroupActions(groupId, userData, groupData, language || 'en', t);

  const { 
    translatingIds, translatedTexts, handleSendMessage, handleSaveEdit, 
    handleConfirmDeleteMessage, handleToggleReaction, handleTranslateMessage 
  } = useMessageActions(groupId, userData, language || 'en', t, API_BASE);

  const { 
    containerRef, handleScroll, previousScrollHeightRef, previousScrollTopRef, scrollToBottom 
  } = useScrollManager(groupId, userData, messages, userReadCount, loading, initialScrollDone, setInitialScrollDone, latestMessageRef, prevMessageCountRef);

  const { 
    isRecapLoading, isRecapAvailable, handleGenerateWeeklyRecap 
  } = useRecapManager(groupId, groupData, API_BASE, language || 'en', t);

  const { 
    showUnityModal, setShowUnityModal, unityModalData, 
    membersList, setMembersList, handleShowUnityModal 
  } = useUnityDetails(groupData, messages, userData);

  // Internal UI State
  const [newMessage, setNewMessage] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [isNewNoteOpen, setIsNewNoteOpen] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenu>({ show: false, x: 0, y: 0, messageId: null, showBelow: false });
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editText, setEditText] = useState('');
  const [showDeleteMessageModal, setShowDeleteMessageModal] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const [noteToEdit, setNoteToEdit] = useState<any>(null);
  const [showReactionsModal, setShowReactionsModal] = useState(false);
  const [reactionsToShow, setReactionsToShow] = useState<any[]>([]);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newTranslatedName, setNewTranslatedName] = useState('');
  const [newTranslatedDesc, setNewTranslatedDesc] = useState('');
  const [selectedMember, setSelectedMember] = useState<UserProfileBrief | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportedMessage, setReportedMessage] = useState<Message | null>(null);
  const [reportReason, setReportReason] = useState('inappropriate');
  const [cheerTarget, setCheerTarget] = useState<UserProfileBrief | null>(null);
  const [isSendingCheer, setIsSendingCheer] = useState(false);
  const [cheeredTodayUids, setCheeredTodayUids] = useState<Set<string>>(new Set());

  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const fetchCheers = async () => {
      if (!userData?.uid) return;
      try {
        const timeZone = userData.timeZone || 'UTC';
        const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone });
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

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditText('');
  };

  const handleEditMessage = (message: Message) => {
    setEditingMessage(message);
    setEditText(message.text || '');
    setContextMenu({ ...contextMenu, show: false, messageId: null, message: null });
  };

  const handleDeleteMessageClick = (message: Message) => {
    setMessageToDelete(message);
    setShowDeleteMessageModal(true);
    setContextMenu({ ...contextMenu, show: false, messageId: null, message: null });
  };

  const handleCopyInviteLink = async () => {
    const inviteLink = `${window.location.origin}/join/${groupData?.inviteCode}`;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success(t('groupChat.inviteLinkCopied'));
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  const handleRegenerateInviteCode = async () => {
    if (!groupId) return;
    try {
      const { generateInviteCode } = await import('../../Utils/inviteUtils');
      const newCode = generateInviteCode();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      
      await updateDoc(doc(db, 'groups', groupId), {
        inviteCode: newCode,
        inviteCodeExpiresAt: Timestamp.fromDate(expiresAt)
      });
      toast.success(t('groupChat.inviteCodeRegenerated'));
    } catch (err) {
      toast.error("Failed to regenerate code");
    }
  };

  const confirmReport = async () => {
    if (!reportedMessage || !userData) return;
    try {
      await addDoc(collection(db, 'reports'), {
        messageId: reportedMessage.id,
        groupId,
        reporterUid: userData.uid,
        reason: reportReason,
        createdAt: serverTimestamp(),
        text: reportedMessage.text,
        senderId: reportedMessage.senderId
      });
      toast.success(t('groupChat.reportSuccess'));
      setShowReportModal(false);
      setReportedMessage(null);
    } catch (error) {
      console.error("Error reporting message:", error);
      toast.error(t('groupChat.reportError'));
    }
  };

  const handleSendCheer = async () => {
    if (!cheerTarget || isSendingCheer) return;
    setIsSendingCheer(true);
    try {
      const idToken = await auth?.currentUser?.getIdToken();
      const response = await fetch(`${API_BASE}/api/send-cheer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          targetUid: cheerTarget.id,
          groupId,
          senderNickname: userData.nickname
        })
      });

      if (response.ok) {
        toast.success(t('groupChat.cheerSent')?.replace('{nickname}', cheerTarget.nickname || ''));
        setCheeredTodayUids(prev => new Set(prev).add(cheerTarget.id));
        setCheerTarget(null);
        setShowUnityModal(false);
      } else {
        toast.error("Failed to send cheer");
      }
    } catch (err) {
      console.error("Error sending cheer:", err);
    } finally {
      setIsSendingCheer(false);
    }
  };

  const handleUserProfileClick = async (userId: string | null) => {
    if (!userId || userId === 'system') return;
    const member = membersMap[userId] || membersList.find(m => m.id === userId);
    if (member) {
      setSelectedMember(member);
    } else {
      try {
        const snap = await getDoc(doc(db, 'users', userId));
        if (snap.exists()) {
          const profile = { id: snap.id, ...snap.data() } as UserProfileBrief;
          setSelectedMember(profile);
        }
      } catch (e) {
        console.error("Failed to fetch user profile", e);
      }
    }
  };

  const handleShowMembers = async () => {
    if (!groupData?.members) return;
    setShowMobileMenu(false);
    setShowMembersModal(true);
    setMembersLoading(true);
    try {
      const missingUids = groupData.members.filter(uid => !membersList.some(m => m.id === uid));
      if (missingUids.length > 0) {
        const snapshots = await Promise.all(missingUids.map(uid => getDoc(doc(db, 'users', uid))));
        const newMembers = snapshots.map(snap => snap.exists() ? { id: snap.id, ...snap.data() } as UserProfileBrief : { id: snap.id, nickname: 'Unknown' } as UserProfileBrief);
        setMembersList(prev => [...prev, ...newMembers]);
      }
    } catch (e) {
      console.error("Error loading members:", e);
    } finally {
      setMembersLoading(false);
    }
  };

  const handleReply = (message: Message) => {
    setReplyTo(message);
    if (textareaRef.current) textareaRef.current.focus();
  };

  const handleMessageClick = (message: Message, e: React.MouseEvent) => {
    if (message.senderId === 'system') return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    
    // Decide if showing above or below message bubble
    // Menu height is approx 220px-250px
    const showBelow = rect.top < 250;

    // Horizontal clamping to prevent off-screen menu
    const menuWidth = 160;
    let x = rect.left + rect.width / 2;
    x = Math.max(menuWidth / 2 + 10, Math.min(window.innerWidth - menuWidth / 2 - 10, x));

    setContextMenu({
      show: true,
      x,
      y: showBelow ? rect.bottom : rect.top,
      messageId: message.id,
      message,
      showBelow
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ show: false, x: 0, y: 0, messageId: null, message: null, showBelow: false });
  };

  const handleReportClick = (message: Message) => {
    setReportedMessage(message);
    setShowReportModal(true);
  };

  const handleShowReactions = (reactions: Record<string, string[]>) => {
    const reactionsList: any[] = [];
    Object.entries(reactions).forEach(([emoji, uids]) => {
      if (!Array.isArray(uids)) return;
      uids.forEach(uid => {
        reactionsList.push({
          userId: uid,
          emoji,
          nickname: membersMap[uid]?.nickname || 'Unknown'
        });
      });
    });
    setReactionsToShow(reactionsList);
    setShowReactionsModal(true);
  };

  const handleDismissInactivityBanner = () => {
    setShowInactivityPolicyBanner(false);
    safeStorage.set('hasDismissedInactivityPolicy', 'true');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;

    const isMobile = window.innerWidth <= 768 || Capacitor.isNativePlatform();

    if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
      e.preventDefault();
      handleSendMessage(newMessage, replyTo).then(success => {
        if (success) {
          setNewMessage('');
          setReplyTo(null);
          scrollToBottom();
        }
      });
    }
  };

  const handleCheerClick = (member: UserProfileBrief) => {
    if (member.id === userData?.uid) return;
    setCheerTarget(member);
  };

  const isOwner = groupData?.ownerUserId === userData?.uid;
  const isAnyModalOpen = showLeaveModal || showDeleteModal || showDeleteMessageModal || editingMessage || showReactionsModal || isNewNoteOpen || noteToEdit || showEditNameModal || showMembersModal || showUnityModal || showInviteModal || showReportModal || cheerTarget || isExternalModalOpen;

  const inputPlaceholder = useMemo(() => {
    const typeMessageRaw = tArray('groupChat.typeMessage');
    let candidates = Array.isArray(typeMessageRaw) ? [...typeMessageRaw] : [typeMessageRaw];
    const inactivityThreshold = userData?.kickThreshold || 3;
    candidates.push(t('groupChat.placeholderInactivity', { days: inactivityThreshold }));
    candidates.push(t('groupChat.placeholderShare'));
    candidates.push(t('groupChat.placeholderEncourage'));
    return candidates[Math.floor(Math.random() * candidates.length)];
  }, [t, userData?.kickThreshold]);

  const loadMoreOlderMessages = async () => {
    if (isLoadingOlder || !hasMoreOlder || messages.length === 0) return;
    setIsLoadingOlder(true);

    // Capture current scroll state to maintain position after loading
    if (containerRef.current) {
      previousScrollHeightRef.current = containerRef.current.scrollHeight;
      previousScrollTopRef.current = containerRef.current.scrollTop;
    }

    try {
      const oldestMsg = messages[0];
      if (!oldestMsg.createdAt) return;
      const { orderBy, startAfter, limit } = await import('firebase/firestore');
      const q = query(collection(db, 'groups', groupId, 'messages'), orderBy('createdAt', 'desc'), startAfter(oldestMsg.createdAt), limit(20));
      const snaps = await getDocs(q);
      if (snaps.empty) {
        setHasMoreOlder(false);
      } else {
        const newOlderMsgs = snaps.docs.map(d => ({ id: d.id, ...d.data() } as Message)).reverse();
        setMessages(prev => [...newOlderMsgs, ...prev]);
      }
    } catch (e) {
      console.error("Error loading older messages", e);
    } finally {
      setIsLoadingOlder(false);
    }
  };

  if (!groupId) return null;

  if (loading || !isLoaded) {
    return (
      <div className="GroupChat">
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

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
            {isOwner && (
              <button
                className="edit-group-name-btn"
                onClick={() => {
                  setNewGroupName(groupData?.name || '');
                  setNewGroupDescription(groupData?.description || '');
                  setNewTranslatedName(translatedGroupName || groupData?.translations?.[language || 'en']?.name || '');
                  setNewTranslatedDesc(translatedGroupDesc || groupData?.translations?.[language || 'en']?.description || '');
                  setShowEditNameModal(true);
                }}
                style={{ background: 'none', border: 'none', color: 'var(--gray)', cursor: 'pointer', marginLeft: '8px', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '50%', transition: 'background 0.2s', flexShrink: 0 }}
                title={t('groupChat.changeGroupName')}
              >
                <UilPen size="18" />
              </button>
            )}
            {groupData?.members && <span className="member-count-badge" style={{ flexShrink: 0 }}>({groupData.members.length})</span>}
            {groupData && (
              <div className="unity-score-container">
                <span className={`unity-score-badge ${unityPercentage === 100 ? 'celestial' : ''}`} onClick={handleShowUnityModal} title="Unity Score: members active today">
                  <span className="unity-icon">{unityPercentage === 100 ? '☀️' : unityPercentage >= 66 ? '🌕' : unityPercentage >= 33 ? '🌠' : '🌑'}</span>
                  <span className="unity-percent-text">{unityPercentage}%</span>
                </span>
              </div>
            )}
          </h2>
        </div>
        {groupData && (
          <>
            <div className="header-right desktop-only">
              {isOwner && (
                <div className="group-status-toggle">
                  <span className="status-label">{groupData.isPublic ? t('groupChat.public') : t('groupChat.private')}</span>
                  <label className="switch">
                    <input type="checkbox" checked={groupData.isPublic || false} onChange={togglePublicStatus} />
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
                <UilCommentAlt size="16" className="copy-icon" />
                <span className="desktop-members-label">{t('groupChat.members')}</span>
              </div>
              {isOwner && (
                <div
                  className={`invite-code-display members-btn-desktop ${(!isRecapAvailable || isRecapLoading) ? 'disabled' : ''}`}
                  onClick={() => isRecapAvailable && !isRecapLoading && handleGenerateWeeklyRecap()}
                  title={!isRecapAvailable ? t('groupChat.recapRateLimit') : t('groupChat.generateWeeklyRecap')}
                  style={{ marginRight: '8px', opacity: (!isRecapAvailable || isRecapLoading) ? 0.5 : 1, cursor: (!isRecapAvailable || isRecapLoading) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <span style={{ fontSize: '1.1rem' }}>📊</span>
                  {isRecapLoading && <div className="spinner-mini"></div>}
                </div>
              )}
            </div>
            <div className="hamburger-container mobile-only">
              <button className="hamburger-btn" onClick={() => setShowMobileMenu(!showMobileMenu)} aria-label="Menu">
                <span className={`hamburger-icon ${showMobileMenu ? 'open' : ''}`}><span></span><span></span><span></span></span>
              </button>
            </div>
          </>
        )}
      </div>

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
              {/* Invite Code Section */}
              <div className="mobile-menu-item-card invite-section-card" onClick={handleCopyInviteLink}>
                <div className="menu-item-icon-circle pink-bg">
                  <UilCopy size="22" />
                </div>
                <div className="menu-item-text-content">
                  <span className="menu-item-label-top">{t('groupChat.inviteCode')}</span>
                  <span className="invite-code-text">{groupData.inviteCode}</span>
                </div>
              </div>

              {/* Private Toggle */}
              {isOwner && (
                <div className="mobile-menu-item-row toggle-row" onClick={(e) => { e.stopPropagation(); togglePublicStatus(); }}>
                  <span className="menu-item-label">{t('groupChat.private')}</span>
                  <div className={`custom-toggle ${!groupData.isPublic ? 'active' : ''}`}>
                    <div className="toggle-handle"></div>
                  </div>
                </div>
              )}

              <div className="mobile-menu-divider-thin" />

              {/* Action Items */}
              {isOwner && (
                <div className="mobile-menu-item-action" onClick={() => {
                  setNewGroupName(groupData?.name || '');
                  setNewGroupDescription(groupData?.description || '');
                  setNewTranslatedName(translatedGroupName || groupData?.translations?.[language || 'en']?.name || '');
                  setNewTranslatedDesc(translatedGroupDesc || groupData?.translations?.[language || 'en']?.description || '');
                  setShowEditNameModal(true);
                  setShowMobileMenu(false);
                }}>
                  <div className="menu-item-icon-circle pink-bg">
                    <UilPen size="20" />
                  </div>
                  <span className="menu-item-label">{t('groupChat.editGroupInfo')}</span>
                </div>
              )}

              <div className="mobile-menu-item-action" onClick={handleShowMembers}>
                <div className="menu-item-icon-circle pink-bg">
                  <UilUsersAlt size="20" />
                </div>
                <span className="menu-item-label">{t('groupChat.members')}</span>
              </div>

              {isOwner && (
                <div className="mobile-menu-item-action" onClick={() => { if (isRecapAvailable && !isRecapLoading) { handleGenerateWeeklyRecap(); setShowMobileMenu(false); } }}>
                  <div className="menu-item-icon-circle pink-bg">
                    <UilAnalysis size="20" />
                  </div>
                  <span className="menu-item-label">{t('groupChat.generateWeeklyRecap')}</span>
                </div>
              )}

              <div className="mobile-menu-divider-thin" />

              {/* Danger Actions */}
              {isOwner ? (
                <div className="mobile-menu-item-action danger" onClick={() => { setShowDeleteModal(true); setShowMobileMenu(false); }}>
                  <div className="menu-item-icon-circle danger-bg">
                    <UilTrashAlt size="20" />
                  </div>
                  <span className="menu-item-label">{t('groupChat.deleteGroup')}</span>
                </div>
              ) : (
                <div className="mobile-menu-item-action danger" onClick={() => { setShowLeaveModal(true); setShowMobileMenu(false); }}>
                  <div className="menu-item-icon-circle danger-bg">
                    <UilTrashAlt size="20" />
                  </div>
                  <span className="menu-item-label">{t('groupChat.leaveGroup')}</span>
                </div>
              )}

              {/* My Groups Section */}
              {userGroups.length > 0 && (
                <>
                  <div className="mobile-menu-divider-thick" />
                  <div className="mobile-menu-groups-section">
                    <h4 className="section-title">{t('groupChat.myGroups')}</h4>
                    <div className="mobile-groups-list">
                      {userGroups.map(g => (
                        <GroupMenuItem
                          key={g.id}
                          group={g}
                          currentGroupId={groupId}
                          language={language || 'en'}
                          onSelect={() => { if (onGroupSelect) onGroupSelect(g.id); setShowMobileMenu(false); }}
                          timeZone={userData?.timeZone}
                        />
                      ))}
                    </div>
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
          <button className="inactivity-policy-dismiss" onClick={handleDismissInactivityBanner}><UilTimes size="16" /></button>
        </div>
      )}

      <div className="messages-container" ref={containerRef} onScroll={handleScroll} onClick={() => { if (editingMessage) handleCancelEdit(); if (replyTo) setReplyTo(null); if (contextMenu.show) setContextMenu({ show: false, x: 0, y: 0, messageId: null }); }}>
        {loading && <div className="loading-spinner"><div className="spinner"></div></div>}
        {!loading && hasMoreOlder && (
          <div className="load-more-container">
            {isLoadingOlder ? <div className="spinner"></div> : <button className="load-more-btn" onClick={loadMoreOlderMessages} disabled={isLoadingOlder} tabIndex={-1}>{t('groupChat.loadPreviousMessages')}</button>}
          </div>
        )}
        {messages.map((msg, index) => {
          const showDateDivider = index === 0 || new Date(messages[index - 1].createdAt?.toDate?.() || messages[index - 1].createdAt?.seconds * 1000).toDateString() !== new Date(msg.createdAt?.toDate?.() || msg.createdAt?.seconds * 1000).toDateString();
          const messageDate = new Date(msg.createdAt?.toDate?.() || msg.createdAt?.seconds * 1000 || Date.now());
          return (
            <Fragment key={msg.id}>
              {showDateDivider && <div className="date-separator"><span>{messageDate.toLocaleDateString(language || 'en', { month: 'long', day: 'numeric' })}</span></div>}
              <MessageItem msg={msg} userData={userData} t={t} handleMessageClick={handleMessageClick} handleEditMessage={() => handleEditMessage(msg)} handleDeleteMessageClick={() => handleDeleteMessageClick(msg)} handleReply={() => handleReply(msg)} handleTranslateMessage={() => handleTranslateMessage(msg)} translatingIds={translatingIds} handleToggleReaction={() => handleToggleReaction(msg)} handleReportClick={() => handleReportClick(msg)} handleUserProfileClick={handleUserProfileClick} groupData={groupData} translatedTexts={translatedTexts} language={language || 'en'} handleShowReactions={handleShowReactions} membersMap={membersMap} />
              {userReadCount !== null && index === Math.max(0, userReadCount - 1) && index < messages.length - 1 && msg.senderId !== 'system' && (
                <div className="unread-divider"><span>{t('groupChat.newMessages')}</span></div>
              )}
            </Fragment>
          );
        })}
      </div>

      {contextMenu.show && contextMenu.message && (
        <>
          <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, background: 'transparent' }} onClick={closeContextMenu} />
          <div className="message-context-menu" style={{ 
            position: 'fixed', 
            top: contextMenu.y, 
            left: contextMenu.x, 
            transform: contextMenu.showBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)', 
            zIndex: 1001, 
            marginTop: contextMenu.showBelow ? '10px' : '-10px' 
          }}>
            <button onClick={() => { handleReply(contextMenu.message!); closeContextMenu(); }}><div style={{ width: '22px' }}><UilCommentAlt size="18" /></div><span>{t('groupChat.reply')}</span></button>
            {contextMenu.message.senderId !== userData?.uid && (
              <button onClick={() => { handleToggleReaction(contextMenu.message!); closeContextMenu(); }}><div style={{ width: '22px', fontSize: '18px' }}>👍</div><span>{contextMenu.message?.reactions?.['👍']?.includes(userData?.uid || '') ? t('groupChat.unlike') : t('groupChat.like')}</span></button>
            )}
            {contextMenu.message.senderId === userData?.uid && (
              <button onClick={() => { handleEditMessage(contextMenu.message!); closeContextMenu(); }}><div style={{ width: '22px' }}><UilPen size="18" /></div><span>{t('groupChat.editMessage')}</span></button>
            )}
            {contextMenu.message.senderId === userData?.uid && (
              <button className="delete-option" onClick={() => { handleDeleteMessageClick(contextMenu.message!); closeContextMenu(); }}><div style={{ width: '22px' }}><UilTrashAlt size="18" /></div><span>{t('groupChat.deleteMessage')}</span></button>
            )}
            <button onClick={() => { handleTranslateMessage(contextMenu.message!); closeContextMenu(); }}><div style={{ width: '22px', fontSize: '18px' }}>{translatingIds.has(contextMenu.message!.id) ? '⏳' : '✨'}</div><span>{t('groupChat.translate')}</span></button>
            {contextMenu.message.senderId !== userData?.uid && (
              <button onClick={() => { handleReportClick(contextMenu.message!); closeContextMenu(); }}><div style={{ width: '22px', fontSize: '18px' }}>🚩</div><span>{t('groupChat.report')}</span></button>
            )}
          </div>
        </>
      )}

      <GroupChatModals
        t={t} language={language} userData={userData} groupData={groupData}
        showLeaveModal={showLeaveModal} setShowLeaveModal={setShowLeaveModal} isLeaving={isLeaving} handleLeaveGroup={handleLeaveGroup}
        showDeleteModal={showDeleteModal} setShowDeleteModal={setShowDeleteModal} deleteConfirmationName={deleteConfirmationName} setDeleteConfirmationName={setDeleteConfirmationName} handleDeleteGroup={handleDeleteGroup}
        showEditNameModal={showEditNameModal} setShowEditNameModal={setShowEditNameModal} newGroupName={newGroupName} setNewGroupName={setNewGroupName} newGroupDescription={newGroupDescription} setNewGroupDescription={setNewGroupDescription} newTranslatedName={newTranslatedName} setNewTranslatedName={setNewTranslatedName} newTranslatedDesc={newTranslatedDesc} setNewTranslatedDesc={setNewTranslatedDesc} handleUpdateGroupName={async () => { await handleUpdateGroupName(newGroupName, newGroupDescription, newTranslatedName, newTranslatedDesc); }} translatedGroupName={translatedGroupName} translatedGroupDesc={translatedGroupDesc}
        showDeleteMessageModal={showDeleteMessageModal} setShowDeleteMessageModal={setShowDeleteMessageModal} messageToDelete={messageToDelete} setMessageToDelete={setMessageToDelete} handleConfirmDeleteMessage={async () => { if (messageToDelete) await handleConfirmDeleteMessage(messageToDelete.id); }}
        editingMessage={editingMessage} editText={editText} setEditText={setEditText} handleCancelEdit={handleCancelEdit} handleSaveEdit={async () => { if (editingMessage) await handleSaveEdit(editingMessage.id, editText).then(() => setEditingMessage(null)); }}
        showReactionsModal={showReactionsModal} setShowReactionsModal={setShowReactionsModal} reactionsToShow={reactionsToShow}
        showMembersModal={showMembersModal} setShowMembersModal={setShowMembersModal} membersList={membersList} membersLoading={membersLoading} setSelectedMember={setSelectedMember}
        showUnityModal={showUnityModal} setShowUnityModal={setShowUnityModal} unityPercentage={unityPercentage} unityModalData={unityModalData} cheeredTodayUids={cheeredTodayUids} handleCheerClick={handleCheerClick}
        cheerTarget={cheerTarget} setCheerTarget={setCheerTarget} isSendingCheer={isSendingCheer} handleSendCheer={async () => { await handleSendCheer(); }}
        showReportModal={showReportModal} setShowReportModal={setShowReportModal} reportReason={reportReason} setReportReason={setReportReason} confirmReport={async () => { await confirmReport(); }}
        selectedMember={selectedMember} handleUserProfileClick={handleUserProfileClick}
        showInviteModal={showInviteModal} setShowInviteModal={setShowInviteModal} handleCopyInviteLink={handleCopyInviteLink} handleRegenerateInviteCode={handleRegenerateInviteCode}
      />

      <MessageInput
        handleSendMessage={(e) => { e.preventDefault(); handleSendMessage(newMessage, replyTo).then(success => { if (success) { setNewMessage(''); setReplyTo(null); scrollToBottom(); } }); }}
        isAnyModalOpen={isAnyModalOpen} replyTo={replyTo} setReplyTo={setReplyTo} t={t} textareaRef={textareaRef} newMessage={newMessage} setNewMessage={setNewMessage} handleKeyDown={handleKeyDown} onInputFocusChange={onInputFocusChange} containerRef={containerRef} inputPlaceholder={inputPlaceholder} showAddNoteTooltip={showAddNoteTooltip} handleDismissTooltip={() => setShowAddNoteTooltip(false)} setIsNewNoteOpen={setIsNewNoteOpen}
      />
    </div>
  );
};

export default GroupChat;