import { useEffect, FC } from 'react';
import { Capacitor } from '@capacitor/core';

import NewNote from '../NewNote/NewNote';
import './GroupChat.css';
import { useLanguage } from '../../Context/LanguageContext';
import { ChatProvider } from './ChatContext';
import GroupChatMessageListContainer from './SubComponents/GroupChatMessageListContainer';
import GroupChatContextMenu from './SubComponents/GroupChatContextMenu';
import GroupChatFooter from './SubComponents/GroupChatFooter';
import ChatHeader from './SubComponents/ChatHeader';
import GroupChatModals from './GroupChatModals';
import { UserData } from '../../types/user';
import { Group } from '../../types/chat';


import { useModalStore } from '../../store/useModalStore';

// Hooks
import { useGroupMessages } from './hooks/useGroupMessages';
import { useUnityScore } from './hooks/useUnityScore';
import { useGroupActions } from './hooks/useGroupActions';
import { useMessageActions } from './hooks/useMessageActions';
import { useGroupChatUI } from './hooks/useGroupChatUI';
import { useScrollManager } from './hooks/useScrollManager';
import { useRecapManager } from './hooks/useRecapManager';
import { useUnityDetails } from './hooks/useUnityDetails';
import { useCheerSystem } from './hooks/useCheerSystem';
import { useReportSystem } from './hooks/useReportSystem';
import { useInviteManager } from './hooks/useInviteManager';
import { useUserProfile } from './hooks/useUserProfile';
import { useGroupChatState } from './hooks/useGroupChatState';
import { useGroupChatHandlers } from './hooks/useGroupChatHandlers';
import { useMessageInteraction } from './hooks/useMessageInteraction';

interface GroupChatProps {
  groupId: string;
  userData: UserData;
  userGroups?: Group[];
  isActive?: boolean;
  onInputFocusChange?: (focused: boolean) => void;
  onBack?: () => void;
  onGroupSelect?: (groupId: string) => void;
  isExternalModalOpen?: boolean;
  initialShowInviteModal?: boolean;
}

