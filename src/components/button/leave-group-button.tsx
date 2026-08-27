import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useLanguage } from '../../hooks/use-language';
import ConfirmModal from '../confirmmodal/confirm-modal';
import apiClient from '../../utils/api-client';
import { getApiErrorMessage } from '../../utils/api-error-parser';

interface LeaveGroupButtonProps {
  groupId: string;
}

export default function LeaveGroupButton({ groupId }: LeaveGroupButtonProps) {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleLeave = async () => {
    try {
      await apiClient.post('/api/groups/leave-group', { groupId });

      toast.success(t('groupChat.leftGroupSuccess') || 'You have left the group');
      navigate(`/${language}/dashboard`);
    } catch (err: unknown) {
      console.error(err);
      const message = getApiErrorMessage(err, 'groupChat.errorLeaveGroup', t);
      toast.error(message);
    }
  };

  return (
    <>
      <button onClick={() => setShowConfirm(true)} className="btn btn-warning">
        {t('groupChat.leaveGroup')}
      </button>
      <ConfirmModal
        isOpen={showConfirm}
        title={t('groupChat.leaveGroup')}
        description={t('groupChat.leaveConfirmMessage') || 'Are you sure you want to leave this group?'}
        confirmLabel={t('groupChat.leaveGroup')}
        cancelLabel={t('common.cancel') || 'Cancel'}
        onConfirm={() => {
          setShowConfirm(false);
          handleLeave();
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
