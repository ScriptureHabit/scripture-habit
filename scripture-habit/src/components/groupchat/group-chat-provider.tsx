
import { FC, ReactNode, useMemo, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useLanguage } from '../../hooks/use-language';
import { ChatProvider } from './chat-provider';
import { 
  ChatDataContextType, 
  ChatMessageActionsContextType, 
  ChatGroupActionsContextType, 
  ChatUIActionsContextType 
} from './chat-context';
import { UserData } from '../../types/user';
import { Group } from '../../types/chat';
import { useChatStore } from '../../store/use-chat-store';

// Hooks
import { useGroupMessages } from './hooks/core/use-group-messages';
import { useGroupChatState } from './hooks/core/use-group-chat-state';
import { useGroupActions } from './hooks/api/use-group-actions';
import { useMessageActions } from './hooks/api/use-message-actions';
import { useRecapManager } from './hooks/api/use-recap-manager';
import { useReportSystem } from './hooks/api/use-report-system';
import { useInviteManager } from './hooks/api/use-invite-manager';
import { useUserProfile } from './hooks/api/use-user-profile';
import { useGroupChatHandlers } from './hooks/interaction/use-group-chat-handlers';
import { useMessageInteraction } from './hooks/interaction/use-message-interaction';
import { useCheerSystem } from './hooks/interaction/use-cheer-system';
import { useUnityScore } from './hooks/view/use-unity-score';
import { useGroupChatUI } from './hooks/view/use-group-chat-ui';
import { useScrollManager } from './hooks/view/use-scroll-manager';
import { useUnityDetails } from './hooks/view/use-unity-details';

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

  const unityPercentage = useUnityScore(groupId, userData, groupData, messages, membersMap);

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
  } = useUnityDetails(groupData, messages, membersMap);

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
  const textareaRef = chatUI.textareaRef;

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
  }), [t, tArray, scrollToBottom, handleScroll, dispatch, closeContextMenu, onBack, onGroupSelect, onInputFocusChange, hasMoreOlder, isLoadingOlder, loadMoreOlderMessages, textareaRef, containerRef, contextMenuRef, previousScrollHeightRef, previousScrollTopRef]);

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


