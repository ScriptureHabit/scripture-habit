import { useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../../firebase';
import { GroupData, Message, UserProfileBrief } from '../../../../types/chat';
import { useChatStore } from '../../../../store/use-chat-store';

import { getUnityParticipation } from '../../../../utils/unity-utils';

export const useUnityDetails = (
  groupData: GroupData | null,
  messages: Message[]
) => {
  const { setShowUnityModal } = useChatStore();
  const [unityModalData, setUnityModalData] = useState<{ posted: { id: string; nickname: string }[]; notPosted: { id: string; nickname: string }[] }>({ posted: [], notPosted: [] });
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [membersList, setMembersList] = useState<UserProfileBrief[]>([]);

  const handleShowUnityModal = async () => {
    if (!groupData || !groupData.members) return;
    setShowUnityModal(true);
    setDetailsLoading(true);

    const { postedMembers, notPostedMembers } = getUnityParticipation(groupData as unknown as GroupData, messages);
    const postedUids = postedMembers;
    const notPostedUids = notPostedMembers;

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

  return { unityModalData, detailsLoading, membersList, setMembersList, handleShowUnityModal };
};
