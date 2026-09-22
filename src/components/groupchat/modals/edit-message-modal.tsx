import { useRef } from 'react';
import { Message } from '../../../types/chat';
import { useModalA11y } from '../../../hooks/use-modal-a11y';

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
    const modalRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useModalA11y({
        isOpen: Boolean(editingMessage),
        onClose: handleCancelEdit,
        containerRef: modalRef,
        initialFocusRef: textareaRef,
    });

    if (!editingMessage) return null;

    return (
        <div className="leave-modal-overlay">
            <div
                ref={modalRef}
                className="leave-modal-content edit-message-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="edit-message-modal-title"
            >
                <h3 id="edit-message-modal-title">{t('groupChat.editMessage')}</h3>
                <label htmlFor="edit-message-text" className="sr-only">
                    {t('groupChat.editMessage')}
                </label>
                <textarea
                    ref={textareaRef}
                    id="edit-message-text"
                    name="editText"
                    className="edit-message-textarea"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
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
