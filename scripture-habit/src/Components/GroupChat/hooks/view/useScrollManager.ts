import { useRef, useLayoutEffect, useEffect } from 'react';
import { safeStorage } from '../../../../Utils/storage';
import { Message } from '../../../../types/chat';

interface ScrollUserData {
  uid: string;
}

export const useScrollManager = (
  groupId: string,
  userData: ScrollUserData | null,
  messages: Message[],
  userReadCount: number | null,
  loading: boolean,
  initialScrollDone: boolean,
  setInitialScrollDone: (done: boolean) => void,
  latestMessageRef: React.MutableRefObject<Message | null>,
  prevMessageCountRef: React.MutableRefObject<number>
) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousScrollHeightRef = useRef(0);
  const previousScrollTopRef = useRef(0);

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  };

  const scrollToFirstUnread = (index: number) => {
    if (!containerRef.current) return false;
    const elements = containerRef.current.querySelectorAll('.message-wrapper, .message.system-message');
    if (elements[index]) {
      const element = elements[index] as HTMLElement;
      containerRef.current.scrollTop = element.offsetTop - 100;
      return true;
    }
    return false;
  };

  useLayoutEffect(() => {
    if (userReadCount === null || loading) return;
    if (messages.length === 0) return;

    if (!initialScrollDone) {
      const performInitialScroll = () => {
        let scrolled = false;
        const lastMsgId = safeStorage.get(`last_viewed_msg_${groupId}_${userData?.uid}`);

        const container = containerRef.current;
        if (!container) return;

        if (lastMsgId) {
          const el = container.querySelector(`#message-${lastMsgId}`) as HTMLElement;
          if (el) {
            container.scrollTop = el.offsetTop - 20;
            
            // Double check if scroll applied. If not, retry in next frame.
            if (container.scrollTop === 0 && el.offsetTop > 100) {
                requestAnimationFrame(() => {
                    container.scrollTop = el.offsetTop - 20;
                });
            }
            scrolled = true;
          }
        }

        if (!scrolled && userReadCount < messages.length) {
          scrolled = scrollToFirstUnread(userReadCount);
        }

        if (!scrolled) {
          scrollToBottom();
        }

        // Delay unlocking to ensure initial scroll position sticks and isn't overwritten
        // by browser-fired transient '0' scroll events during mounting/initialization
        setTimeout(() => {
            setInitialScrollDone(true);
            prevMessageCountRef.current = messages.length;
        }, 500);
      };

      // Initial immediate attempt
      performInitialScroll();

      // Slightly delayed second attempt to handle mobile layout timing shifts
      const timer = setTimeout(performInitialScroll, 150);
      return () => clearTimeout(timer);
    }
  }, [messages, userReadCount, loading, initialScrollDone, groupId, userData?.uid]);

  useEffect(() => {
    if (!initialScrollDone || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    
    // When messages are added (either new at bottom or old at top)
    if (messages.length > prevMessageCountRef.current) {
      // Check if the newest message is new (not just old ones added at top)
      if (lastMsg.id !== latestMessageRef.current?.id) {
        scrollToBottom();
      }
    }
    
    prevMessageCountRef.current = messages.length;
    latestMessageRef.current = lastMsg;
  }, [messages, initialScrollDone]);

  useLayoutEffect(() => {
    if (previousScrollHeightRef.current > 0 && containerRef.current) {
      const newScrollHeight = containerRef.current.scrollHeight;
      const heightDiff = newScrollHeight - previousScrollHeightRef.current;
      if (heightDiff > 0) {
        // Adjust scroll to maintain the same looking position
        containerRef.current.scrollTop = previousScrollTopRef.current + heightDiff;
      }
      previousScrollHeightRef.current = 0;
    }
  }, [messages]);

  const handleScroll = () => {
    if (!initialScrollDone) return;
    if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);

    scrollDebounceRef.current = setTimeout(() => {
      if (!containerRef.current || !userData) return;
      const scrollTop = containerRef.current.scrollTop;
      const elements = containerRef.current.querySelectorAll('[id^="message-"]');
      let topMsgId = null;

      for (const el of Array.from(elements)) {
        if ((el as HTMLElement).offsetTop >= scrollTop - 50) {
          topMsgId = el.id.replace('message-', '');
          break;
        }
      }
      if (topMsgId) {
        safeStorage.set(`last_viewed_msg_${groupId}_${userData.uid}`, topMsgId);
      }
    }, 200);
  };

  return { containerRef, handleScroll, previousScrollHeightRef, previousScrollTopRef, scrollToBottom };
};
