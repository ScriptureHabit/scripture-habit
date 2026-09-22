
import { useRef } from 'react';
import { useModalA11y } from '../../../hooks/use-modal-a11y';

interface Reaction {
    userId: string;
    nickname: string;
}

interface ReactionsModalProps {
    t: (key: string) => string;
    showReactionsModal: boolean;
    setShowReactionsModal: (show: boolean) => void;
    reactionsToShow: Reaction[];
    handleUserProfileClick: (userId: string | null) => Promise<void>;
}

const ReactionsModal = ({
    t,
    showReactionsModal,
    setShowReactionsModal,
    reactionsToShow,
    handleUserProfileClick,
}: ReactionsModalProps) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const cancelBtnRef = useRef<HTMLButtonElement>(null);

    const handleClose = () => setShowReactionsModal(false);

    useModalA11y({
        isOpen: showReactionsModal,
        onClose: handleClose,
        containerRef: modalRef,
        initialFocusRef: cancelBtnRef,
    });

    if (!showReactionsModal) return null;

    return (
        <div className="leave-modal-overlay" onClick={handleClose}>
            <div
                ref={modalRef}
                className="leave-modal-content reactions-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="reactions-modal-title"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 id="reactions-modal-title">👍 Reactions</h3>
                <div className="reactions-list">
                    {reactionsToShow.map((reaction, idx) => (
                        <button
                            key={idx}
                            type="button"
                            className="reaction-user"
                            style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%', cursor: 'pointer' }}
                            onClick={() => {
                                handleUserProfileClick(reaction.userId);
                                setShowReactionsModal(false);
                            }}
                        >
                            <span className="reaction-user-emoji">👍</span>
                            <span className="reaction-user-name">{reaction.nickname}</span>
                        </button>
                    ))}
                </div>
                <div className="leave-modal-actions">
                    <button ref={cancelBtnRef} className="modal-btn cancel" onClick={handleClose}>
                        {t('groupChat.cancel')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReactionsModal;
