import { useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { GroupData, Message, UserProfileBrief } from '../../../types/chat';

export const useUnityDetails = (
  groupData: GroupData | null,
  messages: Message[],
  userData: any
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

    const memberJoinedAt = groupData.memberJoinedAt || {};
    const eligibleMemberIds = groupData.members.filter(uid => {
      const joinedTs = memberJoinedAt[uid];
      if (!joinedTs) return true;
      let joinedTime = 0;
      if (joinedTs?.toDate) joinedTime = joinedTs.toDate().getTime();
      else if (joinedTs?.seconds) joinedTime = joinedTs.seconds * 1000;
      return joinedTime < todayTime;
    });

    const uniquePosters = new Set<string>();
    if (groupData.dailyActivity?.activeMembers && (groupData.dailyActivity.date === todayStr || groupData.dailyActivity.date === new Date().toDateString())) {
      groupData.dailyActivity.activeMembers.forEach(uid => uniquePosters.add(uid));
    }
    if (groupData.memberLastActive) {
      Object.entries(groupData.memberLastActive).forEach(([uid, ts]: [string, any]) => {
        let activeTime = 0;
        if (ts?.toDate) activeTime = ts.toDate().getTime();
        else if (ts?.seconds) activeTime = ts.seconds * 1000;
        if (activeTime >= todayTime) uniquePosters.add(uid);
      });
    }
    messages.forEach(msg => {
      let msgTime = 0;
      if (msg.createdAt?.toDate) msgTime = msg.createdAt.toDate().getTime();
      else if (msg.createdAt?.seconds) msgTime = msg.createdAt.seconds * 1000;
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
