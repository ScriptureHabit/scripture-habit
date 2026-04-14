import { FC, useState } from 'react';
import { UilTimes, UilCopy } from '@iconscout/react-unicons';
import Mascot from '../../mascot/mascot';
import ConfirmModal from '../../confirmmodal/confirm-modal';
import { Group } from '../../../types/chat';
import { UserData } from '../../../types/user';
import { parseTimestampToDate } from '../../../utils/timeUtils';

interface InviteModalProps {
    t: (key: string, replacements?: Record<string, string | number>) => string;
    language: string | null;
    userData: UserData | null;
    groupData: Group | null;
    showInviteModal: boolean;
    setShowInviteModal: (show: boolean) => void;
    handleCopyInviteLink: () => void;
    handleRegenerateInviteCode: () => Promise<void>;
}

const InviteModal: FC<InviteModalProps> = ({
    t,
    language,
    userData,
    groupData,
    showInviteModal,
    setShowInviteModal,
    handleCopyInviteLink,
    handleRegenerateInviteCode
}) => {
    const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

    const inviteLink = `${window.location.origin}/join/${groupData?.inviteCode}`;
    const formattedExpiry = groupData?.inviteCodeExpiresAt
        ? parseTimestampToDate(groupData.inviteCodeExpiresAt).toLocaleString(
            language === 'ja' ? 'ja-JP' : 'en-US',
            {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: 'numeric'
            }
          )
        : null;

    if (!showInviteModal) return null;

    return (
        <>
            <div className="leave-modal-overlay" onClick={() => setShowInviteModal(false)}>
                <div className="leave-modal-content invite-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                        <h3>{t('groupChat.inviteLink')}</h3>
                        <button className="close-menu-btn" onClick={() => setShowInviteModal(false)} aria-label={t('common.close') || 'Close'} data-testid="close-invite-modal">
                            <UilTimes size="24" />
                        </button>
                    </div>
                    <div className="invite-modal-body">
                        <Mascot customMessage={t('groupChat.inviteFriendsPrompt')} userData={userData} />
                        <div className="invite-link-card" onClick={handleCopyInviteLink}>
                            <div className="invite-link-content">
                                <span className="invite-link-url">{inviteLink}</span>
                            </div>
                            <div className="copy-badge">
                                <UilCopy size="18" />
                                <span>{t('groupChat.inviteLink')}</span>
                            </div>
                        </div>

                        {formattedExpiry && (
                            <p className="invite-expiry-text">
                                {t('groupChat.inviteExpiresAt') || 'Expires at'}: {formattedExpiry}
                            </p>
                        )}

                        <div className="invite-actions">
                            <button
                                className="regenerate-code-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowRegenerateConfirm(true);
                                }}
                            >
                                {t('groupChat.regenerateInviteCode') || 'Regenerate invite code'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <ConfirmModal
                isOpen={showRegenerateConfirm}
                title={t('groupChat.regenerateInviteCode') || 'Regenerate invite code'}
                description={t('groupChat.regenerateInviteConfirm') || 'Regenerate invite code? The old link will no longer work.'}
                confirmLabel={t('groupChat.regenerateInviteCode') || 'Regenerate invite code'}
                cancelLabel={t('common.cancel') || 'Cancel'}
                onConfirm={() => {
                    setShowRegenerateConfirm(false);
                    handleRegenerateInviteCode();
                }}
                onCancel={() => setShowRegenerateConfirm(false)}
            />
        </>
    );
};

export default InviteModal;
