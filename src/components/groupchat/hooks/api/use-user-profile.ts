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
    
    // 1. Immediately set cached member if available to open the modal instantly
    const member = membersMap[userId] || membersList.find(m => m.id === userId);
    if (member) {
      setSelectedMember(member);
    }

    // 2. Fetch the latest full profile from '/users/{userId}' to get accurate stats
    try {
      const snap = await getDoc(doc(db, 'users', userId));
      if (snap.exists()) {
        const profile = { id: snap.id, ...snap.data() } as UserProfileBrief;
        
        // Only update if the user has not closed the modal or switched to another user
        const currentSelected = useChatStore.getState().selectedMember;
        if (currentSelected && currentSelected.id === userId) {
          setSelectedMember(profile);
        } else if (!currentSelected && !member) {
          // If there was no cached member (so modal wasn't opened yet) and no other member was selected
          setSelectedMember(profile);
        }
      }
    } catch (e) {
      console.error("Failed to fetch user profile", e);
    }
  };

  return {
    selectedMember,
    setSelectedMember,
    handleUserProfileClick
  };
};
