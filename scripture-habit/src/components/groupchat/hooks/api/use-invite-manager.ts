import { useState } from 'react';
import { auth, appCheck } from '../../../../firebase';
import { getToken } from 'firebase/app-check';
import { toast } from 'react-toastify';
import { GroupData } from '../../../../types/chat';

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
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleRegenerateInviteCode = async () => {
    if (!groupId) return;
    try {
      const user = auth?.currentUser;
      if (!user) throw new Error('No user logged in');

      const idToken = await user.getIdToken();
      let appCheckToken = '';
      if (appCheck) {
        try {
          const appCheckTokenResponse = await getToken(appCheck, false);
          appCheckToken = appCheckTokenResponse.token;
        } catch (e) {
          console.warn('[useInviteManager] AppCheck token failed:', e);
        }
      }

      const response = await fetch('/api/groups/regenerate-invite-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
          ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {})
        },
        body: JSON.stringify({ groupId })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to regenerate invite code');
      }

      toast.success(t('groupChat.inviteCodeRegenerated'));
    } catch (err) {
      console.error('Failed to regenerate invite code:', err);
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
