import { FC } from 'react';

interface LeaveGroupModalProps {
    t: (key: string) => string;
    showLeaveModal: boolean;
    setShowLeaveModal: (show: boolean) => void;
    isLeaving: boolean;
    handleLeaveGroup: () => Promise<void>;
}

const LeaveGroupModal: FC<LeaveGroupModalProps> = ({
    t,
    showLeaveModal,
    setShowLeaveModal,
    isLeaving,
    handleLeaveGroup,
}) => {
    if (!showLeaveModal) return null;

    return (
        <div className="leave-modal-overlay">
            <div className="leave-modal-content">
                <h3>{t('groupChat.leaveGroup')}?</h3>
                <p>{t('groupChat.leaveConfirmMessage')}</p>
                <div className="leave-modal-actions">
                    <button className="modal-btn cancel" onClick={() => setShowLeaveModal(false)} disabled={isLeaving}>
                        {t('groupChat.cancel')}
                    </button>
                    <button className="modal-btn leave" onClick={handleLeaveGroup} disabled={isLeaving}>
                        {isLeaving ? '...' : t('groupChat.confirmLeave')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LeaveGroupModal;
