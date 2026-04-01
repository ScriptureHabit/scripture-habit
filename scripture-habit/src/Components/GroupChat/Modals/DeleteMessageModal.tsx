import { FC } from 'react';
import { Message } from '../../../types/chat';

interface DeleteMessageModalProps {
    t: (key: string) => string;
    showDeleteMessageModal: boolean;
    setShowDeleteMessageModal: (show: boolean) => void;
    messageToDelete: Message | null;
    setMessageToDelete: (msg: Message | null) => void;
    handleConfirmDeleteMessage: () => Promise<void>;
}

const DeleteMessageModal: FC<DeleteMessageModalProps> = ({
    t,
    showDeleteMessageModal,
    setShowDeleteMessageModal,
    messageToDelete,
    setMessageToDelete,
    handleConfirmDeleteMessage,
}) => {
    if (!showDeleteMessageModal) return null;

    return (
        <div className="leave-modal-overlay">
            <div className="leave-modal-content small-modal-content">
                <h3>{t('groupChat.deleteMessageConfirm')}</h3>
                {(messageToDelete?.isNote || messageToDelete?.isEntry) && messageToDelete?.originalNoteId && (
                    <p className="modal-warning-text">
                        ⚠️ {t('groupChat.deleteMessageWarning')}
                    </p>
                )}
                <div className="leave-modal-actions">
                    <button className="modal-btn cancel" onClick={() => { setShowDeleteMessageModal(false); setMessageToDelete(null); }}>
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
