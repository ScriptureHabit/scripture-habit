import { useRef } from 'react';
import { Group } from '../../../types/chat';
import { useModalA11y } from '../../../hooks/use-modal-a11y';

interface EditGroupNameModalProps {
    t: (key: string) => string;
    language: string | null;
    groupData: Group | null;
    showEditNameModal: boolean;
    setShowEditNameModal: (show: boolean) => void;
    newGroupName: string;
    setNewGroupName: (name: string) => void;
    newGroupDescription: string;
    setNewGroupDescription: (desc: string) => void;
    newTranslatedName: string;
    setNewTranslatedName: (name: string) => void;
    newTranslatedDesc: string;
    setNewTranslatedDesc: (desc: string) => void;
    handleUpdateGroupName: () => Promise<void>;
    translatedGroupName: string | null;
    translatedGroupDesc: string | null;
}

const EditGroupNameModal = ({
    t,
    language,
    groupData,
    showEditNameModal,
    setShowEditNameModal,
    newGroupName,
    setNewGroupName,
    newGroupDescription,
    setNewGroupDescription,
    newTranslatedName,
    setNewTranslatedName,
    newTranslatedDesc,
    setNewTranslatedDesc,
    handleUpdateGroupName,
    translatedGroupName,
    translatedGroupDesc,
}: EditGroupNameModalProps) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const cancelBtnRef = useRef<HTMLButtonElement>(null);

    const handleClose = () => {
        setShowEditNameModal(false);
        setNewGroupName('');
        setNewGroupDescription('');
        setNewTranslatedName('');
        setNewTranslatedDesc('');
    };

    useModalA11y({
        isOpen: showEditNameModal,
        onClose: handleClose,
        containerRef: modalRef,
        initialFocusRef: cancelBtnRef,
    });

    if (!showEditNameModal) return null;

    const displayGroupName = newGroupName?.startsWith('groupChat.') ? t(newGroupName) : newGroupName;
    const displayGroupDesc = newGroupDescription?.startsWith('groupChat.') ? t(newGroupDescription) : newGroupDescription;

    return (
        <div className="leave-modal-overlay">
            <div
                ref={modalRef}
                className="leave-modal-content edit-group-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="edit-group-name-modal-title"
            >
                <h3 id="edit-group-name-modal-title">{t('groupChat.changeGroupName')}</h3>

                <div className="edit-group-field" style={{ width: '100%', textAlign: 'left', marginTop: '1rem' }}>
                    <label htmlFor="edit-group-name" style={{ fontSize: '0.8rem', color: 'var(--gray)', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>
                        {t('groupForm.groupNameLabel')}
                    </label>
                    <input
                        id="edit-group-name"
                        name="groupName"
                        type="text"
                        className="delete-confirmation-input"
                        value={displayGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder={t('groupChat.enterNewGroupName')}
                        style={{ marginBottom: '1rem' }}
                    />
                </div>

                <div className="edit-group-field" style={{ width: '100%', textAlign: 'left' }}>
                    <label htmlFor="edit-group-desc" style={{ fontSize: '0.8rem', color: 'var(--gray)', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>
                        {t('groupForm.descriptionLabel')}
                    </label>
                    <textarea
                        id="edit-group-desc"
                        name="groupDescription"
                        className="delete-confirmation-input"
                        value={displayGroupDesc}
                        onChange={(e) => setNewGroupDescription(e.target.value)}
                        placeholder={t('groupForm.descriptionLabel')}
                        style={{ minHeight: '80px', resize: 'vertical', padding: '10px' }}
                    />
                </div>

                <div style={{ width: '100%', height: '1px', background: 'var(--gray)', opacity: 0.2, margin: '1rem 0' }}></div>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--gray)', margin: '0 0 10px 0' }}>
                    {t('languages.' + language) || language} {t('groupChat.translation') || 'Translation'}
                </h4>

                <div className="edit-group-field" style={{ width: '100%', textAlign: 'left' }}>
                    <label htmlFor="edit-group-translated-name" style={{ fontSize: '0.8rem', color: 'var(--gray)', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>
                        {t('groupForm.groupNameLabel')} ({t('languages.' + language) || language})
                    </label>
                    <input
                        id="edit-group-translated-name"
                        name="groupTranslatedName"
                        type="text"
                        className="delete-confirmation-input"
                        value={newTranslatedName}
                        onChange={(e) => setNewTranslatedName(e.target.value)}
                        placeholder={t('groupChat.enterNewGroupName') + ` (${language})`}
                        style={{ marginBottom: '1rem' }}
                    />
                </div>

                <div className="edit-group-field" style={{ width: '100%', textAlign: 'left' }}>
                    <label htmlFor="edit-group-translated-desc" style={{ fontSize: '0.8rem', color: 'var(--gray)', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>
                        {t('groupForm.descriptionLabel')} ({t('languages.' + language) || language})
                    </label>
                    <textarea
                        id="edit-group-translated-desc"
                        name="groupTranslatedDescription"
                        className="delete-confirmation-input"
                        value={newTranslatedDesc}
                        onChange={(e) => setNewTranslatedDesc(e.target.value)}
                        placeholder={t('groupForm.descriptionLabel') + ` (${language})`}
                        style={{ minHeight: '80px', resize: 'vertical', padding: '10px' }}
                    />
                </div>

                <div className="leave-modal-actions" style={{ marginTop: '1.5rem' }}>
                    <button ref={cancelBtnRef} className="modal-btn cancel" onClick={handleClose}>
                        {t('groupChat.cancel')}
                    </button>
                    <button
                        className="modal-btn primary"
                        onClick={handleUpdateGroupName}
                        disabled={
                            !newGroupName.trim() ||
                            (
                                (newGroupName === groupData?.name) &&
                                (newGroupDescription === (groupData?.description || '')) &&
                                (newTranslatedName === (translatedGroupName || (language ? groupData?.translations?.[language]?.name : '') || '')) &&
                                (newTranslatedDesc === (translatedGroupDesc || (language ? groupData?.translations?.[language]?.description : '') || ''))
                            )
                        }
                    >
                        {t('groupChat.save')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditGroupNameModal;
