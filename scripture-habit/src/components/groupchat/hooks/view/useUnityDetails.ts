import { useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../../firebase';
import { GroupData, Message, UserProfileBrief } from '../../../../types/chat';
import { UserData } from '../../../../types/user';
import { parseTimestampToMillis } from '../../../../utils/timeUtils';

export const useUnityDetails = (
  groupData: GroupData | null,
  messages: Message[],
  userData: UserData | null
) => {
  const [showUnityModal, setShowUnityModal] = useState(false);
  const [unityModalData, setUnityModalData] = useState<{ posted: { id: string; nickname: string }[]; notPosted: { id: string; nickname: string }[] }>({ posted: [], notPosted: [] });
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [membersList, setMembersList] = useState<UserProfileBrief[]>([]);

  const handleShowUnityModal = async () => {
    if (!groupData || !groupData.members) return;
    setShowUnityModal(true);
    setDetailsLoading(true);

    const effectiveTimeZone = groupData?.timeZone || userData?.timeZone || 'UTC';
    const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: effectiveTimeZone });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    const eligibleMemberIds = groupData.members;

    const uniquePosters = new Set<string>();
    if (groupData.dailyActivity?.activeMembers && (groupData.dailyActivity.date === todayStr || groupData.dailyActivity.date === new Date().toDateString())) {
      groupData.dailyActivity.activeMembers.forEach(uid => uniquePosters.add(uid));
    }

    messages.forEach(msg => {
      const msgTime = parseTimestampToMillis(msg.createdAt);
      if (msgTime >= todayTime && msg.senderId !== 'system' && !msg.isSystemMessage && msg.isNote) {
        uniquePosters.add(msg.senderId!);
      }
    });

    const postedUids = Array.from(uniquePosters).filter(uid => eligibleMemberIds.includes(uid));
    const notPostedUids = eligibleMemberIds.filter(uid => !postedUids.includes(uid));

    try {
      const allUids = Array.from(new Set([...postedUids, ...notPostedUids]));
      const missingUids = allUids.filter(uid => !membersList.some(m => m.id === uid));

      let updatedList = [...membersList];
      if (missingUids.length > 0) {
        const snapshots = await Promise.all(missingUids.map(uid => getDoc(doc(db, 'users', uid))));
        const newMembers = snapshots.map(snap => snap.exists() ? { id: snap.id, ...snap.data() } as UserProfileBrief : { id: snap.id, nickname: 'Unknown' } as UserProfileBrief);
        updatedList = [...membersList, ...newMembers];
        setMembersList(updatedList);
      }

      const posted = postedUids.map(uid => ({ id: uid, nickname: updatedList.find(m => m.id === uid)?.nickname || 'Unknown' }));
      const notPosted = notPostedUids.map(uid => ({ id: uid, nickname: updatedList.find(m => m.id === uid)?.nickname || 'Unknown' }));
      setUnityModalData({ posted, notPosted });
    } catch (e) {
      console.error("Error fetching unity details:", e);
    } finally {
      setDetailsLoading(false);
    }
  };

  return { showUnityModal, setShowUnityModal, unityModalData, detailsLoading, membersList, setMembersList, handleShowUnityModal };
};
