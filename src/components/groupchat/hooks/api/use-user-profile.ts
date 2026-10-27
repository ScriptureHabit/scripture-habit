import { UserProfileBrief, MembersMap } from '../../../../types/chat';
import { useChatStore } from '../../../../store/use-chat-store';
import apiClient from '../../../../utils/api-client';

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

    // 2. Fetch only the public profile fields from the API.
    try {
      const response = await apiClient.get<{ profile: UserProfileBrief }>(
        `/api/auth/profile/${encodeURIComponent(userId)}`
      );
      if (response.data.profile) {
        const profile = { id: userId, ...response.data.profile };
        
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
