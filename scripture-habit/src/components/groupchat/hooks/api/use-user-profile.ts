import { db } from '../../../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { UserProfileBrief, MembersMap } from '../../../../types/chat';
import { useChatStore } from '../../../../store/use-chat-store';

export const useUserProfile = (
  membersMap: MembersMap,
  membersList: UserProfileBrief[]
) => {
  const { selectedMember, setSelectedMember } = useChatStore();

  const handleUserProfileClick = async (userId: string | null) => {
    if (!userId || userId === 'system') return;
    const member = membersMap[userId] || membersList.find(m => m.id === userId);
    if (member) {
      setSelectedMember(member);
    } else {
      try {
        const snap = await getDoc(doc(db, 'users', userId));
        if (snap.exists()) {
          const profile = { id: snap.id, ...snap.data() } as UserProfileBrief;
          setSelectedMember(profile);
        }
      } catch (e) {
        console.error("Failed to fetch user profile", e);
      }
    }
  };

  return {
    selectedMember,
    setSelectedMember,
    handleUserProfileClick
  };
};
