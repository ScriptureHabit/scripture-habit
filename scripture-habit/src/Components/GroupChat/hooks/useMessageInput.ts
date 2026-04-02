import { useState, useMemo, FormEvent, KeyboardEvent } from 'react';
import { Message } from '../../../types/chat';

/**
 * Hook for managing the chat message input state and logic.
 */
export const useMessageInput = (
  t: (key: string, replacements?: Record<string, string | number>) => string,
  tArray: (key: string) => string[],
  userData: { kickThreshold?: number } | null,
  handleSendMessage: (text: string, replyTo: Message | null) => Promise<boolean>,
  scrollToBottom: () => void,
  setReplyTo: (msg: Message | null) => void,
  replyTo: Message | null
) => {


  const [newMessage, setNewMessage] = useState('');

  const inputPlaceholder = useMemo(() => {
    const typeMessageRaw = tArray('groupChat.typeMessage');
    let candidates = Array.isArray(typeMessageRaw) ? [...typeMessageRaw] : [typeMessageRaw];
    const inactivityThreshold = userData?.kickThreshold || 3;
    candidates.push(t('groupChat.placeholderInactivity', { days: inactivityThreshold }));
    candidates.push(t('groupChat.placeholderShare'));
    candidates.push(t('groupChat.placeholderEncourage'));
    return candidates[Math.floor(Math.random() * candidates.length)];
  }, [t, tArray, userData?.kickThreshold]);

  const onSendMessage = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const success = await handleSendMessage(newMessage, replyTo);
    if (success) {
      setNewMessage('');
      setReplyTo(null);
      setTimeout(scrollToBottom, 50);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  return {
    newMessage,
    setNewMessage,
    inputPlaceholder,
    onSendMessage,
    handleKeyDown
  };
};
