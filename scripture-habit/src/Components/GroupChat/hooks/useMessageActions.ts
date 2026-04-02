import { useState, useRef, useEffect, useCallback } from 'react';
import { doc, updateDoc, deleteDoc, arrayRemove, arrayUnion, serverTimestamp, collection, addDoc, increment } from 'firebase/firestore';
import { db, auth, appCheck } from '../../../firebase';
import { getToken } from "firebase/app-check";
import { toast } from 'react-toastify';
import { Message } from '../../../types/chat';

export const useMessageActions = (
  groupId: string,
  userData: any,
  language: string,
  t: (key: string) => string,
  API_BASE: string
) => {
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());
  const [translatedTexts, setTranslatedTexts] = useState<Record<string, string>>({});
  
  const batchQueueRef = useRef<Message[]>([]);
  const batchTimerRef = useRef<any>(null);

  // Helper to skip translation for messages already in the target language
  const isLikelyAlreadyInLanguage = (text: string, targetLang: string) => {
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
    if (targetLang === 'ja' && hasJapanese) return true;
    if (targetLang === 'en' && !hasJapanese && /[a-zA-Z]/.test(text)) return true;
    return false;
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
    };
  }, []);

  const handleSendMessage = async (text: string, replyTo: Message | null) => {
    if (!text.trim() || !userData) return false;
    try {
      const messagesRef = collection(db, 'groups', groupId, 'messages');
      const groupRef = doc(db, 'groups', groupId);

      const messagePayload: any = {
        text: text.trim(),
        senderId: userData.uid,
        senderNickname: userData.nickname || 'Unknown',
        senderPhotoURL: userData.photoURL || null,
        createdAt: serverTimestamp(),
        messageType: 'text'
      };

      if (replyTo) {
        messagePayload.replyTo = {
          id: replyTo.id,
          senderNickname: replyTo.senderNickname || 'User',
          text: replyTo.text || '',
          isNote: !!replyTo.isNote
        };
      }

      await addDoc(messagesRef, messagePayload);
      await updateDoc(groupRef, {
        messageCount: increment(1),
        lastMessageAt: serverTimestamp(),
        lastMessageByNickname: userData.nickname || 'User',
        lastMessageByUid: userData.uid
      });

      return true;
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error(t('groupChat.errorSendMessage'));
      return false;
    }
  };

  const handleSaveEdit = async (messageId: string, newText: string) => {
    try {
      await updateDoc(doc(db, 'groups', groupId, 'messages', messageId), {
        text: newText,
        isEdited: true,
        editedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error("Error editing message:", error);
      toast.error(t('groupChat.errorEditMessage'));
      return false;
    }
  };

  const handleConfirmDeleteMessage = async (messageId: string) => {
    try {
      await deleteDoc(doc(db, 'groups', groupId, 'messages', messageId));
      await updateDoc(doc(db, 'groups', groupId), {
        messageCount: increment(-1)
      });
      return true;
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error(t('groupChat.errorDeleteMessage'));
      return false;
    }
  };

  const handleToggleReaction = useCallback(async (message: Message) => {
    if (!userData) return;
    try {
      const messageRef = doc(db, 'groups', groupId, 'messages', message.id);
      const emoji = '👍';
      const reactions = message.reactions || {};
      const uids = reactions[emoji] || [];
      const hasReacted = uids.includes(userData.uid);

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
    }
  }, [groupId, userData]);

  const processBatch = useCallback(async () => {
    const queue = [...batchQueueRef.current];
    batchQueueRef.current = [];
    if (queue.length === 0) return;

    // Filter out duplicates and ones already in flight
    const toProcess = queue.filter((m, index, self) => 
      self.findIndex(t => t.id === m.id) === index && !translatingIds.has(m.id)
    );
    if (toProcess.length === 0) return;

    const ids = toProcess.map(m => m.id);
    setTranslatingIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });

    try {
      const idToken = await auth?.currentUser?.getIdToken();
      const appCheckTokenResponse = await getToken(appCheck, false);
      const appCheckToken = appCheckTokenResponse.token;

      const response = await fetch(`${API_BASE}/api/translate-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
          'X-Firebase-AppCheck': appCheckToken
        },
        body: JSON.stringify({
          messages: toProcess.map(m => ({ id: m.id, text: m.text })),
          targetLanguage: language,
          groupId: groupId
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.translations) {
          setTranslatedTexts(prev => ({ ...prev, ...data.translations }));
        }
      }
    } catch (e) {
      console.error("Batch translation error:", e);
    } finally {
      setTranslatingIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
    }
  }, [translatingIds, language, groupId, API_BASE]);

  const handleLazyTranslate = useCallback((message: Message) => {
    if (!message.text || 
        message.translations?.[language] || 
        translatedTexts[message.id] || 
        translatingIds.has(message.id) ||
        isLikelyAlreadyInLanguage(message.text, language) // Skip if already in this language
    ) return;
    
    batchQueueRef.current.push(message);
    if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
    batchTimerRef.current = setTimeout(processBatch, 400); // 400ms buffer
  }, [language, translatedTexts, translatingIds, processBatch]);

  const handleTranslateMessage = useCallback(async (message: Message, force = false) => {
    if (!message.text || (translatingIds.has(message.id) && !force)) return;

    setTranslatingIds(prev => new Set(prev).add(message.id));
    try {
      const idToken = await auth?.currentUser?.getIdToken();
      const appCheckTokenResponse = await getToken(appCheck, false);
      const appCheckToken = appCheckTokenResponse.token;

      const response = await fetch(`${API_BASE}/api/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
          'X-Firebase-AppCheck': appCheckToken
        },
        body: JSON.stringify({
          text: message.text,
          targetLanguage: language,
          messageId: message.id,
          groupId: groupId,
          force // Added force flag
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.translatedText) {
          setTranslatedTexts(prev => ({ ...prev, [message.id]: data.translatedText }));
        }
      } else {
        toast.error("Translation failed");
      }
    } catch (e) {
      console.error("Translation error:", e);
    } finally {
      setTranslatingIds(prev => {
        const next = new Set(prev);
        next.delete(message.id);
        return next;
      });
    }
  }, [translatingIds, language, groupId, API_BASE]);

  return {
    translatingIds,
    translatedTexts,
    handleSendMessage,
    handleSaveEdit,
    handleConfirmDeleteMessage,
    handleToggleReaction,
    handleTranslateMessage,
    handleLazyTranslate
  };
};
