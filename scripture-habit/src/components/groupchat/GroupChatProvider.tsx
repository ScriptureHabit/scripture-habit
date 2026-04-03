import { FC, ReactNode, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { useLanguage } from '../../context/LanguageContext';
import { ChatProvider, ChatDataContextType, ChatInteractionContextType, ChatUIContextType, ChatActionContextType, ActiveModalType } from './ChatContext';
import { UserData } from '../../types/user';
import { Group, Message } from '../../types/chat';
import { useModalStore, ActiveModal } from '../../store/useModalStore';

// Hooks
// Hooks
import { useGroupMessages } from './hooks/core/useGroupMessages';
import { useGroupChatState } from './hooks/core/useGroupChatState';

import { useGroupActions } from './hooks/api/useGroupActions';
import { useMessageActions } from './hooks/api/useMessageActions';
import { useRecapManager } from './hooks/api/useRecapManager';
import { useReportSystem } from './hooks/api/useReportSystem';
import { useInviteManager } from './hooks/api/useInviteManager';
import { useUserProfile } from './hooks/api/useUserProfile';

import { useGroupChatHandlers } from './hooks/interaction/useGroupChatHandlers';
import { useMessageInteraction } from './hooks/interaction/useMessageInteraction';
import { useCheerSystem } from './hooks/interaction/useCheerSystem';

import { useUnityScore } from './hooks/view/useUnityScore';
import { useGroupChatUI } from './hooks/view/useGroupChatUI';
import { useScrollManager } from './hooks/view/useScrollManager';
import { useUnityDetails } from './hooks/view/useUnityDetails';

interface GroupChatProviderProps {
  groupId: string;
  userData: UserData;
  userGroups?: Group[];
  isActive?: boolean;
  onBack?: () => void;
  onGroupSelect?: (groupId: string) => void;
  isExternalModalOpen?: boolean;
  initialShowInviteModal?: boolean;
  onInputFocusChange?: (focused: boolean) => void;
  children: ReactNode;
}

const GroupChatProvider: FC<GroupChatProviderProps> = ({ 
  groupId, userData, userGroups = [], onBack, onGroupSelect, initialShowInviteModal = false, onInputFocusChange, children 
}) => {
  const { language, t, tArray, isLoaded } = useLanguage();
  const API_BASE = Capacitor.isNativePlatform() ? 'https://scripturehabit.app' : '';

  // Primary Data Hooks
  const {
    messages, groupData, loading, groupNotFound, userReadCount,
    initialScrollDone, setInitialScrollDone, hasMoreOlder, isLoadingOlder, loadMoreOlderMessages,
    membersMap, latestMessageRef, prevMessageCountRef, dispatch
  } = useGroupMessages(groupId, userData, t);

  // Feature Hooks
  const { 
    translatedGroupName, translatedGroupDesc, showAddNoteTooltip, setShowAddNoteTooltip,
    showInactivityPolicyBanner, setShowInactivityPolicyBanner 
  } = useGroupChatUI(groupId, groupData, language || 'en', API_BASE);

  const unityPercentage = useUnityScore(groupId, userData, groupData, messages);
  
  const { 
    isLeaving, isDeleting, handleLeaveGroup, handleDeleteGroup, togglePublicStatus, handleUpdateGroupName
  } = useGroupActions(groupId, userData, groupData, language || 'en', t, onBack, onBack);

  const { 
    translatingIds, translatedTexts, handleSendMessage, handleSaveEdit, 
    handleConfirmDeleteMessage, handleToggleReaction, handleTranslateMessage, handleLazyTranslate
  } = useMessageActions(groupId, userData, language || 'en', t, dispatch);

  const { 
    containerRef, handleScroll, previousScrollHeightRef, previousScrollTopRef, scrollToBottom 
  } = useScrollManager(groupId, userData, messages, userReadCount, loading, initialScrollDone, setInitialScrollDone, latestMessageRef, prevMessageCountRef);

  const { 
    isRecapLoading, isRecapAvailable, handleGenerateWeeklyRecap 
  } = useRecapManager(groupId, groupData, language || 'en', t);

  const { 
    showUnityModal, setShowUnityModal, unityModalData, membersList, setMembersList, handleShowUnityModal 
  } = useUnityDetails(groupData, messages, userData);

  const {
    replyTo, setReplyTo, contextMenu, setContextMenu, editingMessage, setEditingMessage,
    editText, setEditText, showDeleteMessageModal, setShowDeleteMessageModal,
    messageToDelete, setMessageToDelete, textareaRef, handleReply, handleMessageClick,
    closeContextMenu, handleEditMessage, handleCancelEdit, handleDeleteMessageClick
  } = useMessageInteraction();

  const {
    cheerTarget, setCheerTarget, isSendingCheer, cheeredTodayUids, handleSendCheer, handleCheerClick
  } = useCheerSystem(groupId, userData, t);

  const {
    showReportModal, setShowReportModal, reportReason, setReportReason, confirmReport, handleReportClick
  } = useReportSystem(groupId, userData, t);

  const {
    showInviteModal, setShowInviteModal, handleCopyInviteLink, handleRegenerateInviteCode
  } = useInviteManager(groupId, groupData, t);

  const {
    selectedMember, setSelectedMember, handleUserProfileClick
  } = useUserProfile(membersMap, membersList);

  const {
    state: localState, setMembersLoading, setShowMobileMenu
  } = useGroupChatState();

  const {
    activeModal, setActiveModal, reactionsToShow, setReactionsToShow,
    newGroupName, setNewGroupName, newGroupDescription, setNewGroupDescription,
    newTranslatedName, setNewTranslatedName, newTranslatedDesc, setNewTranslatedDesc,
    deleteConfirmationName, setDeleteConfirmationName,
    noteToEdit, setNoteToEdit
  } = useModalStore();

  const {
    contextMenuRef, handleShowMembers, handleShowReactions, handleDismissInactivityBanner
  } = useGroupChatHandlers({
    groupData, membersMap, membersList, initialShowInviteModal, loading,
    setShowInviteModal, setActiveModal, setMembersLoading, setShowMobileMenu,
    setMembersList, setReactionsToShow, setShowInactivityPolicyBanner
  });

  const { membersLoading, showMobileMenu } = localState;
  const isOwner = groupData?.ownerUserId === userData?.uid;

  // Final Data Context
  const dataValue = useMemo<ChatDataContextType>(() => ({
    groupId, userData, groupData, messages, loading, membersLoading, membersMap, membersList,
    userReadCount, unityPercentage, isOwner, language: language || 'en',
    userGroups
  }), [groupId, userData, groupData, messages, loading, membersLoading, membersMap, membersList, userReadCount, unityPercentage, isOwner, language, userGroups]);

  // Interaction Context
  const interactionValue = useMemo<ChatInteractionContextType>(() => ({
    replyTo, editingMessage, editText, contextMenu, textareaRef, containerRef,
    contextMenuRef, previousScrollHeightRef, previousScrollTopRef, messageToDelete,
    setReplyTo, setEditingMessage, setEditText, setContextMenu, setMessageToDelete
  }), [replyTo, editingMessage, editText, contextMenu, textareaRef, containerRef, contextMenuRef, previousScrollHeightRef, previousScrollTopRef, messageToDelete, setReplyTo, setEditingMessage, setEditText, setContextMenu, setMessageToDelete]);

  // UI Context
  const uiValue = useMemo<ChatUIContextType>(() => ({
    activeModal: activeModal as ActiveModalType, 
    showDeleteMessageModal, showUnityModal, showInviteModal, showReportModal, 
    showInactivityPolicyBanner, showAddNoteTooltip, showMobileMenu, isRecapLoading, 
    isRecapAvailable, unityModalData
  }), [activeModal, showDeleteMessageModal, showUnityModal, showInviteModal, showReportModal, showInactivityPolicyBanner, showAddNoteTooltip, showMobileMenu, isRecapLoading, isRecapAvailable, unityModalData]);

  // Actions Context
  const actionsValue = useMemo<ChatActionContextType>(() => ({
    t, tArray, handleSendMessage, handleSaveEdit, 
    handleConfirmDeleteMessage: (message: Message) => handleConfirmDeleteMessage(message),
    handleToggleReaction, handleTranslateMessage, handleLazyTranslate, handleCancelEdit,
    handleReply, handleMessageClick, handleEditMessage, handleDeleteMessageClick, handleReportClick,
    handleUserProfileClick, handleShowReactions, handleShowMembers, handleShowUnityModal,
    handleGenerateWeeklyRecap, handleLeaveGroup, handleDeleteGroup, handleUpdateGroupName,
    togglePublicStatus, scrollToBottom, handleScroll, dispatch,
    setActiveModal: (modal: ActiveModalType) => setActiveModal(modal as ActiveModal), 
    setShowDeleteMessageModal, setShowUnityModal, setShowInviteModal, setShowReportModal, 
    setShowInactivityPolicyBanner, setShowAddNoteTooltip, setShowMobileMenu, setMembersLoading,
    handleDismissTooltip: () => setShowAddNoteTooltip(false), handleDismissInactivityBanner, 
    closeContextMenu, onBack, onGroupSelect, onInputFocusChange, hasMoreOlder, isLoadingOlder, loadMoreOlderMessages,
    isLeaving, isDeleting, cheerTarget, setCheerTarget, isSendingCheer, cheeredTodayUids,
    handleSendCheer, handleCheerClick, reportReason, setReportReason, confirmReport, 
    handleCopyInviteLink, handleRegenerateInviteCode, translatedGroupName, translatedGroupDesc,
    selectedMember, setSelectedMember, reactionsToShow, setReactionsToShow, newGroupName, setNewGroupName, newGroupDescription, 
    setNewGroupDescription, newTranslatedName, setNewTranslatedName, newTranslatedDesc, 
    setNewTranslatedDesc, deleteConfirmationName, setDeleteConfirmationName, 
    noteToEdit, setNoteToEdit, translatingIds, translatedTexts
  }), [
    t, tArray, handleSendMessage, handleSaveEdit, handleConfirmDeleteMessage,
    handleToggleReaction, handleTranslateMessage, handleLazyTranslate, handleCancelEdit,
    handleReply, handleMessageClick, handleEditMessage, handleDeleteMessageClick, handleReportClick,
    handleUserProfileClick, handleShowReactions, handleShowMembers, handleShowUnityModal,
    handleGenerateWeeklyRecap, handleLeaveGroup, handleDeleteGroup, handleUpdateGroupName,
    togglePublicStatus, scrollToBottom, handleScroll, dispatch,
    setActiveModal, setShowDeleteMessageModal, setShowUnityModal, setShowInviteModal, 
    setShowReportModal, setShowInactivityPolicyBanner, setShowAddNoteTooltip, 
    setShowMobileMenu, setMembersLoading, handleDismissInactivityBanner, closeContextMenu,
    onBack, onGroupSelect, onInputFocusChange, hasMoreOlder, isLoadingOlder, loadMoreOlderMessages,
    isLeaving, isDeleting, cheerTarget, setCheerTarget, isSendingCheer, cheeredTodayUids,
    handleSendCheer, handleCheerClick, reportReason, setReportReason, confirmReport,
    handleCopyInviteLink, handleRegenerateInviteCode, translatedGroupName, translatedGroupDesc,
    selectedMember, setSelectedMember, reactionsToShow, setReactionsToShow,
    newGroupName, setNewGroupName, newGroupDescription, setNewGroupDescription,
    newTranslatedName, setNewTranslatedName, newTranslatedDesc, setNewTranslatedDesc,
    deleteConfirmationName, setDeleteConfirmationName, noteToEdit, setNoteToEdit,
    translatingIds, translatedTexts
  ]);

  if (groupNotFound && onBack) {
    onBack();
    return null;
  }

  if (!isLoaded) return null;

  return (
    <ChatProvider data={dataValue} interaction={interactionValue} ui={uiValue} actions={actionsValue}>
      {children}
    </ChatProvider>
  );
};

export default GroupChatProvider;
