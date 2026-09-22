import { useRef } from 'react';
import LazyMarkdown from '../../common/lazy-markdown';
import { Group } from '../../../types/chat';
import { useModalA11y } from '../../../hooks/use-modal-a11y';

interface DeleteGroupModalProps {
    t: (key: string) => string;
    groupData: Group | null;
    showDeleteModal: boolean;
    setShowDeleteModal: (show: boolean) => void;
    deleteConfirmationName: string;
    setDeleteConfirmationName: (name: string) => void;
    isDeleting: boolean;
    handleDeleteGroup: () => Promise<void>;
}

const DeleteGroupModal = ({
    t,
    groupData,
    showDeleteModal,
    setShowDeleteModal,
    deleteConfirmationName,
    setDeleteConfirmationName,
    isDeleting,
    handleDeleteGroup,
}: DeleteGroupModalProps) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const cancelBtnRef = useRef<HTMLButtonElement>(null);

    const handleClose = () => {
        if (!isDeleting) {
            setShowDeleteModal(false);
            setDeleteConfirmationName('');
        }
    };

    useModalA11y({
        isOpen: showDeleteModal,
        onClose: handleClose,
        containerRef: modalRef,
        initialFocusRef: cancelBtnRef,
    });

    if (!showDeleteModal) return null;

    return (
        <div className="leave-modal-overlay">
            <div
                ref={modalRef}
                className="leave-modal-content"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="delete-group-modal-title"
            >
                <h3 id="delete-group-modal-title" className="delete-modal-title">{t('groupChat.deleteGroup')}?</h3>
                <p>{t('groupChat.deleteConfirmMessage')}</p>
                <div style={{ marginBottom: '1rem' }}>
                    {groupData && (
                        <LazyMarkdown components={{ p: ({ children }) => <span>{children}</span> }}>
                            {t('groupChat.typeToConfirm').replace('{groupName}', groupData.name || '')}
                        </LazyMarkdown>
                    )}
                </div>
                <label htmlFor="delete-group-confirm-name" className="sr-only">
                    {t('groupChat.enterGroupNamePlaceholder')}
                </label>
                <input
                    id="delete-group-confirm-name"
                    name="deleteConfirmationName"
                    type="text"
                    className="delete-confirmation-input"
                    value={deleteConfirmationName}
                    onChange={(e) => setDeleteConfirmationName(e.target.value)}
                    placeholder={t('groupChat.enterGroupNamePlaceholder')}
                    aria-label={t('groupChat.enterGroupNamePlaceholder')}
                />
                <div className="leave-modal-actions">
                    <button
                        ref={cancelBtnRef}
                        className="modal-btn cancel"
                        onClick={handleClose}
                        disabled={isDeleting}
                    >
                        {t('groupChat.cancel')}
                    </button>
                    <button
                        className="modal-btn leave"
                        onClick={handleDeleteGroup}
                        disabled={deleteConfirmationName !== (groupData?.name || '') || isDeleting}
                    >
                        {isDeleting ? '...' : t('groupChat.confirmDelete')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteGroupModal;
