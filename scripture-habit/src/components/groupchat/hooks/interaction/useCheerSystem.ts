import { useState, useEffect } from 'react';
import { db } from '../../../../firebase';
import apiClient from '../../../../Utils/apiClient';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { UserData } from '../../../../types/user';
import { UserProfileBrief } from '../../../../types/chat';

export const useCheerSystem = (
  groupId: string,
  userData: UserData,
  t: (key: string) => string
) => {
  const [cheerTarget, setCheerTarget] = useState<UserProfileBrief | null>(null);
  const [isSendingCheer, setIsSendingCheer] = useState(false);
  const [cheeredTodayUids, setCheeredTodayUids] = useState<Set<string>>(new Set<string>());

  useEffect(() => {
    const fetchCheers = async () => {
      if (!userData?.uid) return;
      try {
        const timeZone = userData.timeZone || 'UTC';
        const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone });
        const q = query(
          collection(db, 'cheers'),
          where('senderUid', '==', userData.uid),
          where('date', '==', todayStr)
        );
        const snapshot = await getDocs(q);
        const uids = new Set<string>();
        snapshot.forEach(doc => {
          uids.add(doc.data().targetUid);
        });
        setCheeredTodayUids(uids);
      } catch (err) {
        console.error("Error fetching cheers:", err);
      }
    };
    fetchCheers();
  }, [userData?.uid, userData?.timeZone]);

  const handleSendCheer = async () => {
    if (!cheerTarget || isSendingCheer) return;
    setIsSendingCheer(true);
    try {
      await apiClient.post('/api/send-cheer', {
        targetUid: cheerTarget.id,
        groupId,
        senderNickname: userData.nickname
      });

      toast.success(t('groupChat.cheerSent')?.replace('{nickname}', cheerTarget.nickname || ''));
      setCheeredTodayUids((prev: Set<string>) => {
        const next = new Set(prev);
        next.add(cheerTarget.id);
        return next;
      });
      setCheerTarget(null);
      return true;
    } catch (err: unknown) {
      const error = err as Error;
      console.error("Error sending cheer:", error.message);
      toast.error("Failed to send cheer");
      return false;
    } finally {

      setIsSendingCheer(false);
    }
  };

  const handleCheerClick = (member: UserProfileBrief) => {
    if (member.id === userData?.uid) return;
    setCheerTarget(member);
  };

  return {
    cheerTarget,
    setCheerTarget,
    isSendingCheer,
    cheeredTodayUids,
    handleSendCheer,
    handleCheerClick
  };
};
