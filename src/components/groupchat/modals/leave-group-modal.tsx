import { useRef } from 'react';
import { useModalA11y } from '../../../hooks/use-modal-a11y';

interface LeaveGroupModalProps {
    t: (key: string) => string;
    showLeaveModal: boolean;
    setShowLeaveModal: (show: boolean) => void;
    isLeaving: boolean;
    handleLeaveGroup: () => Promise<void>;
}

const LeaveGroupModal = ({
    t,
    showLeaveModal,
    setShowLeaveModal,
    isLeaving,
    handleLeaveGroup,
}: LeaveGroupModalProps) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const cancelBtnRef = useRef<HTMLButtonElement>(null);

    useModalA11y({
        isOpen: showLeaveModal,
        onClose: () => {
            if (!isLeaving) setShowLeaveModal(false);
        },
        containerRef: modalRef,
        initialFocusRef: cancelBtnRef
    });

    if (!showLeaveModal) return null;

    return (
        <div className="leave-modal-overlay" onClick={() => !isLeaving && setShowLeaveModal(false)}>
            <div 
                ref={modalRef}
                className="leave-modal-content"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="leave-group-title"
                aria-describedby="leave-group-desc"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 id="leave-group-title">{t('groupChat.leaveGroup')}?</h3>
                <p id="leave-group-desc">{t('groupChat.leaveConfirmMessage')}</p>
                <div className="leave-modal-actions">
                    <button 
                        ref={cancelBtnRef}
                        className="modal-btn cancel" 
                        onClick={() => setShowLeaveModal(false)} 
                        disabled={isLeaving}
                    >
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
