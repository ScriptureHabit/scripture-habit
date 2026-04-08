import { FC, ReactNode, useMemo, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useLanguage } from '../../context/LanguageContext';
import { 
  ChatProvider, 
  ChatDataContextType, 
  ChatMessageActionsContextType, 
  ChatGroupActionsContextType, 
  ChatUIActionsContextType 
} from './ChatContext';
import { UserData } from '../../types/user';
import { Group } from '../../types/chat';
import { useChatStore } from '../../store/useChatStore';

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
  onUnityUpdate?: (percentage: number) => void;
  children: ReactNode;
}

const GroupChatProvider: FC<GroupChatProviderProps> = ({ 
  groupId, userData, userGroups = [], isActive = false, onBack, onGroupSelect, initialShowInviteModal = false, onInputFocusChange, onUnityUpdate, children 
}) => {
  const { language, t, tArray, isLoaded } = useLanguage();
  const API_BASE = Capacitor.isNativePlatform() ? 'https://scripturehabit.app' : '';

  // Zustand Stores
  const chatUI = useChatStore();

  // Primary Data Hooks
  const {
    messages, groupData, loading, groupNotFound, userReadCount,
    initialScrollDone, setInitialScrollDone, hasMoreOlder, isLoadingOlder, loadMoreOlderMessages,
    membersMap, latestMessageRef, prevMessageCountRef, dispatch
  } = useGroupMessages(groupId, userData, t, isActive);

  // 1. Feature Hooks (State & Scoring)
  const { 
    translatedGroupName, translatedGroupDesc 
  } = useGroupChatUI(groupId, groupData, language || 'en', API_BASE);

  const unityPercentage = useUnityScore(groupId, userData, groupData, messages);

  useEffect(() => {
    if (onUnityUpdate) onUnityUpdate(unityPercentage);
  }, [unityPercentage, onUnityUpdate, groupId]);

  // 2. API Actions
  const { 
    isLeaving, isDeleting, handleLeaveGroup, handleDeleteGroup, togglePublicStatus, handleUpdateGroupName
  } = useGroupActions(groupId, userData, groupData, language || 'en', t, onBack, onBack);

  const { 
    translatingIds, translatedTexts, handleSendMessage, handleSaveEdit, 
    handleConfirmDeleteMessage, handleToggleReaction, handleTranslateMessage, handleLazyTranslate, handleToggleReactionDirect
  } = useMessageActions(groupId, userData, language || 'en', t, dispatch);

  const { 
    isRecapLoading, isRecapAvailable, handleGenerateWeeklyRecap 
  } = useRecapManager(groupId, groupData, language || 'en', t);

  const { 
    handleCopyInviteLink, handleRegenerateInviteCode
  } = useInviteManager(groupId, groupData, t);

  // 3. UI/Interaction Logic
  const { 
    containerRef, handleScroll, previousScrollHeightRef, previousScrollTopRef, scrollToBottom 
  } = useScrollManager(groupId, userData, messages, userReadCount, loading, initialScrollDone, setInitialScrollDone, latestMessageRef, prevMessageCountRef);

  const { 
    unityModalData, handleShowUnityModal 
  } = useUnityDetails(groupData, messages, userData);

  const {
    handleReply, handleMessageClick, closeContextMenu, handleEditMessage, handleDeleteMessageClick
  } = useMessageInteraction();

  const {
    confirmReport, handleReportClick
  } = useReportSystem(groupId, userData, t);

  const {
    cheeredTodayUids, isSendingCheer, handleSendCheer, handleCheerClick
  } = useCheerSystem(groupId, userData, t);

  const localState = useGroupChatState();

  const {
    handleShowMembers, handleShowReactions, contextMenuRef
  } = useGroupChatHandlers({
    groupData, membersMap, membersList: localState.state.membersList, initialShowInviteModal, loading,
    setMembersLoading: localState.setMembersLoading, setMembersList: localState.setMembersList
  });

  const { handleUserProfileClick } = useUserProfile(membersMap, localState.state.membersList);

  const isOwner = groupData?.ownerUserId === userData?.uid;
  const textareaRef = chatUI.textareaRef as any; // Shim if needed, or better use specific ref

  // --- SPLIT CONTEXT ASSEMBLY ---

  const dataValue = useMemo<ChatDataContextType>(() => ({
    groupId, userData, groupData, messages, loading, membersLoading: localState.state.membersLoading, 
    membersMap, membersList: localState.state.membersList, userReadCount, unityPercentage, isOwner, 
    language: language || 'en', userGroups, isRecapLoading, isRecapAvailable,
    unityModalData: {
      posted: unityModalData.posted,
      notPosted: unityModalData.notPosted
    }
  }), [groupId, userData, groupData, messages, loading, localState.state.membersLoading, membersMap, localState.state.membersList, userReadCount, unityPercentage, isOwner, language, userGroups, isRecapLoading, isRecapAvailable, unityModalData]);

  const messageActionsValue = useMemo<ChatMessageActionsContextType>(() => ({
    handleSendMessage, handleSaveEdit, handleConfirmDeleteMessage, handleToggleReaction,
    handleTranslateMessage, handleLazyTranslate, handleReply, handleMessageClick,
    handleEditMessage, handleDeleteMessageClick, handleReportClick, handleToggleReactionDirect,
    translatingIds, translatedTexts
  }), [handleSendMessage, handleSaveEdit, handleConfirmDeleteMessage, handleToggleReaction, handleTranslateMessage, handleLazyTranslate, handleReply, handleMessageClick, handleEditMessage, handleDeleteMessageClick, handleReportClick, handleToggleReactionDirect, translatingIds, translatedTexts]);

  const groupActionsValue = useMemo<ChatGroupActionsContextType>(() => ({
    handleLeaveGroup, handleDeleteGroup, handleUpdateGroupName, togglePublicStatus,
    handleCopyInviteLink, handleRegenerateInviteCode, handleGenerateWeeklyRecap,
    handleUserProfileClick, handleShowMembers, handleShowUnityModal, handleShowReactions,
    translatedGroupName, translatedGroupDesc, isLeaving, isDeleting,
    isSendingCheer, cheeredTodayUids, confirmReport, handleSendCheer, handleCheerClick
  }), [handleLeaveGroup, handleDeleteGroup, handleUpdateGroupName, togglePublicStatus, handleCopyInviteLink, handleRegenerateInviteCode, handleGenerateWeeklyRecap, handleUserProfileClick, handleShowMembers, handleShowUnityModal, handleShowReactions, translatedGroupName, translatedGroupDesc, isLeaving, isDeleting, isSendingCheer, cheeredTodayUids, confirmReport, handleSendCheer, handleCheerClick]);

  const uiActionsValue = useMemo<ChatUIActionsContextType>(() => ({
    t, tArray, scrollToBottom, handleScroll, dispatch, closeContextMenu,
    onBack, onGroupSelect, onInputFocusChange, hasMoreOlder, isLoadingOlder, loadMoreOlderMessages,
    textareaRef, containerRef, contextMenuRef, previousScrollHeightRef, previousScrollTopRef
  }), [t, tArray, scrollToBottom, handleScroll, dispatch, closeContextMenu, onBack, onGroupSelect, onInputFocusChange, hasMoreOlder, isLoadingOlder, loadMoreOlderMessages, containerRef, contextMenuRef, previousScrollHeightRef, previousScrollTopRef]);

  if (groupNotFound && onBack) {
    onBack();
    return null;
  }

  if (!isLoaded) return null;

  return (
    <ChatProvider 
      data={dataValue} 
      messageActions={messageActionsValue} 
      groupActions={groupActionsValue} 
      uiActions={uiActionsValue}
    >
      {children}
    </ChatProvider>
  );
};

export default GroupChatProvider;
