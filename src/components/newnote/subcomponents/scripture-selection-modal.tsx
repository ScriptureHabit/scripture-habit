
interface ScriptureSelectionModalProps {
    t: (key: string) => string;
    onClose: () => void;
    availableReadingPlanScripts: string[];
    fillScriptureData: (script: string) => void;
    setShowScriptureSelectionModal: (show: boolean) => void;
    translateChapterField: (field: string) => string;
}

const ScriptureSelectionModal = ({
    t,
    onClose,
    availableReadingPlanScripts,
    fillScriptureData,
    setShowScriptureSelectionModal,
    translateChapterField
}: ScriptureSelectionModalProps) => {
    return (
        <div className="ModalOverlay" onClick={onClose}>
            <div className="ModalContent" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', textAlign: 'center' }}>
                <div className="modal-header" style={{ justifyContent: 'center' }}>
                    <h1>{t('dashboard.todaysComeFollowMe')}</h1>
                </div>
                <p style={{ marginBottom: '1rem', color: '#666' }}>{t('newNote.chooseScripturePlaceholder')}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', width: '100%', overflowY: 'auto', padding: '0.5rem' }}>
                    {availableReadingPlanScripts.map((script, idx) => (
                        <button
                            key={idx}
                            onClick={() => {
                                fillScriptureData(script);
                                setShowScriptureSelectionModal(false);
                            }}
                            className="random-menu-btn"
                            style={{
                                padding: '1rem',
                                borderRadius: '12px',
                                border: '1px solid #e2e8f0',
                                background: 'white',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: '500',
                                color: '#2d3748',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                transition: 'all 0.2s',
                                textAlign: 'left'
                            }}
                        >
                            📖 {translateChapterField(script)}
                        </button>
                    ))}
                </div>
                <button
                    onClick={() => setShowScriptureSelectionModal(false)}
                    className="cancel-btn"
                    style={{ marginTop: '1.5rem', alignSelf: 'center', width: 'auto', background: '#e2e8f0', color: '#4a5568' }}
                >
                    {t('newNote.cancel')}
                </button>
            </div>
        </div>
    );
};

export default ScriptureSelectionModal;
