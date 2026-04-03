import { useCallback, useEffect, useRef } from 'react';
import { db } from '../../../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { safeStorage } from '../../../../utils/storage';
import { UserProfileBrief, GroupData, MembersMap } from '../../../../types/chat';
import { ReactionItem, ActiveModal } from '../../../../store/useModalStore';

interface UseGroupChatHandlersParams {
  groupData: GroupData | null;
  membersMap: MembersMap;
  membersList: UserProfileBrief[];
  initialShowInviteModal: boolean;
  loading: boolean;
  setShowInviteModal: (show: boolean) => void;
  setActiveModal: (modal: ActiveModal) => void;
  setMembersLoading: (loading: boolean) => void;
  setShowMobileMenu: (value: boolean) => void;
  setMembersList: (updater: (prev: UserProfileBrief[]) => UserProfileBrief[]) => void;
  setReactionsToShow: (reactions: ReactionItem[]) => void;
  setShowInactivityPolicyBanner: (value: boolean) => void;
}

export const useGroupChatHandlers = ({
  groupData,
  membersMap,
  membersList,
  initialShowInviteModal,
  loading,
  setShowInviteModal,
  setActiveModal,
  setMembersLoading,
  setShowMobileMenu,
  setMembersList,
  setReactionsToShow,
  setShowInactivityPolicyBanner,
}: UseGroupChatHandlersParams) => {
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialShowInviteModal && groupData && !loading) {
      setShowInviteModal(true);
    }
  }, [initialShowInviteModal, groupData, loading, setShowInviteModal]);

  const handleShowMembers = useCallback(async () => {
    if (!groupData?.members) return;
    setShowMobileMenu(false);
    setActiveModal('members');
    setMembersLoading(true);
    try {
      const missingUids = groupData.members.filter(uid => !membersList.some(m => m.id === uid));
      if (missingUids.length > 0) {
        const snapshots = await Promise.all(missingUids.map(uid => getDoc(doc(db, 'users', uid))));
        const newMembers = snapshots.map(snap => snap.exists() ? { id: snap.id, ...snap.data() } as UserProfileBrief : { id: snap.id, nickname: 'Unknown' } as UserProfileBrief);
        setMembersList(prev => [...prev, ...newMembers]);
      }
    } catch (e) {
      console.error('Error loading members:', e);
    } finally {
      setMembersLoading(false);
    }
  }, [groupData?.members, membersList, setActiveModal, setMembersLoading, setMembersList, setShowMobileMenu]);

  const handleShowReactions = useCallback((reactions: Record<string, string[]>) => {
    const reactionsList: ReactionItem[] = [];
    Object.entries(reactions).forEach(([emoji, uids]) => {
      if (!Array.isArray(uids)) return;
      uids.forEach(uid => {
        reactionsList.push({
          userId: uid,
          emoji,
          nickname: membersMap[uid]?.nickname || 'Unknown'
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

