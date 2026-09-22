import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import apiClient from '../../../utils/api-client';
import { getTranslationHash, isLikelyAlreadyInLanguage } from '../../../utils/language-utils';
import { UserData } from '../../../types/user';
import { UserProfile } from '../../../types/chat';

interface UseUserProfileTranslationsProps {
    userId: string | null;
    currentUser: UserData | UserProfile | null;
    language: string;
    t: (key: string) => string;
}

export const useUserProfileTranslations = ({
    userId,
    currentUser,
    language,
    t
}: UseUserProfileTranslationsProps) => {
    const nickHash = getTranslationHash(currentUser?.nickname || '');
    const bioHash = getTranslationHash(currentUser?.bio || '');
    const stakeHash = getTranslationHash(currentUser?.stake || '');
    const wardHash = getTranslationHash(currentUser?.ward || '');

    const nickCacheKey = `trans_user_nick_${userId}_${language}_${nickHash}`;
    const bioCacheKey = `trans_user_bio_${userId}_${language}_${bioHash}`;
    const stakeCacheKey = `trans_user_stake_${userId}_${language}_${stakeHash}`;
    const wardCacheKey = `trans_user_ward_${userId}_${language}_${wardHash}`;

    const profileKey = `${userId}_${language}_${nickHash}_${bioHash}_${stakeHash}_${wardHash}`;
    const shouldAutoTranslate = Boolean(currentUser?.language && currentUser.language !== language);

    // Initial state initialized from sessionStorage cache
    const [prevProfileKey, setPrevProfileKey] = useState(profileKey);
    const [translatedNickname, setTranslatedNickname] = useState<string | null>(() => sessionStorage.getItem(nickCacheKey));
    const [translatedBio, setTranslatedBio] = useState<string | null>(() => sessionStorage.getItem(bioCacheKey));
    const [translatedStake, setTranslatedStake] = useState<string | null>(() => sessionStorage.getItem(stakeCacheKey));
    const [translatedWard, setTranslatedWard] = useState<string | null>(() => sessionStorage.getItem(wardCacheKey));

    const [isNicknameTranslated, setIsNicknameTranslated] = useState<boolean>(() => Boolean(sessionStorage.getItem(nickCacheKey) && shouldAutoTranslate));
    const [isBioTranslated, setIsBioTranslated] = useState<boolean>(() => Boolean(sessionStorage.getItem(bioCacheKey) && shouldAutoTranslate));
    const [isLocationTranslated, setIsLocationTranslated] = useState<boolean>(() => Boolean((sessionStorage.getItem(stakeCacheKey) || sessionStorage.getItem(wardCacheKey)) && shouldAutoTranslate));

    const [loadingNickname, setLoadingNickname] = useState(false);
    const [loadingBio, setLoadingBio] = useState(false);

    // React recommended pattern: Adjusting state during render when props change
    // Avoids cascading renders in useEffect (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
    if (prevProfileKey !== profileKey) {
        setPrevProfileKey(profileKey);

        const cachedNick = sessionStorage.getItem(nickCacheKey);
        const cachedBio = sessionStorage.getItem(bioCacheKey);
        const cachedStake = sessionStorage.getItem(stakeCacheKey);
        const cachedWard = sessionStorage.getItem(wardCacheKey);

        setTranslatedNickname(cachedNick);
        setIsNicknameTranslated(Boolean(cachedNick && shouldAutoTranslate));

        setTranslatedBio(cachedBio);
        setIsBioTranslated(Boolean(cachedBio && shouldAutoTranslate));

        setTranslatedStake(cachedStake);
        setTranslatedWard(cachedWard);
        setIsLocationTranslated(Boolean((cachedStake || cachedWard) && shouldAutoTranslate));
    }

    // Effect ONLY handles asynchronous API fetches for missing translations
    useEffect(() => {
        if (!userId || !shouldAutoTranslate) return;
        let active = true;

        const cachedNick = sessionStorage.getItem(nickCacheKey);
        const cachedStake = sessionStorage.getItem(stakeCacheKey);
        const cachedWard = sessionStorage.getItem(wardCacheKey);
        const cachedBio = sessionStorage.getItem(bioCacheKey);

        // Auto-fetch nickname if needed
        if (!cachedNick && currentUser?.nickname && !isLikelyAlreadyInLanguage(currentUser.nickname, language)) {
            (async () => {
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
            })();
        }

        // Auto-fetch stake if needed
        if (!cachedStake && currentUser?.stake && !isLikelyAlreadyInLanguage(currentUser.stake, language)) {
            (async () => {
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
            })();
        }

        // Auto-fetch ward if needed
        if (!cachedWard && currentUser?.ward && !isLikelyAlreadyInLanguage(currentUser.ward, language)) {
            (async () => {
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
            })();
        }

        // Auto-fetch bio if needed
        if (!cachedBio && currentUser?.bio && !isLikelyAlreadyInLanguage(currentUser.bio, language)) {
            (async () => {
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
            })();
        }

        return () => {
            active = false;
        };
    }, [userId, shouldAutoTranslate, language, nickCacheKey, stakeCacheKey, wardCacheKey, bioCacheKey, currentUser]);

    const handleTranslateNickname = useCallback(async () => {
        if (isNicknameTranslated) {
            setIsNicknameTranslated(false);
            setIsLocationTranslated(false);
            return;
        }

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

        // Location tags translation
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
    }, [isNicknameTranslated, translatedNickname, currentUser, language, nickCacheKey, stakeCacheKey, wardCacheKey, t, translatedStake, translatedWard]);

    const handleTranslateBio = useCallback(async () => {
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
    }, [isBioTranslated, translatedBio, currentUser, language, bioCacheKey, t]);

    return {
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
    };
};
