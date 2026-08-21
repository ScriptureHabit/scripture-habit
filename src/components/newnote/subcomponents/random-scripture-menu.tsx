
interface RandomScriptureMenuProps {
    t: (key: string) => string;
    setShowRandomMenu: (show: boolean) => void;
    availableReadingPlanScripts: string[];
    handlePickRandomReadingPlan: () => void;
    handlePickRandomMastery: () => void;
    handlePickRandomPeace: () => void;
    handlePickRandomAdversity: () => void;
    handlePickRandomRelationship: () => void;
    handlePickRandomJoy: () => void;
}

const RandomScriptureMenu = ({
    t,
    setShowRandomMenu,
    availableReadingPlanScripts,
    handlePickRandomReadingPlan,
    handlePickRandomMastery,
    handlePickRandomPeace,
    handlePickRandomAdversity,
    handlePickRandomRelationship,
    handlePickRandomJoy
}: RandomScriptureMenuProps) => {
    return (
        <div className="ModalOverlay" onClick={() => setShowRandomMenu(false)}>
            <div className="ModalContent" onClick={(e) => e.stopPropagation()} style={{ 
                maxWidth: '450px', 
                textAlign: 'center', 
                padding: '2rem',
                borderRadius: '24px'
            }}>
                <div className="modal-header" style={{ justifyContent: 'center', marginBottom: '0.5rem' }}>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {t('newNote.surpriseMe')}
                    </h1>
                </div>
                <p style={{ 
                    marginBottom: '2rem', 
                    color: '#888', 
                    fontSize: '0.95rem' 
                }}>
                    {t('newNote.chooseScripturePlaceholder')}
                </p>
                
                <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '1rem', 
                    width: '100%' 
                }}>
                    {/* Today's Reading Plan */}
                    {(availableReadingPlanScripts.length > 0) && (
                        <button
                            onClick={handlePickRandomReadingPlan}
                            className="random-menu-btn"
                            style={buttonStyle}
                        >
                            <span style={iconStyle}>🗓️</span>
                            <span style={{ flex: 1 }}>{t('dashboard.todaysComeFollowMe')}</span>
                        </button>
                    )}

                    {/* Mastery Scriptures */}
                    <button
                        onClick={handlePickRandomMastery}
                        className="random-menu-btn"
                        style={buttonStyle}
                    >
                        <span style={iconStyle}>🎓</span>
                        <span style={{ flex: 1 }}>{t('newNote.masteryScriptures')}</span>
                    </button>

                    {/* Peace */}
                    <button
                        onClick={handlePickRandomPeace}
                        className="random-menu-btn"
                        style={buttonStyle}
                    >
                        <span style={iconStyle}>🕊️</span>
                        <span style={{ flex: 1 }}>{t('newNote.peaceScriptures')}</span>
                    </button>

                    {/* Adversity */}
                    <button
                        onClick={handlePickRandomAdversity}
                        className="random-menu-btn"
                        style={buttonStyle}
                    >
                        <span style={iconStyle}>⛓️</span>
                        <span style={{ flex: 1 }}>{t('newNote.adversityScriptures')}</span>
                    </button>

                    {/* Relationship */}
                    <button
                        onClick={handlePickRandomRelationship}
                        className="random-menu-btn"
                        style={buttonStyle}
                    >
                        <span style={iconStyle}>🤝</span>
                        <span style={{ flex: 1 }}>{t('newNote.relationshipScriptures')}</span>
                    </button>

                    {/* Joy */}
                    <button
                        onClick={handlePickRandomJoy}
                        className="random-menu-btn"
                        style={buttonStyle}
                    >
                        <span style={iconStyle}>😊</span>
                        <span style={{ flex: 1 }}>{t('newNote.joyScriptures')}</span>
                    </button>
                </div>

                <button
                    onClick={() => setShowRandomMenu(false)}
                    className="cancel-btn"
                    style={{ 
                        marginTop: '2rem', 
                        width: 'auto', 
                        padding: '0.8rem 2.5rem',
                        background: '#edf2f7', 
                        color: '#4a5568',
                        borderRadius: '12px',
                        border: 'none',
                        fontWeight: '600',
                        cursor: 'pointer'
                    }}
                >
                    {t('newNote.cancel')}
                </button>
            </div>
        </div>
    );
};

const buttonStyle: React.CSSProperties = {
    padding: '1.2rem',
    borderRadius: '16px',
    border: '1px solid #edf2f7',
    background: 'white',
    cursor: 'pointer',
    fontSize: '1.05rem',
    fontWeight: '600',
    color: '#2d3748',
    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
    transition: 'all 0.2s ease',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    width: '100%'
};

const iconStyle: React.CSSProperties = {
    fontSize: '1.4rem',
    width: '32px',
    display: 'flex',
    justifyContent: 'center',
    background: '#f8fafc',
    padding: '8px',
    borderRadius: '10px'
};

export default RandomScriptureMenu;
