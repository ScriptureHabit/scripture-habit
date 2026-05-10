
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, appCheck } from '../../firebase';
import { getToken } from 'firebase/app-check';
import { toast } from 'react-toastify';
import { useLanguage } from '../../hooks/use-language';
import ConfirmModal from '../confirmmodal/confirm-modal';

interface DeleteGroupButtonProps {
  groupId: string;
  ownerUserId: string;
}

export default function DeleteGroupButton({ groupId, ownerUserId }: DeleteGroupButtonProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    const user = auth?.currentUser;
    if (!user || user.uid !== ownerUserId) {
      return toast.error(t('groupChat.errorOnlyOwnerDelete') || 'Only the group owner can delete this group');
    }

    try {
      const idToken = await user.getIdToken();
      let appCheckToken = '';
      if (appCheck) {
        try {
          const appCheckTokenResponse = await getToken(appCheck, false);
          appCheckToken = appCheckTokenResponse.token;
        } catch (e) {
          console.warn('[DeleteGroupButton] AppCheck token failed:', e);
        }
      }

      const response = await fetch('/api/groups/delete-group', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
          ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {})
        },
        body: JSON.stringify({ groupId })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      toast.success(t('groupChat.groupDeletedSuccess') || 'Group deleted successfully');
      navigate('/dashboard');

    } catch (err: unknown) {
      console.error(err);
      const error = err as Error;
      toast.error(`${t('groupChat.errorDeleteGroup') || 'Failed to delete group'}: ${error.message}`);
    }
  };

  return (
    <>
      <button onClick={() => setShowConfirm(true)} className="btn btn-danger">
        {t('groupChat.deleteGroup')}
      </button>
      <ConfirmModal
        isOpen={showConfirm}
        title={t('groupChat.deleteGroup')}
        description={t('groupChat.deleteMessageConfirm') || 'Are you sure you want to delete this group?'}
        confirmLabel={t('groupChat.deleteGroup')}
        cancelLabel={t('common.cancel') || 'Cancel'}
        onConfirm={() => {
          setShowConfirm(false);
          handleDelete();
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}


