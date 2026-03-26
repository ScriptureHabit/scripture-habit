import { useState } from 'react';
import { db } from '../../../firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { GroupData } from '../../../types/chat';

export const useInviteManager = (
  groupId: string,
  groupData: GroupData | null,
  t: (key: string) => string
) => {
  const [showInviteModal, setShowInviteModal] = useState(false);

  const handleCopyInviteLink = async () => {
    if (!groupData?.inviteCode) return;
    const inviteLink = `${window.location.origin}/join/${groupData.inviteCode}`;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success(t('groupChat.inviteLinkCopied'));
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  const handleRegenerateInviteCode = async () => {
    if (!groupId) return;
    try {
      const { generateInviteCode } = await import('../../../Utils/inviteUtils');
      const newCode = generateInviteCode();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      
      await updateDoc(doc(db, 'groups', groupId), {
        inviteCode: newCode,
        inviteCodeExpiresAt: Timestamp.fromDate(expiresAt)
      });
      toast.success(t('groupChat.inviteCodeRegenerated'));
    } catch (err) {
      toast.error("Failed to regenerate code");
    }
  };

  return {
    showInviteModal,
    setShowInviteModal,
    handleCopyInviteLink,
    handleRegenerateInviteCode
  };
};
