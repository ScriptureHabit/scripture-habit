import axios from 'axios';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../../../utils/api-client';
import { toast } from 'react-toastify';
import { GroupData } from '../../../../types/chat';
import { UserData } from '../../../../types/user';

export const useGroupActions = (
  groupId: string,
  userData: UserData | null,
  groupData: GroupData | null,
  language: string,
  t: (key: string, replacements?: Record<string, string | number>) => string,
  onLeaveSuccess?: () => void,
  onDeleteSuccess?: () => void
) => {

  const [isLeaving, setIsLeaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const navigate = useNavigate();

  const handleLeaveGroup = async () => {
    if (!userData || isLeaving) return;
    
    setIsLeaving(true);
    try {
      await apiClient.post('/api/leave-group', { groupId });

      toast.success(t('groupChat.leftGroupSuccess') || 'You have left the group.');
      if (onLeaveSuccess) {
        onLeaveSuccess();
      } else {
        navigate(`/${language}/dashboard`, { replace: true });
      }

    } catch (err: unknown) {
      console.error('Error leaving group:', err);
      let errorMessage = t('groupChat.errorLeaveGroup') || 'Failed to leave group.';
      if (axios.isAxiosError(err)) {
        errorMessage = err.response?.data?.error || errorMessage;
      }
      toast.error(errorMessage);
    } finally {
      setIsLeaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await apiClient.post('/api/delete-group', { groupId });

      toast.success(t('groupChat.groupDeletedSuccess') || 'Group deleted successfully.');
      if (onDeleteSuccess) {
        onDeleteSuccess();
      } else {
        navigate(`/${language}/dashboard`, { replace: true });
      }

    } catch (err: unknown) {
      console.error("Error deleting group:", err);
      let errorMessage = t('groupChat.errorDeleteGroup') || "Failed to delete group.";
      if (axios.isAxiosError(err)) {
        errorMessage = err.response?.data?.error || errorMessage;
      }
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const togglePublicStatus = async () => {
    if (!groupData) return;
    try {
      await apiClient.post('/api/update-group', { 
        groupId, 
        isPublic: !groupData.isPublic 
      });

      toast.success(groupData.isPublic ? t('groupChat.markedPrivate') : t('groupChat.markedPublic'));
    } catch (err: unknown) {
      console.error("Error toggling public status:", err);
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
      const payload: { 
        groupId: string; 
        name?: string; 
        description?: string; 
        translations?: Record<string, { name?: string; description?: string }> 
      } = { groupId };
      if (newName !== undefined) payload.name = newName;
      if (newDesc !== undefined) payload.description = newDesc;

      if (newTransName || newTransDesc) {
        payload.translations = {
          [language]: {
            ...(newTransName ? { name: newTransName } : {}),
            ...(newTransDesc ? { description: newTransDesc } : {})
          }
        };
      }

      await apiClient.post('/api/update-group', payload);

      toast.success(t('groupChat.groupNameChanged') || "Group info updated!");
      return true;
    } catch (err: unknown) {
      console.error("Error updating group name:", err);
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
