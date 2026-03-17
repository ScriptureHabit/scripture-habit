import { useRef, useLayoutEffect, useEffect } from 'react';
import { safeStorage } from '../../../Utils/storage';
import { Message } from '../../../types/chat';

export const useScrollManager = (
  groupId: string,
  userData: any,
  messages: Message[],
  userReadCount: number | null,
  loading: boolean,
  initialScrollDone: boolean,
  setInitialScrollDone: (done: boolean) => void,
  latestMessageRef: React.MutableRefObject<Message | null>,
  prevMessageCountRef: React.MutableRefObject<number>
) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollDebounceRef = useRef<any>(null);
  const previousScrollHeightRef = useRef(0);

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
      let scrolled = false;
      const lastMsgId = safeStorage.get(`last_viewed_msg_${groupId}_${userData?.uid}`);
      if (lastMsgId) {
        const el = containerRef.current?.querySelector(`#message-${lastMsgId}`) as HTMLElement;
        if (el) {
          containerRef.current!.scrollTop = el.offsetTop - 20;
          scrolled = true;
        }
      }

      if (!scrolled && userReadCount < messages.length) {
        scrolled = scrollToFirstUnread(userReadCount);
      }

      if (!scrolled) scrollToBottom();
      setInitialScrollDone(true);
      prevMessageCountRef.current = messages.length;
    }
  }, [messages, userReadCount, loading, initialScrollDone, groupId, userData?.uid]);

  useEffect(() => {
    if (!initialScrollDone || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (messages.length > prevMessageCountRef.current && lastMsg.id !== latestMessageRef.current?.id) {
      scrollToBottom();
    }
    prevMessageCountRef.current = messages.length;
    latestMessageRef.current = lastMsg;
  }, [messages, initialScrollDone]);

  useLayoutEffect(() => {
    if (previousScrollHeightRef.current > 0 && containerRef.current) {
      const diff = containerRef.current.scrollHeight - previousScrollHeightRef.current;
      if (diff > 0) containerRef.current.scrollTop = diff;
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

  return { containerRef, handleScroll, previousScrollHeightRef, scrollToBottom };
};
