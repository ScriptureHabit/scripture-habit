
import { FC, useState, useEffect } from 'react';
import './user-profile-modal.css';
import { UilTimes, UilFire, UilFileAlt, UilGlobe } from '@iconscout/react-unicons';
import { useLanguage } from '../../hooks/use-language';
import { UserData } from '../../types/user';
import { UserProfile } from '../../types/chat';
import apiClient from '../../utils/api-client';
import { toast } from 'react-toastify';

interface UserProfileModalProps {
    user: UserData | UserProfile | null;
    onClose: () => void;
}

const UserProfileModal: FC<UserProfileModalProps> = ({ user, onClose }) => {
    const { t, language } = useLanguage();

    const [showFullImage, setShowFullImage] = useState(false);

    // Translation states
    const [translatedNickname, setTranslatedNickname] = useState<string | null>(null);
    const [translatedBio, setTranslatedBio] = useState<string | null>(null);
    const [isNicknameTranslated, setIsNicknameTranslated] = useState(false);
    const [isBioTranslated, setIsBioTranslated] = useState(false);
    const [loadingNickname, setLoadingNickname] = useState(false);
    const [loadingBio, setLoadingBio] = useState(false);

    // Simple hash function to invalidate cache if the content changes
    const getHash = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = (hash << 5) - hash + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash).toString(36);
    };

    const userId = user ? ((user as UserProfile).id || (user as UserData).uid) : '';
    const nickHash = getHash(user?.nickname || '');
    const bioHash = getHash(user?.bio || '');
    const nickCacheKey = `trans_user_nick_${userId}_${language}_${nickHash}`;
    const bioCacheKey = `trans_user_bio_${userId}_${language}_${bioHash}`;

    // Prefill from cache if available on mount, and auto-translate if languages differ
    useEffect(() => {
        if (!userId) return;
        let active = true;

        const cachedNick = sessionStorage.getItem(nickCacheKey);
        const cachedBio = sessionStorage.getItem(bioCacheKey);
        
        // Determine if we should auto-translate (if languages differ)
        const shouldAutoTranslate = user?.language && user.language !== language;

        if (cachedNick) {
            setTranslatedNickname(cachedNick);
            if (shouldAutoTranslate) {
                setIsNicknameTranslated(true);
            }
        } else {
            setTranslatedNickname(null);
            setIsNicknameTranslated(false);
            
            // Auto fetch if languages differ
            if (shouldAutoTranslate && user?.nickname) {
                const autoFetchNick = async () => {
                    setLoadingNickname(true);
                    try {
                        const res = await apiClient.post('/api/ai/translate', {
                            text: user.nickname,
                            targetLanguage: language,
                            updateType: 'user_nickname'
                        });
                        if (active && res.data?.translatedText) {
                            const result = res.data.translatedText;
                            setTranslatedNickname(result);
                            sessionStorage.setItem(nickCacheKey, result);
                            setIsNicknameTranslated(true);
                        }
                    } catch (err) {
                        console.error('Auto-translate nickname failed:', err);
                    } finally {
                        if (active) setLoadingNickname(false);
                    }
                };
                autoFetchNick();
            }
        }

        if (cachedBio) {
            setTranslatedBio(cachedBio);
            if (shouldAutoTranslate) {
                setIsBioTranslated(true);
            }
        } else {
            setTranslatedBio(null);
            setIsBioTranslated(false);

            // Auto fetch if languages differ
            if (shouldAutoTranslate && user?.bio) {
                const autoFetchBio = async () => {
                    setLoadingBio(true);
                    try {
                        const res = await apiClient.post('/api/ai/translate', {
                            text: user.bio,
                            targetLanguage: language,
                            updateType: 'user_bio'
                        });
                        if (active && res.data?.translatedText) {
                            const result = res.data.translatedText;
                            setTranslatedBio(result);
                            sessionStorage.setItem(bioCacheKey, result);
                            setIsBioTranslated(true);
                        }
                    } catch (err) {
                        console.error('Auto-translate bio failed:', err);
                    } finally {
                        if (active) setLoadingBio(false);
                    }
                };
                autoFetchBio();
            }
        }

        return () => {
            active = false;
        };
    }, [userId, language, nickCacheKey, bioCacheKey, user?.language, user?.nickname, user?.bio]);

    const handleTranslateNickname = async () => {
        if (isNicknameTranslated) {
            setIsNicknameTranslated(false);
            return;
        }
        if (translatedNickname) {
            setIsNicknameTranslated(true);
            return;
        }

        const cached = sessionStorage.getItem(nickCacheKey);
        if (cached) {
            setTranslatedNickname(cached);
            setIsNicknameTranslated(true);
            return;
        }

        if (!user || !user.nickname) return;
        setLoadingNickname(true);
        try {
            const res = await apiClient.post('/api/ai/translate', {
                text: user.nickname,
                targetLanguage: language,
                updateType: 'user_nickname'
            });
            if (res.data?.translatedText) {
                const result = res.data.translatedText;
                setTranslatedNickname(result);
                sessionStorage.setItem(nickCacheKey, result);
                setIsNicknameTranslated(true);
            } else {
                throw new Error('No translation returned');
            }
        } catch (err) {
            console.error('Failed to translate nickname:', err);
            toast.error(t('common.error') || 'Translation failed');
        } finally {
            setLoadingNickname(false);
        }
    };

    const handleTranslateBio = async () => {
        if (isBioTranslated) {
            setIsBioTranslated(false);
            return;
        }
        if (translatedBio) {
            setIsBioTranslated(true);
            return;
        }

        const cached = sessionStorage.getItem(bioCacheKey);
        if (cached) {
            setTranslatedBio(cached);
            setIsBioTranslated(true);
            return;
        }

        if (!user || !user.bio) return;
        setLoadingBio(true);
        try {
            const res = await apiClient.post('/api/ai/translate', {
                text: user.bio,
                targetLanguage: language,
                updateType: 'user_bio'
            });
            if (res.data?.translatedText) {
                const result = res.data.translatedText;
                setTranslatedBio(result);
                sessionStorage.setItem(bioCacheKey, result);
                setIsBioTranslated(true);
            } else {
                throw new Error('No translation returned');
            }
        } catch (err) {
            console.error('Failed to translate bio:', err);
            toast.error(t('common.error') || 'Translation failed');
        } finally {
            setLoadingBio(false);
        }
    };

    if (!user) return null;

    return (
        <div className="user-profile-modal-overlay" onClick={onClose}>
            <div className="user-profile-modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn" onClick={onClose}>
                    <UilTimes size="24" />
                </button>
                <div className="modal-header">
                    <div
                        className={`user-avatar-large ${user.photoURL ? 'has-image' : ''}`}
                        onClick={() => user.photoURL && setShowFullImage(true)}
                        style={{ cursor: user.photoURL ? 'pointer' : 'default' }}
                    >
                        {user.photoURL ? (
                            <img src={user.photoURL} alt={user.nickname} className="avatar-img" />
                        ) : (
                            user.nickname ? user.nickname.substring(0, 1).toUpperCase() : '?'
                        )}
                    </div>
                </div>

                {showFullImage && user.photoURL && (
                    <div className="full-image-overlay" onClick={() => setShowFullImage(false)}>
                        <div className="full-image-content" onClick={(e) => e.stopPropagation()}>
                            <img src={user.photoURL} alt={user.nickname} className="full-avatar-img" />
                            <button className="full-image-close" onClick={() => setShowFullImage(false)}>
                                <UilTimes size="32" color="white" />
                            </button>
                        </div>
                    </div>
                )}

                <div className="modal-body">
                    <h2 className="user-nickname">
                        {isNicknameTranslated ? translatedNickname : user.nickname}
                        {user.nickname && (
                            <button 
                                type="button"
                                className={`translate-inline-btn ${isNicknameTranslated ? 'active' : ''} ${loadingNickname ? 'loading' : ''}`}
                                onClick={handleTranslateNickname}
                                disabled={loadingNickname}
                                title={t('groupChat.translate') || 'Translate'}
                                aria-label={t('groupChat.translate') || 'Translate'}
                            >
                                <UilGlobe size="18" />
                            </button>
                        )}
                    </h2>

                    {(user.stake || user.ward) && (
                        <div className="user-location">
                            {user.stake && <span className="location-tag">{user.stake}</span>}
                            {user.ward && <span className="location-tag">{user.ward}</span>}
                        </div>
                    )}

                    {user.bio && (
                        <div className="user-bio">
                            <p>{isBioTranslated ? translatedBio : user.bio}</p>
                            <button 
                                type="button"
                                className={`translate-bio-btn ${isBioTranslated ? 'active' : ''}`}
                                onClick={handleTranslateBio}
                                disabled={loadingBio}
                                aria-label={isBioTranslated ? (t('groupChat.showOriginal') || 'Show Original') : (t('groupChat.translate') || 'Translate')}
                            >
                                {loadingBio ? '...' : (isBioTranslated ? (t('groupChat.showOriginal') || 'Show Original') : (t('groupChat.translate') || 'Translate'))}
                            </button>
                        </div>
                    )}

                    <div className="user-stats">
                        <div className="stat-box">
                            <div className="stat-icon level">
                                <span style={{ fontWeight: '800', fontSize: '1.2rem' }}>L</span>
                            </div>
                            <div className="stat-info">
                                <span className="stat-value">{Math.floor((user.daysStudiedCount || 0) / 7) + 1}</span>
                                <span className="stat-label">{t('profile.level')}</span>
                            </div>
                        </div>
                        <div className="stat-box">
                            <div className="stat-icon fire">
                                <UilFire />
                            </div>
                            <div className="stat-info">
                                <span className="stat-value">{user.daysStudiedCount || 0}</span>
                                <span className="stat-label">{t('dashboard.streak')}</span>
                            </div>
                        </div>
                        <div className="stat-box">
                            <div className="stat-icon notes">
                                <UilFileAlt />
                            </div>
                            <div className="stat-info">
                                <span className="stat-value">{user.totalNotes || 0}</span>
                                <span className="stat-label">{t('dashboard.totalNotes')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserProfileModal;


