import { FC, RefObject } from 'react';
import GroupChatMessageList from './GroupChatMessageList';
import { Message } from '../../../types/chat';
import { useChat, ActiveModalType } from '../ChatContext';
import { ContextMenu } from '../hooks/useMessageInteraction';

interface GroupChatMessageListContainerProps {
  hasMoreOlder: boolean;
  isLoadingOlder: boolean;
  loadMoreOlderMessages: (ref: RefObject<HTMLDivElement | null>, heightRef: RefObject<number>, topRef: RefObject<number>) => Promise<void>;
  
  // Interaction State from parent (required for close actions)
  activeModal: ActiveModalType;
  setActiveModal: (val: ActiveModalType) => void;
  contextMenu: ContextMenu;
  setContextMenu: (val: ContextMenu) => void;
  
  // Handles
  handleMessageClick: (msg: Message, e: React.MouseEvent) => void;
  handleEditMessage: (msg: Message) => void;
  handleDeleteMessageClick: (msg: Message) => void;
  handleReply: (msg: Message) => void;
  handleReportClick: (msg: Message) => void;
  handleShowReactions: (reactions: Record<string, string[]>) => void;
  handleUserProfileClick: (userId: string | null) => Promise<void>;
}


const GroupChatMessageListContainer: FC<GroupChatMessageListContainerProps> = ({
  hasMoreOlder, isLoadingOlder, loadMoreOlderMessages,
  activeModal, setActiveModal, contextMenu, setContextMenu,
  handleMessageClick, handleEditMessage, handleDeleteMessageClick, handleReply, handleReportClick, handleShowReactions, handleUserProfileClick
}) => {
  const {
    messages, language, userData, t, groupData, membersMap, userReadCount, loading,
    handleTranslateMessage, handleLazyTranslate, translatingIds, handleToggleReaction,
    translatedTexts, containerRef, handleScroll, previousScrollHeightRef, previousScrollTopRef,
    editingMessage, replyTo, setReplyTo, handleCancelEdit
  } = useChat();

  return (
    <div 
        className="messages-container" 
        ref={containerRef} 
        onScroll={handleScroll} 
        onClick={() => { 
            if (editingMessage) handleCancelEdit(); 
            if (replyTo) setReplyTo(null); 
            if (activeModal) setActiveModal(null); 
            if (contextMenu.show) setContextMenu({ show: false, x: 0, y: 0, messageId: null }); 
        }}
    >
      {loading && <div className="loading-spinner"><div className="spinner"></div></div>}
      {!loading && hasMoreOlder && messages.length > 0 && (
        <div className="load-more-container">
          {isLoadingOlder ? (
            <div className="spinner"></div>
          ) : (
            <button 
              className="load-more-btn" 
              onClick={() => loadMoreOlderMessages(containerRef, previousScrollHeightRef, previousScrollTopRef)} 
              disabled={isLoadingOlder} 
              tabIndex={-1}
            >
              {t('groupChat.loadPreviousMessages')}
            </button>
          )}
        </div>
      )}
      <GroupChatMessageList
        messages={messages}
        language={language}
        userData={userData}
        t={t}
        handleMessageClick={handleMessageClick}
        handleEditMessage={handleEditMessage}
        handleDeleteMessageClick={handleDeleteMessageClick}
        handleReply={handleReply}
        handleTranslateMessage={handleTranslateMessage}
        handleLazyTranslate={handleLazyTranslate}
        translatingIds={translatingIds}
        handleToggleReaction={handleToggleReaction}
        handleReportClick={handleReportClick}
        handleUserProfileClick={handleUserProfileClick}
        groupData={groupData}
        translatedTexts={translatedTexts}
        handleShowReactions={handleShowReactions}
        membersMap={membersMap}
        userReadCount={userReadCount}
      />
    </div>
  );
};

export default GroupChatMessageListContainer;
