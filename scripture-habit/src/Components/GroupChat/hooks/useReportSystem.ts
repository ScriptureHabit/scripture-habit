import { useState } from 'react';
import { db } from '../../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { Message } from '../../../types/chat';
import { UserData } from '../../../types/user';

export const useReportSystem = (
  groupId: string,
  userData: UserData,
  t: (key: string) => string
) => {
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportedMessage, setReportedMessage] = useState<Message | null>(null);
  const [reportReason, setReportReason] = useState('inappropriate');

  const confirmReport = async () => {
    if (!reportedMessage || !userData) return false;
    try {
      await addDoc(collection(db, 'reports'), {
        messageId: reportedMessage.id,
        groupId,
        reporterUid: userData.uid,
        reason: reportReason,
        createdAt: serverTimestamp(),
        text: reportedMessage.text,
        senderId: reportedMessage.senderId
      });
      toast.success(t('groupChat.reportSuccess'));
      setShowReportModal(false);
      setReportedMessage(null);
      return true;
    } catch (error) {
      console.error("Error reporting message:", error);
      toast.error(t('groupChat.reportError'));
      return false;
    }
  };

  const handleReportClick = (message: Message) => {
    setReportedMessage(message);
    setShowReportModal(true);
  };

  return {
    showReportModal,
    setShowReportModal,
    reportedMessage,
    setReportedMessage,
    reportReason,
    setReportReason,
    confirmReport,
    handleReportClick
  };
};