const GroupChat: FC<GroupChatProps> = ({ groupId, userData, userGroups = [], onInputFocusChange, onBack, onGroupSelect, isExternalModalOpen = false, initialShowInviteModal = false }) => {
  const { language, t, tArray, isLoaded } = useLanguage();
  const API_BASE = Capacitor.isNativePlatform() ? 'https://scripturehabit.app' : '';

  // Primary Data Hooks
  const {
    messages,
    groupData,
    loading,
    groupNotFound,
    userReadCount,
    initialScrollDone, setInitialScrollDone,
    hasMoreOlder,
    isLoadingOlder, loadMoreOlderMessages,
    membersMap,
    latestMessageRef,
    prevMessageCountRef
  } = useGroupMessages(groupId, userData, t);

  // If the group was deleted, go back to home view
  useEffect(() => {
    if (groupNotFound && onBack) {
      onBack();
    }
  }, [groupNotFound, onBack]);




  // Feature Hooks
  const { 
    translatedGroupName, translatedGroupDesc, 
    showAddNoteTooltip, setShowAddNoteTooltip,
    showInactivityPolicyBanner, setShowInactivityPolicyBanner 
  } = useGroupChatUI(groupId, groupData, language || 'en', API_BASE);

  const unityPercentage: number = useUnityScore(groupId, userData, groupData, messages);
  
  const { 
    isLeaving, isDeleting, handleLeaveGroup, handleDeleteGroup, togglePublicStatus, handleUpdateGroupName
  } = useGroupActions(groupId, userData, groupData, language || 'en', t, onBack, onBack);


  const { 
    translatingIds, translatedTexts, handleSendMessage, handleSaveEdit, 
    handleConfirmDeleteMessage, handleToggleReaction, handleTranslateMessage, handleLazyTranslate
  } = useMessageActions(groupId, userData, language || 'en', t);

  const { 
    containerRef, handleScroll, previousScrollHeightRef, previousScrollTopRef, scrollToBottom 
  } = useScrollManager(groupId, userData, messages, userReadCount, loading, initialScrollDone, setInitialScrollDone, latestMessageRef, prevMessageCountRef);

  const { 
    isRecapLoading, isRecapAvailable, handleGenerateWeeklyRecap 
  } = useRecapManager(groupId, groupData, language || 'en', t);

  const { 
    showUnityModal, setShowUnityModal, unityModalData, 
    membersList, setMembersList, handleShowUnityModal 
  } = useUnityDetails(groupData, messages, userData);

  // Interaction and Modal Hooks
  const {
    replyTo, setReplyTo,
    contextMenu, setContextMenu,
    editingMessage, setEditingMessage,
    editText, setEditText,
    showDeleteMessageModal, setShowDeleteMessageModal,
    messageToDelete, setMessageToDelete,
    textareaRef,
    handleReply,
    handleMessageClick,
    closeContextMenu,
    handleEditMessage,
    handleCancelEdit,
    handleDeleteMessageClick
  } = useMessageInteraction();

  useEffect(() => {
    if (contextMenuRef.current && contextMenu.show) {
      contextMenuRef.current.style.top = `${contextMenu.y}px`;
      contextMenuRef.current.style.left = `${contextMenu.x}px`;
    }
  }, [contextMenu.show, contextMenu.x, contextMenu.y]);

  const {
    cheerTarget, setCheerTarget, isSendingCheer, cheeredTodayUids, handleSendCheer, handleCheerClick
  } = useCheerSystem(groupId, userData, t);

  const {
    showReportModal, setShowReportModal, reportReason, setReportReason, confirmReport, handleReportClick
  } = useReportSystem(groupId, userData, t);

  const {
    showInviteModal, setShowInviteModal, handleCopyInviteLink, handleRegenerateInviteCode
  } = useInviteManager(groupId, groupData, t);

  // Auto-open invite modal on first load (e.g., right after group creation)
  useEffect(() => {
    if (initialShowInviteModal && groupData && !loading) {
      setShowInviteModal(true);
    }
  }, [initialShowInviteModal, groupData, loading, setShowInviteModal]);

  const {
    selectedMember, setSelectedMember, handleUserProfileClick
  } = useUserProfile(membersMap, membersList);

  const {
    state: localState,
    setMembersLoading,
    setShowMobileMenu
  } = useGroupChatState();

  const {
    activeModal, setActiveModal,
    deleteConfirmationName, setDeleteConfirmationName,
    noteToEdit, setNoteToEdit,
    reactionsToShow, setReactionsToShow,
    newGroupName, setNewGroupName,
    newGroupDescription, setNewGroupDescription,
    newTranslatedName, setNewTranslatedName,
    newTranslatedDesc, setNewTranslatedDesc,
    resetModalState
  } = useModalStore();

  // Reset modal state on unmount to prevent modals from reappearing in other groups
  useEffect(() => {
    return () => {
      resetModalState();
    };
  }, [resetModalState]);


  const { membersLoading, showMobileMenu } = localState;

  const {
    contextMenuRef,
    handleShowMembers,
    handleShowReactions,
    handleDismissInactivityBanner
  } = useGroupChatHandlers({
    groupData,
    membersMap,
    membersList,
    initialShowInviteModal,
    loading,
    setShowInviteModal,
    setActiveModal,
    setMembersLoading,
    setShowMobileMenu,
    setMembersList,
    setReactionsToShow,
    setShowInactivityPolicyBanner
  });

  const isOwner = groupData?.ownerUserId === userData?.uid;
  const isAnyModalOpen = activeModal !== null || showDeleteMessageModal || !!editingMessage || showUnityModal || showInviteModal || showReportModal || !!cheerTarget || isExternalModalOpen;

  const chatContextValue = {
    groupId,
    userData,
    groupData,
    messages,
    loading,
    language: language || 'en',
    t,
    tArray,
    membersMap,
    membersList,
    replyTo,
    setReplyTo,
    editingMessage,
    setEditingMessage,
    editText,
    setEditText,
    activeModal,
    setActiveModal,
    contextMenu,
    setContextMenu,
    handleSendMessage,

    handleSaveEdit,
    handleConfirmDeleteMessage,
    handleToggleReaction,
    handleTranslateMessage,
    handleLazyTranslate,
    translatingIds,
    translatedTexts,
    textareaRef,
    containerRef,
    handleScroll,
    previousScrollHeightRef,
    previousScrollTopRef,
    scrollToBottom,
    handleCancelEdit,
    userReadCount
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
    <ChatProvider value={chatContextValue}>
      <div className="GroupChat">
        <NewNote
          isOpen={activeModal === 'newNote' || activeModal === 'editNote'}
          onClose={() => {
            setActiveModal(null);
            setNoteToEdit(null);
          }}
          userData={userData}
          userGroups={userGroups}
          currentGroupId={groupId}
          noteToEdit={noteToEdit}
        />
        <ChatHeader 
          onBack={onBack}
          groupData={groupData}
          translatedGroupName={translatedGroupName}
          translatedGroupDesc={translatedGroupDesc}
          language={language || 'en'}
          t={t}
          isOwner={isOwner}
          setNewGroupName={setNewGroupName}
          setNewGroupDescription={setNewGroupDescription}
          setNewTranslatedName={setNewTranslatedName}
          setNewTranslatedDesc={setNewTranslatedDesc}
          setActiveModal={setActiveModal}
          unityPercentage={unityPercentage}
          handleShowUnityModal={handleShowUnityModal}
          togglePublicStatus={togglePublicStatus}
          setShowInviteModal={setShowInviteModal}
          handleShowMembers={handleShowMembers}
          isRecapAvailable={isRecapAvailable}
          isRecapLoading={isRecapLoading}
          handleGenerateWeeklyRecap={handleGenerateWeeklyRecap}
          showMobileMenu={showMobileMenu}
          setShowMobileMenu={setShowMobileMenu}
          handleCopyInviteLink={handleCopyInviteLink}
          userGroups={userGroups}
          groupId={groupId}
          onGroupSelect={onGroupSelect}
          userData={userData}
        />

        <GroupChatMessageListContainer
          hasMoreOlder={hasMoreOlder}
          isLoadingOlder={isLoadingOlder}
          loadMoreOlderMessages={loadMoreOlderMessages}
          handleMessageClick={handleMessageClick}
          handleEditMessage={handleEditMessage}
          handleDeleteMessageClick={handleDeleteMessageClick}
          handleReply={handleReply}
          handleReportClick={handleReportClick}
          handleUserProfileClick={handleUserProfileClick}
          handleShowReactions={handleShowReactions}
          activeModal={activeModal}
          setActiveModal={setActiveModal}
          contextMenu={contextMenu}
          setContextMenu={setContextMenu}
        />


        <GroupChatContextMenu
          contextMenu={contextMenu}
          contextMenuRef={contextMenuRef}
          userData={userData}
          t={t}
          handleReply={handleReply}
          handleToggleReaction={handleToggleReaction}
          handleEditMessage={handleEditMessage}
          handleDeleteMessageClick={handleDeleteMessageClick}
          handleReportClick={handleReportClick}
          closeContextMenu={closeContextMenu}
        />

        <GroupChatModals
          t={t} language={language} userData={userData} groupData={groupData}
          showLeaveModal={activeModal === 'leave'} setShowLeaveModal={(show) => setActiveModal(show ? 'leave' : null)} isLeaving={isLeaving} handleLeaveGroup={handleLeaveGroup}
          showDeleteModal={activeModal === 'delete'} setShowDeleteModal={(show) => setActiveModal(show ? 'delete' : null)} deleteConfirmationName={deleteConfirmationName} setDeleteConfirmationName={setDeleteConfirmationName} isDeleting={isDeleting} handleDeleteGroup={handleDeleteGroup}
          showEditNameModal={activeModal === 'editName'} setShowEditNameModal={(show) => setActiveModal(show ? 'editName' : null)} newGroupName={newGroupName} setNewGroupName={setNewGroupName} newGroupDescription={newGroupDescription} setNewGroupDescription={setNewGroupDescription} newTranslatedName={newTranslatedName} setNewTranslatedName={setNewTranslatedName} newTranslatedDesc={newTranslatedDesc} setNewTranslatedDesc={setNewTranslatedDesc} handleUpdateGroupName={async () => { 
            const success = await handleUpdateGroupName(newGroupName, newGroupDescription, newTranslatedName, newTranslatedDesc);
            if (success) {
              setActiveModal(null);
              setNewGroupName('');
              setNewGroupDescription('');
              setNewTranslatedName('');
              setNewTranslatedDesc('');
            }
          }} translatedGroupName={translatedGroupName} translatedGroupDesc={translatedGroupDesc}
          showDeleteMessageModal={showDeleteMessageModal} setShowDeleteMessageModal={setShowDeleteMessageModal} messageToDelete={messageToDelete} setMessageToDelete={setMessageToDelete} handleConfirmDeleteMessage={async () => { 
            if (messageToDelete) {
              await handleConfirmDeleteMessage(messageToDelete.id);
              setShowDeleteMessageModal(false);
              setMessageToDelete(null);
            }
          }}
          editingMessage={editingMessage} editText={editText} setEditText={setEditText} handleCancelEdit={handleCancelEdit} handleSaveEdit={async () => { if (editingMessage) await handleSaveEdit(editingMessage.id, editText).then(() => setEditingMessage(null)); }}
          showReactionsModal={activeModal === 'reactions'} setShowReactionsModal={(show) => setActiveModal(show ? 'reactions' : null)} reactionsToShow={reactionsToShow}
          showMembersModal={activeModal === 'members'} setShowMembersModal={(show) => setActiveModal(show ? 'members' : null)} membersList={membersList} membersLoading={membersLoading} setSelectedMember={setSelectedMember}
          showUnityModal={showUnityModal} setShowUnityModal={setShowUnityModal} unityPercentage={unityPercentage} unityModalData={unityModalData} cheeredTodayUids={cheeredTodayUids} handleCheerClick={handleCheerClick}
          cheerTarget={cheerTarget} setCheerTarget={setCheerTarget} isSendingCheer={isSendingCheer} handleSendCheer={async () => { await handleSendCheer(); }}
          showReportModal={showReportModal} setShowReportModal={setShowReportModal} reportReason={reportReason} setReportReason={setReportReason} confirmReport={async () => { await confirmReport(); }}
          selectedMember={selectedMember} handleUserProfileClick={handleUserProfileClick}
          showInviteModal={showInviteModal} setShowInviteModal={setShowInviteModal} handleCopyInviteLink={handleCopyInviteLink} handleRegenerateInviteCode={handleRegenerateInviteCode}
        />

        <GroupChatFooter
          showInactivityPolicyBanner={showInactivityPolicyBanner}
          handleDismissInactivityBanner={handleDismissInactivityBanner}
          handleSendMessage={handleSendMessage}
          scrollToBottom={scrollToBottom}
          isAnyModalOpen={isAnyModalOpen}
          replyTo={replyTo}
          setReplyTo={setReplyTo}
          t={t}
          tArray={tArray}
          textareaRef={textareaRef}
          onInputFocusChange={onInputFocusChange}
          containerRef={containerRef}
          showAddNoteTooltip={showAddNoteTooltip}
          handleDismissTooltip={() => setShowAddNoteTooltip(false)}
          setIsNewNoteOpen={() => setActiveModal('newNote')}
          userData={userData}
        />
      </div>
    </ChatProvider>
  );
};

export default GroupChat;
