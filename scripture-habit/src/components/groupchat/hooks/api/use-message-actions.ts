import { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import apiClient from '../../../../utils/apiClient';
import { toast } from 'react-toastify';
import { Message } from '../../../../types/chat';
import { ChatAction } from '../core/chat-reducer';
import { ReactionPreview } from '../../../../../types/firestore';

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

  const handleSendMessage = useCallback(async (text: string, replyTo: Message | null) => {
    if (!text.trim() || !userData || !userData.uid) return false;
    
    const optimisticId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: optimisticId,
      text: text.trim(),
      senderId: userData.uid,
      senderNickname: userData.nickname || 'Member',
      senderPhotoURL: userData.photoURL || null,
      createdAt: new Date(), // Local timestamp for immediate sorting
      isOptimistic: true,
      optimisticId: optimisticId,
      ...(replyTo ? { 
        replyTo: {
          id: replyTo.id,
          senderNickname: replyTo.senderNickname || 'Member',
          text: replyTo.text,
          isNote: replyTo.messageType === 'studyNote'
        }
      } : {})
    };

    try {
      // 1. Optimistic Add
      if (dispatch) {
        dispatch({ type: 'ADD_NEW_MESSAGES', newMessages: [optimisticMessage] });
      }

      const response = await apiClient.post('/api/post-message', {
        groupId,
        text: text.trim(),
        replyTo,
        optimisticId
      });

      // 2. Resolve Optimistic Message with real ID
      if (response.data?.messageId && dispatch) {
        dispatch({
          type: 'UPDATE_MESSAGE',
          messageId: optimisticId,
          data: { id: response.data.messageId, isOptimistic: false }
        });

        // 📡 FORCE READ SYNC: Mark this new message as read for the sender immediately
        // We use a background fire-and-forget call to keep UX snappy
        try {
          apiClient.post('/api/update-read-status', {
            groupId,
            readMessageCount: response.data.totalCount || 0 // Assuming backend returns the new total
          });
        } catch {
          // Ignore errors for non-critical notification sync
        }
      }

      return true;
    } catch (error: unknown) {
      console.error("Error sending message:", error);
      
      // 3. Rollback on failure
      if (dispatch) {
        dispatch({ type: 'REMOVE_MESSAGE', messageId: optimisticId });
      }

      let errorMessage = t('groupChat.errorSendMessage');
      if (axios.isAxiosError(error)) {
        errorMessage = error.response?.data?.error || errorMessage;
      }
      toast.error(errorMessage);
      return false;
    }
  }, [groupId, userData, dispatch, t]);

  const handleSaveEdit = useCallback(async (message: Message, newText: string) => {
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

      await apiClient.post('/api/edit-message', {
        groupId,
        messageId: message.id,
        text: newText
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
  }, [groupId, dispatch, t]);

  const handleConfirmDeleteMessage = useCallback(async (message: Message) => {
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
        dispatch({ type: 'ADD_NEW_MESSAGES', newMessages: [message] });
      }
      return false;
    }
  }, [groupId, dispatch, t]);

  const handleToggleReactionDirect = useCallback(async (message: Message, emoji: string) => {
    if (!userData || !userData.uid) return;
    try {
      const currentReactions = message.reactions || {};
      const uids = currentReactions[emoji] || [];
      const currentPreviews = message.reactionPreviews?.[emoji] || [];
      const hasReacted = uids.includes(userData.uid);

      // Prepare new state
      const newUids = hasReacted 
        ? uids.filter(uid => uid !== userData.uid)
        : [...uids, userData.uid];

      const newPreviews = hasReacted
        ? currentPreviews.filter((p: ReactionPreview) => p.uid !== userData.uid)
        : (currentPreviews.length < 3 
            ? [{ uid: userData.uid, nickname: userData.nickname, photoURL: userData.photoURL }, ...currentPreviews].slice(0, 3)
            : currentPreviews);

      // Optimistic update
      if (dispatch) {
        dispatch({
          type: 'UPDATE_MESSAGE',
          messageId: message.id,
          data: {
            reactions: { ...currentReactions, [emoji]: newUids },
            reactionPreviews: { ...(message.reactionPreviews || {}), [emoji]: newPreviews }
          }
        });
      }

      await apiClient.post('/api/toggle-reaction', {
        groupId,
        messageId: message.id,
        emoji
      });

    } catch (error) {
      console.error("Error toggling reaction:", error);
      toast.error(t('groupChat.errorToggleReaction'));
      
      // Rollback on failure
      if (dispatch) {
        dispatch({
          type: 'UPDATE_MESSAGE',
          messageId: message.id,
          data: { reactions: message.reactions, reactionPreviews: message.reactionPreviews }
        });
      }
    }
  }, [groupId, userData, dispatch, t]);

  const handleToggleReaction = useCallback(async (message: Message) => {
    return handleToggleReactionDirect(message, '👍');
  }, [handleToggleReactionDirect]);

  const processBatch = useCallback(async () => {
    const queue = [...batchQueueRef.current];
    batchQueueRef.current = [];
    if (queue.length === 0) return;

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
        isLikelyAlreadyInLanguage(message.text, language)
    ) return;
    
    batchQueueRef.current.push(message);
    if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
    batchTimerRef.current = setTimeout(processBatch, 400);
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
        force
      });

      if (response.data?.translatedText) {
        setTranslatedTexts((prev: Record<string, string>) => ({ ...prev, [message.id]: response.data.translatedText }));
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
    translatingIds,
    translatedTexts,
    handleSendMessage,
    handleSaveEdit,
    handleConfirmDeleteMessage,
    handleToggleReaction,
    handleToggleReactionDirect,
    handleTranslateMessage,
    handleLazyTranslate
  };
};
