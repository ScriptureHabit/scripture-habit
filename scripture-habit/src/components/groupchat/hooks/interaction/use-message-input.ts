import { useMemo, FormEvent, KeyboardEvent } from 'react';
import { Message } from '../../../../types/chat';
import { useChatStore } from '../../../../store/use-chat-store';
import { DEFAULT_KICK_THRESHOLD } from '../../../../constants';

/**
 * Hook for managing the chat message input state and logic.
 */
export const useMessageInput = (
  t: (key: string, replacements?: Record<string, string | number>) => string,
  tArray: (key: string) => string[],
  userData: { kickThreshold?: number } | null,
  handleSendMessage: (text: string, replyTo: Message | null) => Promise<boolean>,
  scrollToBottom: () => void
) => {
  const { 
    replyTo, setReplyTo, editText: newMessage, setEditText: setNewMessage 
  } = useChatStore();

  const inputPlaceholder = useMemo(() => {
    const typeMessageRaw = tArray('groupChat.typeMessage');
    const candidates = Array.isArray(typeMessageRaw) ? [...typeMessageRaw] : [typeMessageRaw];
    const inactivityThreshold = userData?.kickThreshold || DEFAULT_KICK_THRESHOLD;
    candidates.push(t('groupChat.placeholderInactivity', { days: inactivityThreshold }));
    candidates.push(t('groupChat.placeholderShare'));
    candidates.push(t('groupChat.placeholderEncourage'));
    return candidates[Math.floor(Math.random() * candidates.length)];
  }, [t, tArray, userData?.kickThreshold]);

  const onSendMessage = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim()) return;
    
    const success = await handleSendMessage(newMessage, replyTo);
    if (success) {
      setNewMessage('');
      setReplyTo(null);
      setTimeout(scrollToBottom, 50);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Prevent sending if the user is still composing (e.g. Japanese IME)
    if (e.nativeEvent.isComposing) return;

    // On desktop (width > 768px), Enter sends the message and Shift+Enter adds a new line.
    // On mobile, Enter always adds a new line to avoid accidental sends with the virtual keyboard.
    if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 768) {
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
