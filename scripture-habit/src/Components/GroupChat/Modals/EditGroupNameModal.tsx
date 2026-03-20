import { FC } from 'react';
import { Group } from '../../../types/chat';

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

const EditGroupNameModal: FC<EditGroupNameModalProps> = ({
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
}) => {
    if (!showEditNameModal) return null;

    return (
        <div className="leave-modal-overlay">
            <div className="leave-modal-content edit-group-modal">
                <h3>{t('groupChat.changeGroupName')}</h3>

                <div className="edit-group-field" style={{ width: '100%', textAlign: 'left', marginTop: '1rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--gray)', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>
                        {t('groupForm.groupNameLabel')}
                    </label>
                    <input
                        type="text"
                        className="delete-confirmation-input"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder={t('groupChat.enterNewGroupName')}
                        style={{ marginBottom: '1rem' }}
                    />
                </div>

                <div className="edit-group-field" style={{ width: '100%', textAlign: 'left' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--gray)', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>
                        {t('groupForm.descriptionLabel')}
                    </label>
                    <textarea
                        className="delete-confirmation-input"
                        value={newGroupDescription}
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
                    <label style={{ fontSize: '0.8rem', color: 'var(--gray)', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>
                        {t('groupForm.groupNameLabel')} ({t('languages.' + language) || language})
                    </label>
                    <input
                        type="text"
                        className="delete-confirmation-input"
                        value={newTranslatedName}
                        onChange={(e) => setNewTranslatedName(e.target.value)}
                        placeholder={t('groupChat.enterNewGroupName') + ` (${language})`}
                        style={{ marginBottom: '1rem' }}
                    />
                </div>

                <div className="edit-group-field" style={{ width: '100%', textAlign: 'left' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--gray)', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>
                        {t('groupForm.descriptionLabel')} ({t('languages.' + language) || language})
                    </label>
                    <textarea
                        className="delete-confirmation-input"
                        value={newTranslatedDesc}
                        onChange={(e) => setNewTranslatedDesc(e.target.value)}
                        placeholder={t('groupForm.descriptionLabel') + ` (${language})`}
                        style={{ minHeight: '80px', resize: 'vertical', padding: '10px' }}
                    />
                </div>

                <div className="leave-modal-actions" style={{ marginTop: '1.5rem' }}>
                    <button className="modal-btn cancel" onClick={() => {
                        setShowEditNameModal(false);
                        setNewGroupName('');
                        setNewGroupDescription('');
                        setNewTranslatedName('');
                        setNewTranslatedDesc('');
                    }}>{t('groupChat.cancel')}</button>
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
