import { useState } from 'react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { GroupData } from '../../../types/chat';

export const useGroupActions = (
  groupId: string,
  userData: any,
  groupData: GroupData | null,
  language: string,
  t: (key: string, replacements?: any) => string
) => {
  const navigate = useNavigate();
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleLeaveGroup = async () => {
    if (!userData || isLeaving) return;
    
    setIsLeaving(true);
    try {
      const idToken = await auth?.currentUser?.getIdToken();
      if (!idToken) throw new Error("No idToken");

      const API_BASE = Capacitor.isNativePlatform() ? 'https://scripturehabit.app' : '';
      const response = await fetch(`${API_BASE}/api/leave-group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ groupId })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to leave group');
      }

      toast.success(t('groupChat.leftGroupSuccess') || "You have left the group.");
      window.location.href = `/${language}/dashboard`;
    } catch (error) {
      console.error("Error leaving group:", error);
      toast.error(t('groupChat.errorLeaveGroup') || "Failed to leave group.");
    } finally {
      setIsLeaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'groups', groupId));
      toast.success(t('groupChat.groupDeletedSuccess') || "Group deleted successfully.");
      navigate(`/${language}/dashboard`);
    } catch (error) {
      console.error("Error deleting group:", error);
      toast.error(t('groupChat.errorDeleteGroup') || "Failed to delete group.");
    } finally {
      setIsDeleting(false);
    }
  };

  const togglePublicStatus = async () => {
    if (!groupData) return;
    try {
      const groupRef = doc(db, 'groups', groupId);
      await updateDoc(groupRef, {
        isPublic: !groupData.isPublic
      });
      toast.success(groupData.isPublic ? t('groupChat.markedPrivate') : t('groupChat.markedPublic'));
    } catch (error) {
      console.error("Error toggling public status:", error);
      toast.error(t('groupChat.errorUpdateGroupStatus'));
    }
  };

  const handleUpdateGroupName = async (
    newName: string, 
    newDesc: string, 
    newTransName: string, 
    newTransDesc: string
  ) => {
    try {
      const groupRef = doc(db, 'groups', groupId);
      const payload: any = {
        name: newName,
        description: newDesc
      };

      if (newTransName || newTransDesc) {
        if (newTransName) payload[`translations.${language}.name`] = newTransName;
        if (newTransDesc) payload[`translations.${language}.description`] = newTransDesc;
      }

      await updateDoc(groupRef, payload);
      toast.success(t('groupChat.groupNameChanged') || "Group info updated!");
      return true;
    } catch (error) {
      console.error("Error updating group name:", error);
      toast.error(t('groupChat.errorChangeGroupName') || "Failed to update group info.");
      return false;
    }
  };

  const handleShareLine = () => {
    const inviteLink = `${window.location.origin}/${language}/join/${groupData?.inviteCode}`;
    window.open(`https://line.me/R/msg/text/?${encodeURIComponent(t('groupChat.inviteMessage', { groupName: groupData?.name || '', inviteLink }))}`, '_blank');
  };

  const handleShareWhatsApp = () => {
    const inviteLink = `${window.location.origin}/${language}/join/${groupData?.inviteCode}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(t('groupChat.inviteMessage', { groupName: groupData?.name || '', inviteLink }))}`, '_blank');
  };

  const handleShareMessenger = () => {
    const inviteLink = `${window.location.origin}/join/${groupData?.inviteCode}`;
    window.open(`fb-messenger://share?link=${encodeURIComponent(inviteLink)}`, '_blank');
  };

  const handleShareInstagram = () => {
    const inviteLink = `${window.location.origin}/join/${groupData?.inviteCode}`;
    navigator.clipboard.writeText(inviteLink).then(() => {
      toast.info(t('groupChat.linkCopiedForInstagram'));
      window.open('https://www.instagram.com/', '_blank');
    });
  };

  return {
    isLeaving,
    isDeleting,
    handleLeaveGroup,
    handleDeleteGroup,
    togglePublicStatus,
    handleUpdateGroupName,
    handleShareLine,
    handleShareWhatsApp,
    handleShareMessenger,
    handleShareInstagram
  };
};
