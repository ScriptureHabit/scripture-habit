import { useCallback, useRef } from 'react';
import { GroupData, MembersMap } from '../../../../types/chat';
import { ReactionPreview } from '../../../../../types/firestore';
import { ReactionItem } from '../../../../store/use-modal-store';
import { useChatStore } from '../../../../store/use-chat-store';
import { useModalStore } from '../../../../store/use-modal-store';
import { safeStorage } from '../../../../utils/storage';

interface UseGroupChatHandlersParams {
  groupData: GroupData | null;
  membersMap: MembersMap;
  initialShowInviteModal: boolean;
  loading: boolean;
}

export const useGroupChatHandlers = ({
  groupData,
  membersMap,
}: UseGroupChatHandlersParams) => {
  const { 
    setShowInactivityPolicyBanner, setShowMobileMenu 
  } = useChatStore();
  const { setActiveModal, setReactionsToShow } = useModalStore();
  const contextMenuRef = useRef<HTMLDivElement>(null);


  const handleShowMembers = useCallback(() => {
    if (!groupData?.members) return;
    setShowMobileMenu(false);
    setActiveModal('members');
  }, [groupData?.members, setActiveModal, setShowMobileMenu]);

  const handleShowReactions = useCallback((reactions: Record<string, string[]>, previews?: Record<string, ReactionPreview[]>) => {
    const reactionsList: ReactionItem[] = [];
    Object.entries(reactions).forEach(([emoji, uids]) => {
      if (!Array.isArray(uids)) return;
      uids.forEach(uid => {
        const preview = previews?.[emoji]?.find((p: ReactionPreview) => p.uid === uid);
        reactionsList.push({
          userId: uid,
          emoji,
          nickname: membersMap[uid]?.nickname || preview?.nickname || 'Unknown'
        });
      });
    });
    setReactionsToShow(reactionsList);
    setActiveModal('reactions');
  }, [membersMap, setActiveModal, setReactionsToShow]);

  const handleDismissInactivityBanner = useCallback(() => {
    setShowInactivityPolicyBanner(false);
    safeStorage.set('hasDismissedInactivityPolicy', 'true');
  }, [setShowInactivityPolicyBanner]);

  return {
    contextMenuRef,
    handleShowMembers,
    handleShowReactions,
    handleDismissInactivityBanner,
  };
};

