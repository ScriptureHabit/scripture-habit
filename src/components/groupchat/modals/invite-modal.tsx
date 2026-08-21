import { useState } from 'react';
import { UilTimes, UilCopy } from '@iconscout/react-unicons';
import Mascot from '../../mascot/mascot';
import ConfirmModal from '../../confirmmodal/confirm-modal';
import { Group } from '../../../types/chat';
import { UserData } from '../../../types/user';
import { formatInviteLink } from '../../../utils/invite-utils';

interface InviteModalProps {
    t: (key: string, replacements?: Record<string, string | number>) => string;
    language?: string | null;
    userData: UserData | null;
    groupData: Group | null;
    showInviteModal: boolean;
    setShowInviteModal: (show: boolean) => void;
    handleCopyInviteLink: () => void;
    handleRegenerateInviteCode: () => Promise<void>;
}

const InviteModal = ({
    t,
    userData,
    groupData,
    showInviteModal,
    setShowInviteModal,
    handleCopyInviteLink,
    handleRegenerateInviteCode
}: InviteModalProps) => {
    const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

    const inviteLink = formatInviteLink(groupData?.inviteCode || '');

    if (!showInviteModal || groupData?.isAiGroup) return null;

    return (
        <>
            <div className="leave-modal-overlay" onClick={() => setShowInviteModal(false)}>
                <div className="leave-modal-content invite-modal" data-testid="invite-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                        <h3>{t('groupChat.inviteLink')}</h3>
                        <button className="close-menu-btn" onClick={() => setShowInviteModal(false)} aria-label={t('common.close')} data-testid="close-invite-modal">
                            <UilTimes size="24" />
                        </button>
                    </div>
                    <div className="invite-modal-body">
                        <Mascot customMessage={t('groupChat.inviteFriendsPrompt')} userData={userData} />

                        <div className="invite-link-card" onClick={handleCopyInviteLink}>
                            <div className="invite-link-content">
                                <span className="invite-link-url" data-testid="invite-link-url">{inviteLink}</span>
                            </div>
                            <div className="copy-badge">
                                <UilCopy size="18" />
                                <span>{t('groupChat.inviteLink')}</span>
                            </div>
                        </div>

                        <p className="invite-expiry-text permanent">
                            ✨ {t('groupChat.inviteNoExpiration')}
                        </p>

                        <div className="invite-actions">
                            <button
                                className="regenerate-code-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowRegenerateConfirm(true);
                                }}
                            >
                                {t('groupChat.regenerateInviteCode')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <ConfirmModal
                isOpen={showRegenerateConfirm}
                title={t('groupChat.regenerateInviteCode')}
                description={t('groupChat.regenerateInviteConfirm')}
                confirmLabel={t('groupChat.regenerateInviteCode')}
                cancelLabel={t('common.cancel')}
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
