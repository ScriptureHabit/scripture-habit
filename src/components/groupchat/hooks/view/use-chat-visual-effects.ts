import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Message } from '../../../../types/chat';
import { parseTimestampToMillis } from '../../../../utils/time-utils';
import { UserData } from '../../../../types/user';

/**
 * Hook for handling chat-related visual effects (like confetti for streaks).
 * Purely side-effect based, doesn't modify state.
 */
export const useChatVisualEffects = (
  messages: Message[], 
  userData: UserData | null
) => {
  const lastProcessedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (messages.length === 0) return;
    
    // Only check the newest incoming message
    const lastMsg = messages[messages.length - 1];
    
    if (lastMsg.id !== lastProcessedIdRef.current) {
      lastProcessedIdRef.current = lastMsg.id;

      // Check if it's a streak announcement from someone else
      const messageTime = parseTimestampToMillis(lastMsg.createdAt);
      const isRecent = messageTime && (Date.now() - messageTime) < 30000;
      
      if (
        lastMsg.messageType === 'streakAnnouncement' && 
        lastMsg.messageData?.userId !== userData?.uid && 
        isRecent
      ) {
        confetti({ 
          particleCount: 150, 
          spread: 70, 
          origin: { y: 0.6 }, 
          zIndex: 10000 
        });
      }
    }
  }, [messages, userData?.uid]);
};
