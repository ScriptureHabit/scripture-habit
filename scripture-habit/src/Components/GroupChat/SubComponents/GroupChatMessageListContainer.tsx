import { FC, useRef, useLayoutEffect, useState, useEffect } from 'react';
import GroupChatMessageList from './GroupChatMessageList';
import { useChatData, useChatInteraction, useChatActions, useChatUI } from '../ChatContext';

const GroupChatMessageListContainer: FC = () => {
  const { messages, userData, membersMap, loading, userReadCount, groupData, language } = useChatData();
  const { 
    containerRef, previousScrollHeightRef, 
    previousScrollTopRef 
  } = useChatInteraction();
  const { 
    t, handleToggleReaction, handleTranslateMessage, handleLazyTranslate, 
    handleReply, handleMessageClick, handleEditMessage, handleDeleteMessageClick,
    handleReportClick, handleUserProfileClick, handleShowReactions,
    loadMoreOlderMessages, hasMoreOlder, isLoadingOlder, translatingIds, translatedTexts,
    handleScroll
  } = useChatActions();
  const { isRecapAvailable } = useChatUI();

  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const scrollAtBottomRef = useRef(true);

  // Keep track if user was at bottom before messages update
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container) {
      const isAtBottom = Math.abs(container.scrollHeight - container.scrollTop - container.clientHeight) < 20;
      scrollAtBottomRef.current = isAtBottom;
    }
  }, [messages, containerRef]);

  // Handle scrolling after messages update
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (isInitialLoad && messages.length > 0) {
      container.scrollTop = container.scrollHeight;
      setIsInitialLoad(false);
    } else if (scrollAtBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, isInitialLoad, containerRef]);

  // Handle loading older messages
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onScroll = () => {
      if (container.scrollTop < 50 && hasMoreOlder && !isLoadingOlder) {
        loadMoreOlderMessages(containerRef, previousScrollHeightRef, previousScrollTopRef);
      }
      handleScroll();
    };

    container.addEventListener('scroll', onScroll);
    return () => container.removeEventListener('scroll', onScroll);
  }, [containerRef, hasMoreOlder, isLoadingOlder, loadMoreOlderMessages, handleScroll, previousScrollHeightRef, previousScrollTopRef]);

  return (
    <div className="message-list-outer">
      <div 
        className="message-list-container" 
        ref={containerRef}
      >
        {isLoadingOlder && (
          <div className="loading-older">
            <div className="spinner-mini"></div>
          </div>
        )}
        
        {messages.length === 0 && !loading && (
          <div className="empty-chat">
            <p>No messages yet. Start the conversation!</p>
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
          isRecapAvailable={isRecapAvailable}
        />
      </div>
    </div>
  );
};

export default GroupChatMessageListContainer;
