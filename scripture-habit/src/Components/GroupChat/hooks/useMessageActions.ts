import { useState } from 'react';
import { doc, updateDoc, deleteDoc, arrayRemove, arrayUnion, serverTimestamp, collection, addDoc, increment } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { toast } from 'react-toastify';
import { Message, Reaction } from '../../../types/chat';

export const useMessageActions = (
  groupId: string,
  userData: any,
  language: string,
  t: (key: string) => string,
  API_BASE: string
) => {
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());
  const [translatedTexts, setTranslatedTexts] = useState<Record<string, string>>({});

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

  const handleToggleReaction = async (message: Message) => {
    if (!userData) return;
    try {
      const messageRef = doc(db, 'groups', groupId, 'messages', message.id);
      const existingReaction = message.reactions?.find(r => r.userId === userData.uid);

      if (existingReaction) {
        await updateDoc(messageRef, {
          reactions: arrayRemove(existingReaction)
        });
      } else {
        const newReaction: Reaction = {
          userId: userData.uid,
          nickname: userData.nickname || 'User',
          emoji: '👍'
        };
        await updateDoc(messageRef, {
          reactions: arrayUnion(newReaction)
        });
      }
    } catch (error) {
      console.error("Error toggling reaction:", error);
    }
  };

  const handleTranslateMessage = async (message: Message) => {
    if (!message.text || translatingIds.has(message.id)) return;

    setTranslatingIds(prev => new Set(prev).add(message.id));
    try {
      const idToken = await auth?.currentUser?.getIdToken();
      const response = await fetch(`${API_BASE}/api/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          text: message.text,
          targetLanguage: language
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
  };

  return {
    translatingIds,
    translatedTexts,
    handleSendMessage,
    handleSaveEdit,
    handleConfirmDeleteMessage,
    handleToggleReaction,
    handleTranslateMessage
  };
};
