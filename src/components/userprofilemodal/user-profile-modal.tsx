import { useState, useRef } from 'react';
import './user-profile-modal.css';
import { UilTimes, UilFire, UilFileAlt, UilGlobe } from '@iconscout/react-unicons';
import { useLanguage } from '../../hooks/use-language';
import { UserData } from '../../types/user';
import { UserProfile } from '../../types/chat';
import { useUserProfileData } from './hooks/use-user-profile-data';
import { useUserProfileTranslations } from './hooks/use-user-profile-translations';
import { useModalA11y } from '../../hooks/use-modal-a11y';

interface UserProfileModalProps {
    user: UserData | UserProfile | null;
    onClose: () => void;
}

const UserProfileModal = ({ user, onClose }: UserProfileModalProps) => {
    const { t, language } = useLanguage();
    const { currentUser, userId } = useUserProfileData(user);
    const [showFullImage, setShowFullImage] = useState(false);

    const modalRef = useRef<HTMLDivElement>(null);
    const closeBtnRef = useRef<HTMLButtonElement>(null);
    const fullImageOverlayRef = useRef<HTMLDivElement>(null);
    const fullImageCloseRef = useRef<HTMLButtonElement>(null);

    // State management extracted to custom hook
    const {
        translatedNickname,
        translatedBio,
        translatedStake,
        translatedWard,
        isNicknameTranslated,
        isBioTranslated,
        isLocationTranslated,
        loadingNickname,
        loadingBio,
        handleTranslateNickname,
        handleTranslateBio
    } = useUserProfileTranslations({
        userId,
        currentUser,
        language,
        t
    });

    // a11y: Main modal accessibility
    useModalA11y({
        isOpen: Boolean(currentUser) && !showFullImage,
        onClose,
        containerRef: modalRef,
        initialFocusRef: closeBtnRef
    });

    // a11y: Full image overlay accessibility
    useModalA11y({
        isOpen: Boolean(showFullImage),
        onClose: () => setShowFullImage(false),
        containerRef: fullImageOverlayRef,
        initialFocusRef: fullImageCloseRef
    });

    if (!currentUser) return null;

    const isBot = userId === 'ai-partner-bot' || userId?.startsWith('bot-') || currentUser.uid === 'ai-partner-bot' || currentUser.uid?.startsWith('bot-');
    const avatarPhotoURL = isBot ? '/images/ai-mascot.webp' : currentUser.photoURL;

    return (
        <div className="user-profile-modal-overlay" onClick={onClose}>
            <div 
                ref={modalRef}
                className="user-profile-modal-content" 
                role="dialog"
                aria-modal="true"
                aria-labelledby="user-profile-nickname"
                onClick={(e) => e.stopPropagation()}
            >
                <button 
                    ref={closeBtnRef}
                    className="close-btn" 
                    onClick={onClose}
                    aria-label={t('common.close') || 'Close'}
                >
                    <UilTimes size="24" />
                </button>
                <div className="modal-header">
                    <div
                        className={`user-avatar-large ${avatarPhotoURL ? 'has-image' : ''}`}
                        onClick={() => avatarPhotoURL && setShowFullImage(true)}
                        onKeyDown={(e) => {
                            if (avatarPhotoURL && (e.key === 'Enter' || e.key === ' ')) {
                                e.preventDefault();
                                setShowFullImage(true);
                            }
                        }}
                        tabIndex={avatarPhotoURL ? 0 : -1}
                        role={avatarPhotoURL ? 'button' : undefined}
                        aria-label={avatarPhotoURL ? (t('profile.viewFullPhoto') || 'View full photo') : undefined}
                        style={{ cursor: avatarPhotoURL ? 'pointer' : 'default' }}
                    >
                        {avatarPhotoURL ? (
                            <img 
                                src={avatarPhotoURL} 
                                alt={currentUser.nickname || 'Avatar'} 
                                className="avatar-img" 
                                onError={(e) => { (e.target as HTMLImageElement).src = '/images/mascot.webp'; }} 
                            />
                        ) : (
                            currentUser.nickname ? currentUser.nickname.substring(0, 1).toUpperCase() : '?'
                        )}
                    </div>
                </div>

                {showFullImage && avatarPhotoURL && (
                    <div 
                        ref={fullImageOverlayRef}
                        className="full-image-overlay" 
                        role="dialog"
                        aria-modal="true"
                        aria-label={t('profile.fullPhotoView') || 'Full photo view'}
                        onClick={() => setShowFullImage(false)}
                    >
                        <div className="full-image-content" onClick={(e) => e.stopPropagation()}>
                            <img src={avatarPhotoURL} alt={currentUser.nickname || 'Avatar'} className="full-avatar-img" />
                            <button 
                                ref={fullImageCloseRef}
                                className="full-image-close" 
                                onClick={() => setShowFullImage(false)}
                                aria-label={t('common.close') || 'Close'}
                            >
                                <UilTimes size="32" color="white" />
                            </button>
                        </div>
                    </div>
                )}

                <div className="modal-body">
                    <h2 id="user-profile-nickname" className="user-nickname">
                        {isNicknameTranslated ? translatedNickname : currentUser.nickname}
                        {currentUser.nickname && (
                            <button 
                                type="button"
                                className={`translate-inline-btn ${isNicknameTranslated ? 'active' : ''} ${loadingNickname ? 'loading' : ''}`}
                                onClick={handleTranslateNickname}
                                disabled={loadingNickname}
                                title={t('groupChat.translate') || 'Translate'}
                                aria-label={t('groupChat.translate') || 'Translate'}
                                aria-pressed={isNicknameTranslated}
                                aria-busy={loadingNickname}
                            >
                                <UilGlobe size="18" />
                            </button>
                        )}
                    </h2>

                    {(currentUser.stake || currentUser.ward) && (
                        <div className="user-location">
                            {currentUser.stake && <span className="location-tag">{isLocationTranslated && translatedStake ? translatedStake : currentUser.stake}</span>}
                            {currentUser.ward && <span className="location-tag">{isLocationTranslated && translatedWard ? translatedWard : currentUser.ward}</span>}
                        </div>
                    )}

                    {currentUser.bio && (
                        <div className="user-bio">
                            <p>{isBioTranslated ? translatedBio : currentUser.bio}</p>
                            <button 
                                type="button"
                                className={`translate-bio-btn ${isBioTranslated ? 'active' : ''}`}
                                onClick={handleTranslateBio}
                                disabled={loadingBio}
                                aria-pressed={isBioTranslated}
                                aria-busy={loadingBio}
                                aria-label={isBioTranslated ? (t('groupChat.showOriginal') || 'Show Original') : (t('groupChat.translate') || 'Translate')}
                            >
                                {loadingBio ? '...' : (isBioTranslated ? (t('groupChat.showOriginal') || 'Show Original') : (t('groupChat.translate') || 'Translate'))}
                            </button>
                        </div>
                    )}

                    {!isBot && (
                        <div className="user-stats">
                            <div className="stat-box">
                                <div className="stat-icon level">
                                    <span style={{ fontWeight: '800', fontSize: '1.2rem' }}>L</span>
                                </div>
                                <div className="stat-info">
                                    <span className="stat-value">{Math.floor((currentUser.daysStudiedCount || 0) / 7) + 1}</span>
                                    <span className="stat-label">{t('profile.level')}</span>
                                </div>
                            </div>
                            <div className="stat-box">
                                <div className="stat-icon fire">
                                    <UilFire />
                                </div>
                                <div className="stat-info">
                                    <span className="stat-value">{currentUser.daysStudiedCount || 0}</span>
                                    <span className="stat-label">{t('dashboard.streak')}</span>
                                </div>
                            </div>
                            <div className="stat-box">
                                <div className="stat-icon notes">
                                    <UilFileAlt />
                                </div>
                                <div className="stat-info">
                                    <span className="stat-value">{currentUser.totalNotes || 0}</span>
                                    <span className="stat-label">{t('dashboard.totalNotes')}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserProfileModal;
