import { FC, useRef, useLayoutEffect, useState, useEffect } from 'react';
import GroupChatMessageList from './GroupChatMessageList';
import { useChatData, useChatUIActions } from '../ChatContext';

const GroupChatMessageListContainer: FC = () => {
  const { messages, loading } = useChatData();
  const { 
    containerRef, previousScrollHeightRef, 
    previousScrollTopRef, loadMoreOlderMessages,
    hasMoreOlder, isLoadingOlder, handleScroll
  } = useChatUIActions();

  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
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
      // Give the browser a frame to paint the scroll position before showing
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
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
        className={`message-list-container ${isVisible ? 'fully-visible' : ''}`} 
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

        <GroupChatMessageList messages={messages} />
      </div>
    </div>
  );
};

export default GroupChatMessageListContainer;
