import { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { doc, updateDoc, arrayRemove, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import apiClient from '../../../Utils/apiClient';
import { toast } from 'react-toastify';
import { Message } from '../../../types/chat';
import { ChatAction } from './chatReducer';

interface SenderData {
  uid: string;
  nickname?: string;
  photoURL?: string | null;
}

export const useMessageActions = (
  groupId: string,
  userData: SenderData | null,
  language: string,
  t: (key: string) => string,
  dispatch?: React.Dispatch<ChatAction>
) => {
  const [translatingIds, setTranslatingIdsState] = useState<Set<string>>(new Set());
  const [translatedTexts, setTranslatedTexts] = useState<Record<string, string>>({});
  
  const translatingIdsRef = useRef<Set<string>>(new Set());
  const batchQueueRef = useRef<Message[]>([]);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevGroupIdRef = useRef<string>(groupId);

  // Helper to skip translation for messages already in the target language
  const isLikelyAlreadyInLanguage = (text: string, targetLang: string) => {
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
    if (targetLang === 'ja' && hasJapanese) return true;
    if (targetLang === 'en' && !hasJapanese && /[a-zA-Z]/.test(text)) return true;
    return false;
  };

  // Cleanup timer on unmount and clear cache on groupId change
  useEffect(() => {
    if (prevGroupIdRef.current !== groupId) {
      setTranslatedTexts({});
      translatingIdsRef.current.clear();
      setTranslatingIdsState(new Set());
      prevGroupIdRef.current = groupId;
    }
    return () => {
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
    };
  }, [groupId]);

  const handleSendMessage = async (text: string, replyTo: Message | null) => {
    if (!text.trim() || !userData || !userData.uid) return false;
    try {
      await apiClient.post('/api/post-message', {
        groupId,
        text: text.trim(),
        replyTo
      });

      return true;
    } catch (error: unknown) {
      console.error("Error sending message:", error);
      let errorMessage = t('groupChat.errorSendMessage');
      if (axios.isAxiosError(error)) {
        errorMessage = error.response?.data?.error || errorMessage;
      }
      toast.error(errorMessage);
      return false;
    }
  };

  const handleSaveEdit = async (message: Message, newText: string) => {
    const originalText = message.text;
    try {
      // Optimistic update
      if (dispatch) {
        dispatch({
          type: 'UPDATE_MESSAGE',
          messageId: message.id,
          data: { text: newText, isEdited: true }
        });
      }

      await updateDoc(doc(db, 'groups', groupId, 'messages', message.id), {
        text: newText,
        isEdited: true,
        editedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error("Error editing message:", error);
      toast.error(t('groupChat.errorEditMessage'));

      // Rollback
      if (dispatch) {
        dispatch({
          type: 'UPDATE_MESSAGE',
          messageId: message.id,
          data: { text: originalText }
        });
      }
      return false;
    }
  };

  const handleConfirmDeleteMessage = async (message: Message) => {
    try {
      // Optimistic delete
      if (dispatch) {
        dispatch({ type: 'REMOVE_MESSAGE', messageId: message.id });
      }

      await apiClient.post('/api/delete-message', { groupId, messageId: message.id });
      return true;
    } catch (error: unknown) {
      console.error("Error deleting message:", error);
      let errorMessage = t('groupChat.errorDeleteMessage');
      if (axios.isAxiosError(error)) {
        errorMessage = error.response?.data?.error || errorMessage;
      }
      toast.error(errorMessage);

      // Rollback
      if (dispatch) {
        // We add it back as a 'new' message or use a specific restore action if available
        // ADD_NEW_MESSAGES will handle adding it back to the list
        dispatch({ type: 'ADD_NEW_MESSAGES', newMessages: [message] });
      }
      return false;
    }
  };

  const handleToggleReaction = useCallback(async (message: Message) => {
    if (!userData || !userData.uid) return;
    try {
      const messageRef = doc(db, 'groups', groupId, 'messages', message.id);
      const emoji = '👍';
      const currentReactions = message.reactions || {};
      const uids = currentReactions[emoji] || [];
      const hasReacted = uids.includes(userData.uid);

      // Optimistic update
      if (dispatch) {
        const newUids = hasReacted 
          ? uids.filter(uid => uid !== userData.uid)
          : [...uids, userData.uid];
        
        dispatch({
          type: 'UPDATE_MESSAGE',
          messageId: message.id,
          data: {
            reactions: {
              ...currentReactions,
              [emoji]: newUids
            }
          }
        });
      }

      if (hasReacted) {
        await updateDoc(messageRef, {
          [`reactions.${emoji}`]: arrayRemove(userData.uid)
        });
      } else {
        await updateDoc(messageRef, {
          [`reactions.${emoji}`]: arrayUnion(userData.uid)
        });
      }
    } catch (error) {
      console.error("Error toggling reaction:", error);
      toast.error(t('groupChat.errorToggleReaction'));
      
      // Rollback on failure
      if (dispatch) {
        dispatch({
          type: 'UPDATE_MESSAGE',
          messageId: message.id,
          data: { reactions: message.reactions }
        });
      }
    }
  }, [groupId, userData]);

  const processBatch = useCallback(async () => {
    const queue = [...batchQueueRef.current];
    batchQueueRef.current = [];
    if (queue.length === 0) return;

    // Filter out duplicates and ones already in flight
    const toProcess = queue.filter((m, index, self) => 
      self.findIndex(t => t.id === m.id) === index && !translatingIdsRef.current.has(m.id)
    );
    if (toProcess.length === 0) return;

    const ids = toProcess.map(m => m.id);
    ids.forEach(id => translatingIdsRef.current.add(id));
    setTranslatingIdsState(new Set(translatingIdsRef.current));

    try {
      const response = await apiClient.post('/api/translate-batch', {
        messages: toProcess.map(m => ({ id: m.id, text: m.text })),
        targetLanguage: language,
        groupId: groupId
      });

      if (response.data?.translations) {
        setTranslatedTexts((prev: Record<string, string>) => ({ ...prev, ...response.data.translations }));
      }
    } catch (e) {
      console.error("Batch translation error:", e);
    } finally {
      ids.forEach(id => translatingIdsRef.current.delete(id));
      setTranslatingIdsState(new Set(translatingIdsRef.current));
    }
  }, [language, groupId]);

  const handleLazyTranslate = useCallback((message: Message) => {
    if (!message.text || 
        message.translations?.[language] || 
        translatedTexts[message.id] || 
        translatingIdsRef.current.has(message.id) ||
        isLikelyAlreadyInLanguage(message.text, language) // Skip if already in this language
    ) return;
    
    batchQueueRef.current.push(message);
    if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
    batchTimerRef.current = setTimeout(processBatch, 400); // 400ms buffer
  }, [language, translatedTexts, processBatch]);

  const handleTranslateMessage = useCallback(async (message: Message, force = false) => {
    if (!message.text || (translatingIdsRef.current.has(message.id) && !force)) return;

    translatingIdsRef.current.add(message.id);
    setTranslatingIdsState(new Set(translatingIdsRef.current));
    try {
      const response = await apiClient.post('/api/translate', {
        text: message.text,
        targetLanguage: language,
        messageId: message.id,
        groupId: groupId,
        force // Added force flag
      });

      if (response.data?.translatedText) {
        setTranslatedTexts(prev => ({ ...prev, [message.id]: response.data.translatedText }));
      }
    } catch (e) {
      console.error("Translation error:", e);
      toast.error("Translation failed");
    } finally {
      translatingIdsRef.current.delete(message.id);
      setTranslatingIdsState(new Set(translatingIdsRef.current));
    }
  }, [language, groupId]);


  return {
    translatingIds: translatingIds,
    translatedTexts,
    handleSendMessage,
    handleSaveEdit,
    handleConfirmDeleteMessage,
    handleToggleReaction,
    handleTranslateMessage,
    handleLazyTranslate
  };
};
