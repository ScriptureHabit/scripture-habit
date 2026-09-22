import { useRef } from 'react';
import { Message } from '../../../types/chat';
import { useModalA11y } from '../../../hooks/use-modal-a11y';

interface DeleteMessageModalProps {
    t: (key: string) => string;
    showDeleteMessageModal: boolean;
    setShowDeleteMessageModal: (show: boolean) => void;
    messageToDelete: Message | null;
    setMessageToDelete: (msg: Message | null) => void;
    handleConfirmDeleteMessage: () => Promise<void>;
}

const DeleteMessageModal = ({
    t,
    showDeleteMessageModal,
    setShowDeleteMessageModal,
    messageToDelete,
    setMessageToDelete,
    handleConfirmDeleteMessage,
}: DeleteMessageModalProps) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const cancelBtnRef = useRef<HTMLButtonElement>(null);

    const handleClose = () => {
        setShowDeleteMessageModal(false);
        setMessageToDelete(null);
    };

    useModalA11y({
        isOpen: showDeleteMessageModal,
        onClose: handleClose,
        containerRef: modalRef,
        initialFocusRef: cancelBtnRef,
    });

    if (!showDeleteMessageModal) return null;

    return (
        <div className="leave-modal-overlay">
            <div
                ref={modalRef}
                className="leave-modal-content small-modal-content"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="delete-message-modal-title"
            >
                <h3 id="delete-message-modal-title">{t('groupChat.deleteMessageConfirm')}</h3>
                {(messageToDelete?.isNote || messageToDelete?.isEntry) && messageToDelete?.originalNoteId && (
                    <p className="modal-warning-text">
                        ⚠️ {t('groupChat.deleteMessageWarning')}
                    </p>
                )}
                <div className="leave-modal-actions">
                    <button
                        ref={cancelBtnRef}
                        className="modal-btn cancel"
                        onClick={handleClose}
                    >
                        {t('groupChat.cancel')}
                    </button>
                    <button className="modal-btn leave" onClick={handleConfirmDeleteMessage}>
                        {t('groupChat.deleteMessage')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteMessageModal;
