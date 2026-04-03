import { useState } from 'react';
import { getToken } from 'firebase/app-check'; // Added AppCheck getToken
import { useNavigate } from 'react-router-dom';
import { auth, appCheck } from '../../firebase'; // Added appCheck
import { toast } from 'react-toastify';
import { useLanguage } from '../../context/LanguageContext';
import { Capacitor } from '@capacitor/core';
import ConfirmModal from '../confirmmodal/ConfirmModal';

interface LeaveGroupButtonProps {
  groupId: string;
}

export default function LeaveGroupButton({ groupId }: LeaveGroupButtonProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const API_BASE = Capacitor.isNativePlatform() ? 'https://scripturehabit.app' : '';
  const [showConfirm, setShowConfirm] = useState(false);

  const handleLeave = async () => {
    const user = auth?.currentUser;
    if (!user) return toast.info(t('login.emailLabel') || 'Not logged in');

    try {
      const idToken = await user.getIdToken();
      const appCheckTokenResponse = await getToken(appCheck, false); // Get AppCheck token
      const appCheckToken = appCheckTokenResponse.token;

      const response = await fetch(`${API_BASE}/api/leave-group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
          'X-Firebase-AppCheck': appCheckToken // Add AppCheck header
        },
        body: JSON.stringify({ groupId })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed to leave group');
      }

      toast.success(t('groupChat.leftGroupSuccess') || 'You have left the group');
      navigate('/dashboard');
    } catch (err: unknown) {
      console.error(err);
      toast.error(t('groupChat.errorLeaveGroup') || 'Failed to leave group');
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
