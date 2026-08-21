import { useEffect, useRef } from 'react';
import { Message } from '../../../../types/chat';

/**
 * Custom hook for automatically triggering lazy translation
 * when a message element scrolls into view via IntersectionObserver.
 */
export const useAutoTranslateMessage = (
  msg: Message,
  isMe: boolean,
  handleLazyTranslate: (msg: Message) => void
) => {
  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!observerRef.current || isMe || msg.senderId === 'system' || msg.isSystemMessage || msg.senderId === 'ai-partner-bot' || msg.text?.startsWith('groupChat.')) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        handleLazyTranslate(msg);
        observer.disconnect();
      }
    }, { threshold: 0.1 });

    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [msg.id, isMe, msg.senderId, msg.isSystemMessage, handleLazyTranslate, msg]);

  return observerRef;
};
