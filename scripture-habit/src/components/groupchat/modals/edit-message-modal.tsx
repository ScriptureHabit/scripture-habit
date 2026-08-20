import { Message } from '../../../types/chat';

interface EditMessageModalProps {
    t: (key: string) => string;
    editingMessage: Message | null;
    editText: string;
    setEditText: (text: string) => void;
    handleCancelEdit: () => void;
    handleSaveEdit: () => Promise<void>;
}

const EditMessageModal = ({
    t,
    editingMessage,
    editText,
    setEditText,
    handleCancelEdit,
    handleSaveEdit,
}: EditMessageModalProps) => {
    if (!editingMessage) return null;

    return (
        <div className="leave-modal-overlay">
            <div className="leave-modal-content edit-message-modal">
                <h3>{t('groupChat.editMessage')}</h3>
                <textarea
                    id="edit-message-text"
                    name="editText"
                    className="edit-message-textarea"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    autoFocus
                />
                <div className="leave-modal-actions">
                    <button className="modal-btn cancel" onClick={handleCancelEdit}>
                        {t('groupChat.cancel')}
                    </button>
                    <button className="modal-btn leave" onClick={handleSaveEdit} style={{ background: 'var(--pink)' }}>
                        {t('groupChat.editMessage')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditMessageModal;
