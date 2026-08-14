import { ReactNode, useMemo, useEffect } from 'react';

import { useLanguage } from '../../hooks/use-language';
import { ChatProvider } from './chat-provider';
import {
  ChatDataContextType,
  ChatMessageActionsContextType,
  ChatGroupActionsContextType,
  ChatUIActionsContextType
} from './chat-context';
import { UserData } from '../../types/user';
import { Group, UserProfileBrief } from '../../types/chat';
import { useChatStore } from '../../store/use-chat-store';

// Hooks
import { useGroupMessages } from './hooks/core/use-group-messages';
import { useGroupActions } from './hooks/api/use-group-actions';
import { useMessageActions } from './hooks/api/use-message-actions';
import { useReportSystem } from './hooks/api/use-report-system';
import { useInviteManager } from './hooks/api/use-invite-manager';
import { useUserProfile } from './hooks/api/use-user-profile';
import { useGroupChatHandlers } from './hooks/interaction/use-group-chat-handlers';
import { useMessageInteraction } from './hooks/interaction/use-message-interaction';
import { useCheerSystem } from './hooks/interaction/use-cheer-system';
import { useAutoRetry } from './hooks/interaction/use-auto-retry';
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

const GroupChatProvider = ({
  groupId, userData, userGroups = [], isActive = false, onBack, onGroupSelect, initialShowInviteModal = false, onInputFocusChange, onUnityUpdate, children
}: GroupChatProviderProps) => {
  const { language, t, tArray, isLoaded } = useLanguage();

  // Zustand Stores
  const chatUI = useChatStore();

  // Primary Data Hooks
  const {
    messages, groupData, loading, groupNotFound, userReadCount, unreadAnchorMessageId,
    initialScrollDone, setInitialScrollDone, hasMoreOlder, isLoadingOlder, loadMoreOlderMessages,
    membersMap, latestMessageRef, prevMessageCountRef, dispatch, messagesLoaded
  } = useGroupMessages(groupId, userData, t, isActive);

  // 1. Feature Hooks (State & Scoring)
  const {
    translatedGroupName, translatedGroupDesc
  } = useGroupChatUI(groupId, groupData, language || 'en');

  const unityPercentage = useUnityScore(groupId, userData, groupData, messages, membersMap);

  useEffect(() => {
    if (onUnityUpdate) onUnityUpdate(unityPercentage);
  }, [unityPercentage, onUnityUpdate, groupId]);

  // 2. API Actions
  const {
    isLeaving, isDeleting, handleLeaveGroup, handleDeleteGroup, togglePublicStatus, handleUpdateGroupName
  } = useGroupActions(groupId, userData, groupData, language || 'en', t, /* onLeaveSuccess */ onBack, /* onDeleteSuccess */ onBack);

  const {
    translatingIds, translatedTexts, handleSendMessage, handleRetryMessage, handleSaveEdit,
    handleConfirmDeleteMessage, handleToggleReaction, handleTranslateMessage, handleLazyTranslate, handleToggleReactionDirect
  } = useMessageActions(groupId, userData, language || 'en', t, dispatch);

  const {
    handleCopyInviteLink, handleRegenerateInviteCode
  } = useInviteManager(groupId, groupData, t);

  // Offline pending message hydration & automatic online retry
  useAutoRetry({
    groupId,
    messages,
    messagesLoaded,
    dispatch,
    handleRetryMessage
  });

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


  const membersList = useMemo<UserProfileBrief[]>(() => {
    if (!groupData?.members) return [];
    return groupData.members.map(uid => {
      const profile = membersMap[uid];
      return {
        id: uid,
        nickname: profile?.nickname || 'Unknown User',
        photoURL: profile?.photoURL || ''
      };
    });
  }, [groupData, membersMap]);

  const {
    handleShowMembers, handleShowReactions, contextMenuRef
  } = useGroupChatHandlers({
    groupData,
    membersMap,
    initialShowInviteModal,
    loading
  });

  const { handleUserProfileClick } = useUserProfile(membersMap, membersList);

  const isOwner = groupData?.ownerUserId === userData?.uid;
  const textareaRef = chatUI.textareaRef;



  // --- SPLIT CONTEXT ASSEMBLY ---

  const dataValue = useMemo<ChatDataContextType>(() => ({
    groupId, userData, groupData, messages, loading, membersLoading: false,
    membersMap, membersList, userReadCount, unreadAnchorMessageId, unityPercentage, isOwner,
    language: language || 'en', userGroups, messagesLoaded,
    unityModalData: {
      posted: unityModalData.posted,
      notPosted: unityModalData.notPosted
    }
  }), [groupId, userData, groupData, messages, loading, membersMap, membersList, userReadCount, unreadAnchorMessageId, unityPercentage, isOwner, language, userGroups, unityModalData, messagesLoaded]);

  const messageActionsValue = useMemo<ChatMessageActionsContextType>(() => ({
    handleSendMessage, handleSaveEdit, handleConfirmDeleteMessage, handleToggleReaction,
    handleTranslateMessage, handleLazyTranslate, handleReply, handleMessageClick,
    handleEditMessage, handleDeleteMessageClick, handleReportClick, handleToggleReactionDirect,
    translatingIds, translatedTexts
  }), [handleSendMessage, handleSaveEdit, handleConfirmDeleteMessage, handleToggleReaction, handleTranslateMessage, handleLazyTranslate, handleReply, handleMessageClick, handleEditMessage, handleDeleteMessageClick, handleReportClick, handleToggleReactionDirect, translatingIds, translatedTexts]);

  const groupActionsValue = useMemo<ChatGroupActionsContextType>(() => ({
    handleLeaveGroup, handleDeleteGroup, handleUpdateGroupName, togglePublicStatus,
    handleCopyInviteLink, handleRegenerateInviteCode,
    handleUserProfileClick, handleShowMembers, handleShowUnityModal, handleShowReactions,
    translatedGroupName, translatedGroupDesc, isLeaving, isDeleting,
    isSendingCheer, cheeredTodayUids, confirmReport, handleSendCheer, handleCheerClick
  }), [handleLeaveGroup, handleDeleteGroup, handleUpdateGroupName, togglePublicStatus, handleCopyInviteLink, handleRegenerateInviteCode, handleUserProfileClick, handleShowMembers, handleShowUnityModal, handleShowReactions, translatedGroupName, translatedGroupDesc, isLeaving, isDeleting, isSendingCheer, cheeredTodayUids, confirmReport, handleSendCheer, handleCheerClick]);

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


