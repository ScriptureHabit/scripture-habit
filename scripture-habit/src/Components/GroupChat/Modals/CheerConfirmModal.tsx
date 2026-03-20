import { FC } from 'react';
import { UserProfileBrief } from '../../../types/chat';

interface CheerConfirmModalProps {
    t: (key: string) => string;
    cheerTarget: UserProfileBrief | null;
    setCheerTarget: (target: UserProfileBrief | null) => void;
    isSendingCheer: boolean;
    handleSendCheer: () => Promise<void>;
}

const CheerConfirmModal: FC<CheerConfirmModalProps> = ({
    t,
    cheerTarget,
    setCheerTarget,
    isSendingCheer,
    handleSendCheer,
}) => {
    if (!cheerTarget) return null;

    return (
        <div className="leave-modal-overlay cheer-modal-overlay" onClick={() => setCheerTarget(null)}>
            <div className="leave-modal-content cheer-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '360px', padding: '2rem' }}>
                <div style={{ marginBottom: '1rem', textAlign: 'center' }}></div>
                <h3 style={{ textAlign: 'center', marginBottom: '1rem', color: 'var(--black)' }}>{t('groupChat.cheerConfirmTitle') || "Send a Cheer"}</h3>
                <p style={{ textAlign: 'center', color: 'var(--gray)', marginBottom: '2rem', lineHeight: '1.4', fontSize: '1rem' }}>
                    {t('groupChat.cheerConfirmMessage')?.replace('{nickname}', cheerTarget.nickname || '') || `Would you like to send a cheer to ${cheerTarget.nickname || ''}?`}
                </p>
                <div className="leave-modal-actions" style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                    <button
                        className="modal-btn delete"
                        onClick={handleSendCheer}
                        disabled={isSendingCheer}
                        style={{
                            background: 'var(--pink)',
                            color: 'white',
                            width: '100%',
                            padding: '14px',
                            borderRadius: '12px',
                            fontWeight: '600',
                            fontSize: '1.05rem',
                            border: 'none',
                            cursor: isSendingCheer ? 'not-allowed' : 'pointer',
                            boxShadow: '0 4px 12px rgba(255, 145, 157, 0.3)'
                        }}
                    >
                        {isSendingCheer ? (
                            <div className="spinner-mini" style={{ width: '20px', height: '20px', margin: '0 auto', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white' }}></div>
                        ) : (t('groupChat.cheerConfirmButton') || "Send Cheer")}
                    </button>
                    <button
                        className="modal-btn cancel"
                        onClick={() => setCheerTarget(null)}
                        style={{
                            width: '100%',
                            padding: '14px',
                            borderRadius: '12px',
                            border: '1px solid #ddd',
                            background: 'white',
                            color: 'var(--gray)',
                            fontWeight: '500',
                            cursor: 'pointer'
                        }}
                    >
                        {t('profile.cancel') || "Cancel"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CheerConfirmModal;
