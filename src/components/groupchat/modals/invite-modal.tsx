import { useState, useRef } from 'react';
import { UilTimes, UilCopy } from '@iconscout/react-unicons';
import Mascot from '../../mascot/mascot';
import ConfirmModal from '../../confirmmodal/confirm-modal';
import { Group } from '../../../types/chat';
import { UserData } from '../../../types/user';
import { formatInviteLink } from '../../../utils/invite-utils';
import { useModalA11y } from '../../../hooks/use-modal-a11y';

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
    const modalRef = useRef<HTMLDivElement>(null);
    const closeBtnRef = useRef<HTMLButtonElement>(null);

    const handleClose = () => setShowInviteModal(false);

    useModalA11y({
        isOpen: Boolean(showInviteModal && !groupData?.isAiGroup),
        onClose: handleClose,
        containerRef: modalRef,
        initialFocusRef: closeBtnRef,
    });

    const inviteLink = formatInviteLink(groupData?.inviteCode || '');

    if (!showInviteModal || groupData?.isAiGroup) return null;

    return (
        <>
            <div className="leave-modal-overlay" onClick={handleClose}>
                <div
                    ref={modalRef}
                    className="leave-modal-content invite-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="invite-modal-title"
                    data-testid="invite-modal"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="modal-header">
                        <h3 id="invite-modal-title">{t('groupChat.inviteLink')}</h3>
                        <button
                            ref={closeBtnRef}
                            className="close-menu-btn"
                            onClick={handleClose}
                            aria-label={t('common.close')}
                            data-testid="close-invite-modal"
                        >
                            <UilTimes size="24" />
                        </button>
                    </div>
                    <div className="invite-modal-body">
                        <Mascot customMessage={t('groupChat.inviteFriendsPrompt')} userData={userData} />

                        <button
                            type="button"
                            className="invite-link-card"
                            onClick={handleCopyInviteLink}
                            aria-label={t('groupChat.inviteLink')}
                            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'inherit', cursor: 'pointer', padding: 0 }}
                        >
                            <div className="invite-link-content">
                                <span className="invite-link-url" data-testid="invite-link-url">{inviteLink}</span>
                            </div>
                            <div className="copy-badge">
                                <UilCopy size="18" />
                                <span>{t('groupChat.inviteLink')}</span>
                            </div>
                        </button>

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
