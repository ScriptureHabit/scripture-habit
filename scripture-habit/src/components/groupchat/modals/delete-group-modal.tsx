import ReactMarkdown from 'react-markdown';
import { Group } from '../../../types/chat';

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
    if (!showDeleteModal) return null;

    return (
        <div className="leave-modal-overlay">
            <div className="leave-modal-content">
                <h3 className="delete-modal-title">{t('groupChat.deleteGroup')}?</h3>
                <p>{t('groupChat.deleteConfirmMessage')}</p>
                <div style={{ marginBottom: '1rem' }}>
                    {groupData && (
                        <ReactMarkdown components={{ p: ({ children }) => <span>{children}</span> }}>
                            {t('groupChat.typeToConfirm').replace('{groupName}', groupData.name || '')}
                        </ReactMarkdown>
                    )}
                </div>
                <input
                    type="text"
                    className="delete-confirmation-input"
                    value={deleteConfirmationName}
                    onChange={(e) => setDeleteConfirmationName(e.target.value)}
                    placeholder={t('groupChat.enterGroupNamePlaceholder')}
                />
                <div className="leave-modal-actions">
                    <button className="modal-btn cancel" onClick={() => { setShowDeleteModal(false); setDeleteConfirmationName(''); }} disabled={isDeleting}>
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
