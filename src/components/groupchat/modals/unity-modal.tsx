import { UilTimes } from '@iconscout/react-unicons';
import { UserProfileBrief } from '../../../types/chat';
import { UserData } from '../../../types/user';

interface UnityModalProps {
    t: (key: string) => string;
    userData: UserData | null;
    showUnityModal: boolean;
    setShowUnityModal: (show: boolean) => void;
    unityPercentage: number;
    unityModalData: {
        posted: { id: string; nickname: string }[];
        notPosted: { id: string; nickname: string }[];
    };
    cheeredTodayUids: Set<string>;
    handleCheerClick: (member: UserProfileBrief) => void;
    handleUserProfileClick: (userId: string | null) => Promise<void>;
    membersLoading: boolean;
}

const UnityModal = ({
    t,
    userData,
    showUnityModal,
    setShowUnityModal,
    unityPercentage,
    unityModalData,
    cheeredTodayUids,
    handleCheerClick,
    handleUserProfileClick,
    membersLoading,
}: UnityModalProps) => {
    if (!showUnityModal) return null;

    return (
        <div className="leave-modal-overlay" onClick={() => setShowUnityModal(false)}>
            <div className="leave-modal-content unity-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '380px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '1.5rem' }}>
                <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '1.8rem' }}>
                        {unityPercentage === 100 ? '☀️' :
                            unityPercentage >= 66 ? '🌕' :
                                unityPercentage >= 33 ? '🌠' :
                                    '🌑'}
                    </span>
                    <button className="close-menu-btn" onClick={() => setShowUnityModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray)' }}>
                        <UilTimes size="24" />
                    </button>
                </div>

                <div className="unity-modal-body" style={{ overflowY: 'auto', flex: 1, paddingRight: '5px' }}>
                    <p className="unity-description" style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--black)', textAlign: 'center', margin: '1rem 0', lineHeight: '1.4' }}>
                        {t('groupChat.unityModalDescription') || "Let's all aim for the Celestial Kingdom together!"}
                    </p>

                    <div className="unity-percentage-display" style={{ textAlign: 'center', margin: '1.5rem 0' }}>
                        <div style={{ fontSize: '3.5rem', fontWeight: '800', color: 'var(--pink)', lineHeight: '1' }}>{unityPercentage}%</div>
                        <div className="unity-progress-container" style={{ width: '100%', height: '14px', background: 'rgba(0,0,0,0.05)', borderRadius: '7px', overflow: 'hidden', marginTop: '12px' }}>
                            <div className="unity-progress-bar" style={{ width: `${unityPercentage}%`, height: '100%', background: 'linear-gradient(90deg, #FF919D 0%, #fc6777 100%)', transition: 'width 1s cubic-bezier(0.34, 1.56, 0.64, 1)' }}></div>
                        </div>

                        <div className="unity-legend" style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(0,0,0,0.02)', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
                            <h5 style={{ margin: '0 0 10px 0', fontSize: '0.8rem', color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>{t('groupChat.unityModalLegendTitle') || "Progress Guide"}</h5>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                                    <span style={{ fontSize: '1.1rem' }}>☀️</span>
                                    <span style={{ color: unityPercentage === 100 ? 'var(--pink)' : 'var(--black)', fontWeight: unityPercentage === 100 ? 'bold' : 'normal' }}>{t('groupChat.unityModalLegendCelestial') || "Celestial (100%)"}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                                    <span style={{ fontSize: '1.1rem' }}>🌕</span>
                                    <span style={{ color: (unityPercentage >= 66 && unityPercentage < 100) ? 'var(--pink)' : 'var(--black)', fontWeight: (unityPercentage >= 66 && unityPercentage < 100) ? 'bold' : 'normal' }}>{t('groupChat.unityModalLegendTerrestrial') || "Terrestrial (66%~)"}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                                    <span style={{ fontSize: '1.1rem' }}>🌠</span>
                                    <span style={{ color: (unityPercentage >= 33 && unityPercentage < 66) ? 'var(--pink)' : 'var(--black)', fontWeight: (unityPercentage >= 33 && unityPercentage < 66) ? 'bold' : 'normal' }}>{t('groupChat.unityModalLegendTelestial') || "Telestial (33%~)"}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                                    <span style={{ fontSize: '1.1rem' }}>🌑</span>
                                    <span style={{ color: unityPercentage < 33 ? 'var(--pink)' : 'var(--black)', fontWeight: unityPercentage < 33 ? 'bold' : 'normal' }}>{t('groupChat.unityModalLegendEmpty') || "Starting (0%~)"}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {membersLoading ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <div className="spinner-mini" style={{ margin: '0 auto', width: '30px', height: '30px', border: '3px solid rgba(255,145,157,0.3)', borderTopColor: 'var(--pink)' }}></div>
                            <p style={{ marginTop: '10px', color: 'var(--gray)' }}>Loading members...</p>
                        </div>
                    ) : (
                        <div className="unity-lists" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div className="unity-list-section">
                                <h4 style={{ color: '#27ae60', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 10px 0', fontSize: '1rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>✅</span> {t('groupChat.unityModalPosted') || "Members who posted notes"}
                                </h4>
                                <div className="unity-nicknames" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {unityModalData.posted.length > 0 ? (
                                        unityModalData.posted.map((member, i) => (
                                            <span
                                                key={i}
                                                className="unity-nickname-chip"
                                                onClick={() => handleUserProfileClick(member.id)}
                                                style={{
                                                    background: '#e8f8f0',
                                                    color: '#27ae60',
                                                    padding: '6px 12px',
                                                    borderRadius: '20px',
                                                    fontSize: '0.9rem',
                                                    fontWeight: '500',
                                                    boxShadow: '0 2px 4px rgba(39, 174, 96, 0.1)',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {member.nickname}
                                            </span>
                                        ))
                                    ) : (
                                        <span style={{ fontStyle: 'italic', color: 'var(--gray)', fontSize: '0.9rem', padding: '5px 0' }}>{t('groupChat.unityModalNoPostsYet') || "No posts yet today"}</span>
                                    )}
                                </div>
                            </div>

                            <div className="unity-list-section">
                                <h4 style={{ color: 'var(--pink)', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 10px 0', fontSize: '1rem' }}>
                                    {t('groupChat.unityModalNotPosted') || "Let's encourage those who haven't posted yet!"}
                                </h4>
                                <div className="unity-nicknames" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {unityModalData.notPosted.length > 0 ? (
                                        unityModalData.notPosted.map((member, i) => (
                                            <span
                                                key={i}
                                                className={`unity-nickname-chip ${cheeredTodayUids.has(member.id) ? 'cheered' : ''}`}
                                                onClick={() => {
                                                    if (member.id === userData?.uid) return;
                                                    if (cheeredTodayUids.has(member.id)) return;
                                                    handleCheerClick(member);
                                                }}
                                                style={{
                                                    background: member.id === userData?.uid ? '#f0f0f0' : (cheeredTodayUids.has(member.id) ? '#f5f5f5' : '#fff0f3'),
                                                    color: member.id === userData?.uid ? 'var(--gray)' : (cheeredTodayUids.has(member.id) ? '#bdc3c7' : 'var(--pink)'),
                                                    padding: '6px 12px',
                                                    borderRadius: '20px',
                                                    fontSize: '0.9rem',
                                                    fontWeight: '500',
                                                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                                                    cursor: (member.id === userData?.uid || cheeredTodayUids.has(member.id)) ? 'default' : 'pointer',
                                                    border: member.id === userData?.uid ? '1px dashed #ccc' : (cheeredTodayUids.has(member.id) ? '1px solid #eee' : 'none'),
                                                    opacity: cheeredTodayUids.has(member.id) ? 0.8 : 1
                                                }}
                                            >
                                                {member.id === userData?.uid ? `${member.nickname} (${t('profile.you') || 'You'})` : (cheeredTodayUids.has(member.id) ? `✅ ${member.nickname}` : member.nickname)}
                                            </span>
                                        ))
                                    ) : (
                                        <div style={{ background: '#fff9e6', color: '#B8860B', padding: '10px 15px', borderRadius: '12px', fontSize: '0.95rem', fontWeight: 'bold', width: '100%', textAlign: 'center', border: '1px solid #ffeeba' }}>
                                            ✨ {t('groupChat.unityModalAllPosted') || 'Everyone has posted today! Amazing unity!'} ✨
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="leave-modal-actions" style={{ marginTop: '1.5rem' }}>
                    <button className="modal-btn primary" onClick={() => setShowUnityModal(false)} style={{ width: '100%', maxWidth: 'none' }}>
                        {t('groupChat.welcomeGuideButton') || t('welcomeGuideButton') || "Got it!"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UnityModal;
