import { useState } from 'react';
import { toast } from 'react-toastify';
import apiClient from '../../../utils/api-client';
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
    const [prevFamilySyncProp, setPrevFamilySyncProp] = useState(groupData?.isFamilySyncEnabled);
    const [isFamilySyncEnabled, setIsFamilySyncEnabled] = useState(!!groupData?.isFamilySyncEnabled);
    const [togglingFamilySync, setTogglingFamilySync] = useState(false);

    if (groupData?.isFamilySyncEnabled !== prevFamilySyncProp) {
        setPrevFamilySyncProp(groupData?.isFamilySyncEnabled);
        setIsFamilySyncEnabled(!!groupData?.isFamilySyncEnabled);
    }

    if (!showEditNameModal) return null;

    const handleToggleFamilySync = async () => {
        if (!groupData?.id || togglingFamilySync) return;
        const nextState = !isFamilySyncEnabled;
        setTogglingFamilySync(true);
        try {
            await apiClient.post(`/api/groups/${groupData.id}/family-theme/toggle`, {
                enabled: nextState
            });
            setIsFamilySyncEnabled(nextState);
            toast.success(t('common.saved') || 'Saved');
        } catch (err: unknown) {
            console.error('Failed to toggle family sync:', err);
            const resData = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
            const errObj = err as { message?: string };
            const msgKey = resData?.error || resData?.message || errObj?.message || 'Failed';
            toast.error(t(msgKey) || msgKey);
        } finally {
            setTogglingFamilySync(false);
        }
    };

    const displayGroupName = newGroupName?.startsWith('groupChat.') ? t(newGroupName) : newGroupName;
    const displayGroupDesc = newGroupDescription?.startsWith('groupChat.') ? t(newGroupDescription) : newGroupDescription;

    return (
        <div className="leave-modal-overlay">
            <div className="leave-modal-content edit-group-modal">
                <h3>{t('groupChat.changeGroupName')}</h3>

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

                {!groupData?.isAiGroup && (
                    <div className="edit-group-field family-sync-toggle-field" style={{
                        width: '100%',
                        textAlign: 'left',
                        marginTop: '1.2rem',
                        padding: '14px 16px',
                        background: isFamilySyncEnabled ? 'rgba(255, 154, 158, 0.12)' : 'rgba(0, 0, 0, 0.03)',
                        borderRadius: '14px',
                        border: isFamilySyncEnabled ? '1px solid rgba(255, 154, 158, 0.4)' : '1px solid rgba(0, 0, 0, 0.08)',
                        transition: 'all 0.2s ease'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '1.2rem' }}>👨‍👩‍👧</span>
                                <strong style={{ fontSize: '0.95rem', color: 'var(--text-color, #2d3748)' }}>
                                    {t('familyTheme.groupOptionToggle')}
                                </strong>
                                <span style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    background: isFamilySyncEnabled ? '#ed64a6' : '#a0aec0',
                                    color: '#ffffff'
                                }}>
                                    {isFamilySyncEnabled ? 'ON' : 'OFF'}
                                </span>
                            </div>
                            <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', flexShrink: 0, marginLeft: '12px' }}>
                                <input
                                    type="checkbox"
                                    checked={isFamilySyncEnabled}
                                    onChange={handleToggleFamilySync}
                                    disabled={togglingFamilySync}
                                    style={{ opacity: 0, width: 0, height: 0 }}
                                />
                                <span style={{
                                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                                    backgroundColor: isFamilySyncEnabled ? '#ed64a6' : '#ccc',
                                    transition: '.3s', borderRadius: '24px'
                                }}>
                                    <span style={{
                                        position: 'absolute', content: '""', height: '18px', width: '18px', left: isFamilySyncEnabled ? '23px' : '3px', bottom: '3px',
                                        backgroundColor: 'white', transition: '.3s', borderRadius: '50%'
                                    }} />
                                </span>
                            </label>
                        </div>

                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            paddingTop: '10px',
                            borderTop: '1px solid rgba(0, 0, 0, 0.06)',
                            fontSize: '0.8rem',
                            lineHeight: '1.45'
                        }}>
                            <div style={{
                                padding: '8px 10px',
                                borderRadius: '8px',
                                background: isFamilySyncEnabled ? 'rgba(237, 100, 166, 0.1)' : 'transparent',
                                border: isFamilySyncEnabled ? '1px solid rgba(237, 100, 166, 0.25)' : '1px solid transparent',
                                transition: 'all 0.2s ease'
                            }}>
                                <div style={{ fontWeight: 700, color: isFamilySyncEnabled ? '#b83280' : 'var(--text-color, #2d3748)', marginBottom: '2px' }}>
                                    {isFamilySyncEnabled ? '● ' : '○ '}{t('familyTheme.modeFamilyTitle')}
                                </div>
                                <div style={{ color: isFamilySyncEnabled ? 'var(--text-color, #2d3748)' : 'var(--gray, #718096)' }}>
                                    {t('familyTheme.modeFamilyDesc')}
                                </div>
                            </div>

                            <div style={{
                                padding: '8px 10px',
                                borderRadius: '8px',
                                background: !isFamilySyncEnabled ? 'rgba(66, 153, 225, 0.08)' : 'transparent',
                                border: !isFamilySyncEnabled ? '1px solid rgba(66, 153, 225, 0.2)' : '1px solid transparent',
                                transition: 'all 0.2s ease'
                            }}>
                                <div style={{ fontWeight: 700, color: !isFamilySyncEnabled ? '#2b6cb0' : 'var(--text-color, #2d3748)', marginBottom: '2px' }}>
                                    {!isFamilySyncEnabled ? '● ' : '○ '}{t('familyTheme.modeIndividualTitle')}
                                </div>
                                <div style={{ color: !isFamilySyncEnabled ? 'var(--text-color, #2d3748)' : 'var(--gray, #718096)' }}>
                                    {t('familyTheme.modeIndividualDesc')}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

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
