import { FC } from 'react';
import { UilTimes, UilCopy } from '@iconscout/react-unicons';
import Mascot from '../../Mascot/Mascot';
import { Group } from '../../../types/chat';
import { UserData } from '../../../types/user';

interface InviteModalProps {
    t: (key: string, replacements?: any) => string;
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
    if (!showInviteModal) return null;

    return (
        <div className="leave-modal-overlay" onClick={() => setShowInviteModal(false)}>
            <div className="leave-modal-content invite-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{t('groupChat.inviteLink')}</h3>
                    <button className="close-menu-btn" onClick={() => setShowInviteModal(false)}>
                        <UilTimes size="24" />
                    </button>
                </div>
                <div className="invite-modal-body">
                    <Mascot customMessage={t('groupChat.inviteFriendsPrompt')} userData={userData as any} />
                    <div className="invite-link-card" onClick={handleCopyInviteLink}>
                        <div className="invite-link-content">
                            <span className="invite-link-url">{window.location.origin}/join/{groupData?.inviteCode}</span>
                        </div>
                        <div className="copy-badge">
                            <UilCopy size="18" />
                            <span>{t('groupChat.inviteLink')}</span>
                        </div>
                    </div>

                    {groupData?.inviteCodeExpiresAt && (
                        <p className="invite-expiry-text" style={{ fontSize: '0.8rem', color: 'var(--gray)', marginTop: '0.8rem', textAlign: 'center', opacity: 0.8 }}>
                            {t('groupChat.inviteExpiresAt') || 'Expires at'}: {(() => {
                                const date = groupData.inviteCodeExpiresAt.toDate ? groupData.inviteCodeExpiresAt.toDate() : new Date(groupData.inviteCodeExpiresAt);
                                return date.toLocaleString(language === 'ja' ? 'ja-JP' : 'en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: 'numeric',
                                    minute: 'numeric'
                                });
                            })()}
                        </p>
                    )}

                    <div className="invite-actions" style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <button
                            className="regenerate-code-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(t('groupChat.regenerateInviteConfirm') || "Regenerate invite code? The old link will no longer work.")) {
                                    handleRegenerateInviteCode();
                                }
                            }}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--gray)',
                                fontSize: '0.85rem',
                                textDecoration: 'underline',
                                cursor: 'pointer',
                                opacity: 0.7
                            }}
                        >
                            {t('groupChat.regenerateInviteCode') || "Regenerate invite code"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InviteModal;
