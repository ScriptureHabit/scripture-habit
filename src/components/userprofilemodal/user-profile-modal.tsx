
import { useState, useEffect } from 'react';
import './user-profile-modal.css';
import { UilTimes, UilFire, UilFileAlt, UilGlobe } from '@iconscout/react-unicons';
import { useLanguage } from '../../hooks/use-language';
import { UserData } from '../../types/user';
import { UserProfile } from '../../types/chat';
import apiClient from '../../utils/api-client';
import { toast } from 'react-toastify';
import { getTranslationHash, isLikelyAlreadyInLanguage } from '../../utils/language-utils';
import { useUserProfileData } from './hooks/use-user-profile-data';

interface UserProfileModalProps {
    user: UserData | UserProfile | null;
    onClose: () => void;
}

const UserProfileModal = ({ user, onClose }: UserProfileModalProps) => {
    const { t, language } = useLanguage();
    const { currentUser, userId } = useUserProfileData(user);
    const [showFullImage, setShowFullImage] = useState(false);

    // Translation states
    const [translatedNickname, setTranslatedNickname] = useState<string | null>(null);
    const [translatedBio, setTranslatedBio] = useState<string | null>(null);
    const [translatedStake, setTranslatedStake] = useState<string | null>(null);
    const [translatedWard, setTranslatedWard] = useState<string | null>(null);
    const [isNicknameTranslated, setIsNicknameTranslated] = useState(false);
    const [isBioTranslated, setIsBioTranslated] = useState(false);
    const [isLocationTranslated, setIsLocationTranslated] = useState(false);
    const [loadingNickname, setLoadingNickname] = useState(false);
    const [loadingBio, setLoadingBio] = useState(false);

    const nickHash = getTranslationHash(currentUser?.nickname || '');
    const bioHash = getTranslationHash(currentUser?.bio || '');
    const stakeHash = getTranslationHash(currentUser?.stake || '');
    const wardHash = getTranslationHash(currentUser?.ward || '');
    
    const nickCacheKey = `trans_user_nick_${userId}_${language}_${nickHash}`;
    const bioCacheKey = `trans_user_bio_${userId}_${language}_${bioHash}`;
    const stakeCacheKey = `trans_user_stake_${userId}_${language}_${stakeHash}`;
    const wardCacheKey = `trans_user_ward_${userId}_${language}_${wardHash}`;

    // Prefill from cache if available on mount, and auto-translate if languages differ
    useEffect(() => {
        if (!userId) return;
        let active = true;

        const cachedNick = sessionStorage.getItem(nickCacheKey);
        const cachedBio = sessionStorage.getItem(bioCacheKey);
        const cachedStake = sessionStorage.getItem(stakeCacheKey);
        const cachedWard = sessionStorage.getItem(wardCacheKey);
        
        // Determine if we should auto-translate (if languages differ)
        const shouldAutoTranslate = currentUser?.language && currentUser.language !== language;

        if (cachedNick) {
            queueMicrotask(() => {
                setTranslatedNickname(cachedNick);
                if (shouldAutoTranslate) {
                    setIsNicknameTranslated(true);
                }
            });
        } else {
            queueMicrotask(() => {
                setTranslatedNickname(null);
                setIsNicknameTranslated(false);
            });
            
            // Auto fetch if languages differ
            if (shouldAutoTranslate && currentUser?.nickname && !isLikelyAlreadyInLanguage(currentUser.nickname, language)) {
                const autoFetchNick = async () => {
                    setLoadingNickname(true);
                    try {
                        const res = await apiClient.post('/api/ai/translate', {
                            text: currentUser.nickname,
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

        if (cachedStake) {
            queueMicrotask(() => {
                setTranslatedStake(cachedStake);
                if (shouldAutoTranslate) {
                    setIsLocationTranslated(true);
                }
            });
        } else {
            queueMicrotask(() => {
                setTranslatedStake(null);
            });
            if (shouldAutoTranslate && currentUser?.stake && !isLikelyAlreadyInLanguage(currentUser.stake, language)) {
                const autoFetchStake = async () => {
                    try {
                        const res = await apiClient.post('/api/ai/translate', {
                            text: currentUser.stake,
                            targetLanguage: language,
                            updateType: 'user_stake'
                        });
                        if (active && res.data?.translatedText) {
                            const result = res.data.translatedText;
                            setTranslatedStake(result);
                            sessionStorage.setItem(stakeCacheKey, result);
                            setIsLocationTranslated(true);
                        }
                    } catch (err) {
                        console.error('Auto-translate stake failed:', err);
                    }
                };
                autoFetchStake();
            }
        }

        if (cachedWard) {
            queueMicrotask(() => {
                setTranslatedWard(cachedWard);
                if (shouldAutoTranslate) {
                    setIsLocationTranslated(true);
                }
            });
        } else {
            queueMicrotask(() => {
                setTranslatedWard(null);
            });
            if (shouldAutoTranslate && currentUser?.ward && !isLikelyAlreadyInLanguage(currentUser.ward, language)) {
                const autoFetchWard = async () => {
                    try {
                        const res = await apiClient.post('/api/ai/translate', {
                            text: currentUser.ward,
                            targetLanguage: language,
                            updateType: 'user_ward'
                        });
                        if (active && res.data?.translatedText) {
                            const result = res.data.translatedText;
                            setTranslatedWard(result);
                            sessionStorage.setItem(wardCacheKey, result);
                            setIsLocationTranslated(true);
                        }
                    } catch (err) {
                        console.error('Auto-translate ward failed:', err);
                    }
                };
                autoFetchWard();
            }
        }

        if (cachedBio) {
            queueMicrotask(() => {
                setTranslatedBio(cachedBio);
                if (shouldAutoTranslate) {
                    setIsBioTranslated(true);
                }
            });
        } else {
            queueMicrotask(() => {
                setTranslatedBio(null);
                setIsBioTranslated(false);
            });

            // Auto fetch if languages differ
            if (shouldAutoTranslate && currentUser?.bio && !isLikelyAlreadyInLanguage(currentUser.bio, language)) {
                const autoFetchBio = async () => {
                    setLoadingBio(true);
                    try {
                        const res = await apiClient.post('/api/ai/translate', {
                            text: currentUser.bio,
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
    }, [userId, language, nickCacheKey, bioCacheKey, stakeCacheKey, wardCacheKey, currentUser?.language, currentUser?.nickname, currentUser?.bio, currentUser?.stake, currentUser?.ward]);

    const handleTranslateNickname = async () => {
        if (isNicknameTranslated) {
            setIsNicknameTranslated(false);
            setIsLocationTranslated(false);
            return;
        }

        // Translate Nickname
        if (translatedNickname) {
            setIsNicknameTranslated(true);
        } else if (currentUser?.nickname) {
            if (isLikelyAlreadyInLanguage(currentUser.nickname, language)) {
                setTranslatedNickname(currentUser.nickname);
                setIsNicknameTranslated(true);
            } else {
                const cached = sessionStorage.getItem(nickCacheKey);
                if (cached) {
                    setTranslatedNickname(cached);
                    setIsNicknameTranslated(true);
                } else {
                    setLoadingNickname(true);
                    try {
                        const res = await apiClient.post('/api/ai/translate', {
                            text: currentUser.nickname,
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
                }
            }
        }

        // Translate Location tags (stake and ward)
        setIsLocationTranslated(true);
        if (!translatedStake && currentUser?.stake) {
            if (isLikelyAlreadyInLanguage(currentUser.stake, language)) {
                setTranslatedStake(currentUser.stake);
            } else {
                const cachedStake = sessionStorage.getItem(stakeCacheKey);
                if (cachedStake) {
                    setTranslatedStake(cachedStake);
                } else {
                    apiClient.post('/api/ai/translate', {
                        text: currentUser.stake,
                        targetLanguage: language,
                        updateType: 'user_stake'
                    }).then(res => {
                        if (res.data?.translatedText) {
                            setTranslatedStake(res.data.translatedText);
                            sessionStorage.setItem(stakeCacheKey, res.data.translatedText);
                        }
                    }).catch(e => console.error('Translate stake failed:', e));
                }
            }
        }
        if (!translatedWard && currentUser?.ward) {
            if (isLikelyAlreadyInLanguage(currentUser.ward, language)) {
                setTranslatedWard(currentUser.ward);
            } else {
                const cachedWard = sessionStorage.getItem(wardCacheKey);
                if (cachedWard) {
                    setTranslatedWard(cachedWard);
                } else {
                    apiClient.post('/api/ai/translate', {
                        text: currentUser.ward,
                        targetLanguage: language,
                        updateType: 'user_ward'
                    }).then(res => {
                        if (res.data?.translatedText) {
                            setTranslatedWard(res.data.translatedText);
                            sessionStorage.setItem(wardCacheKey, res.data.translatedText);
                        }
                    }).catch(e => console.error('Translate ward failed:', e));
                }
            }
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

        if (!currentUser || !currentUser.bio) return;

        if (isLikelyAlreadyInLanguage(currentUser.bio, language)) {
            setTranslatedBio(currentUser.bio);
            setIsBioTranslated(true);
            return;
        }

        const cached = sessionStorage.getItem(bioCacheKey);
        if (cached) {
            setTranslatedBio(cached);
            setIsBioTranslated(true);
            return;
        }

        setLoadingBio(true);
        try {
            const res = await apiClient.post('/api/ai/translate', {
                text: currentUser.bio,
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

    if (!currentUser) return null;

    const isBot = userId === 'ai-partner-bot' || userId?.startsWith('bot-') || currentUser.uid === 'ai-partner-bot' || currentUser.uid?.startsWith('bot-');
    const avatarPhotoURL = isBot ? '/images/ai-mascot.webp' : currentUser.photoURL;

    return (
        <div className="user-profile-modal-overlay" onClick={onClose}>
            <div className="user-profile-modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn" onClick={onClose}>
                    <UilTimes size="24" />
                </button>
                <div className="modal-header">
                    <div
                        className={`user-avatar-large ${avatarPhotoURL ? 'has-image' : ''}`}
                        onClick={() => avatarPhotoURL && setShowFullImage(true)}
                        style={{ cursor: avatarPhotoURL ? 'pointer' : 'default' }}
                    >
                        {avatarPhotoURL ? (
                            <img src={avatarPhotoURL} alt={currentUser.nickname || 'Avatar'} className="avatar-img" onError={(e) => { (e.target as HTMLImageElement).src = '/images/mascot.webp'; }} />
                        ) : (
                            currentUser.nickname ? currentUser.nickname.substring(0, 1).toUpperCase() : '?'
                        )}
                    </div>
                </div>

                {showFullImage && avatarPhotoURL && (
                    <div className="full-image-overlay" onClick={() => setShowFullImage(false)}>
                        <div className="full-image-content" onClick={(e) => e.stopPropagation()}>
                            <img src={avatarPhotoURL} alt={currentUser.nickname || 'Avatar'} className="full-avatar-img" />
                            <button className="full-image-close" onClick={() => setShowFullImage(false)}>
                                <UilTimes size="32" color="white" />
                            </button>
                        </div>
                    </div>
                )}

                <div className="modal-body">
                    <h2 className="user-nickname">
                        {isNicknameTranslated ? translatedNickname : currentUser.nickname}
                        {currentUser.nickname && (
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


