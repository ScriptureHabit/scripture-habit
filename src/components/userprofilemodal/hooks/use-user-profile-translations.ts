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

interface TranslationsState {
    profileKey: string;
    nickname: string | null;
    bio: string | null;
    stake: string | null;
    ward: string | null;
    isNicknameTranslated: boolean;
    isBioTranslated: boolean;
    isLocationTranslated: boolean;
}

async function translateField(
    text: string,
    targetLanguage: string,
    updateType: string,
    cacheKey: string
): Promise<string | null> {
    if (isLikelyAlreadyInLanguage(text, targetLanguage)) {
        return text;
    }
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
        return cached;
    }
    const res = await apiClient.post('/api/ai/translate', {
        text,
        targetLanguage,
        updateType
    });
    if (res.data?.translatedText) {
        const result = res.data.translatedText as string;
        sessionStorage.setItem(cacheKey, result);
        return result;
    }
    return null;
}

function getInitialTranslations(
    profileKey: string,
    nickKey: string,
    bioKey: string,
    stakeKey: string,
    wardKey: string,
    auto: boolean
): TranslationsState {
    const nickname = sessionStorage.getItem(nickKey);
    const bio = sessionStorage.getItem(bioKey);
    const stake = sessionStorage.getItem(stakeKey);
    const ward = sessionStorage.getItem(wardKey);

    return {
        profileKey,
        nickname,
        bio,
        stake,
        ward,
        isNicknameTranslated: Boolean(nickname && auto),
        isBioTranslated: Boolean(bio && auto),
        isLocationTranslated: Boolean((stake || ward) && auto)
    };
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

    const [state, setState] = useState<TranslationsState>(() =>
        getInitialTranslations(profileKey, nickCacheKey, bioCacheKey, stakeCacheKey, wardCacheKey, shouldAutoTranslate)
    );

    const [loadingNickname, setLoadingNickname] = useState(false);
    const [loadingBio, setLoadingBio] = useState(false);

    // Sync state when profile identity or hashes change
    if (state.profileKey !== profileKey) {
        setState(getInitialTranslations(profileKey, nickCacheKey, bioCacheKey, stakeCacheKey, wardCacheKey, shouldAutoTranslate));
    }

    // Effect handles asynchronous API fetches for missing translations
    useEffect(() => {
        if (!userId || !shouldAutoTranslate) return;
        let active = true;

        if (!state.nickname && currentUser?.nickname) {
            translateField(currentUser.nickname, language, 'user_nickname', nickCacheKey)
                .then(res => {
                    if (active && res) {
                        setState(prev => ({ ...prev, nickname: res, isNicknameTranslated: true }));
                    }
                })
                .catch(err => console.error('Auto-translate nickname failed:', err));
        }

        if (!state.stake && currentUser?.stake) {
            translateField(currentUser.stake, language, 'user_stake', stakeCacheKey)
                .then(res => {
                    if (active && res) {
                        setState(prev => ({ ...prev, stake: res, isLocationTranslated: true }));
                    }
                })
                .catch(err => console.error('Auto-translate stake failed:', err));
        }

        if (!state.ward && currentUser?.ward) {
            translateField(currentUser.ward, language, 'user_ward', wardCacheKey)
                .then(res => {
                    if (active && res) {
                        setState(prev => ({ ...prev, ward: res, isLocationTranslated: true }));
                    }
                })
                .catch(err => console.error('Auto-translate ward failed:', err));
        }

        if (!state.bio && currentUser?.bio) {
            translateField(currentUser.bio, language, 'user_bio', bioCacheKey)
                .then(res => {
                    if (active && res) {
                        setState(prev => ({ ...prev, bio: res, isBioTranslated: true }));
                    }
                })
                .catch(err => console.error('Auto-translate bio failed:', err));
        }

        return () => { active = false; };
    }, [userId, shouldAutoTranslate, language, nickCacheKey, stakeCacheKey, wardCacheKey, bioCacheKey, currentUser, state.nickname, state.stake, state.ward, state.bio]);

    const handleTranslateNickname = useCallback(async () => {
        if (state.isNicknameTranslated) {
            setState(prev => ({ ...prev, isNicknameTranslated: false, isLocationTranslated: false }));
            return;
        }

        if (state.nickname) {
            setState(prev => ({ ...prev, isNicknameTranslated: true, isLocationTranslated: true }));
        } else if (currentUser?.nickname) {
            setLoadingNickname(true);
            try {
                const res = await translateField(currentUser.nickname, language, 'user_nickname', nickCacheKey);
                if (res) {
                    setState(prev => ({ ...prev, nickname: res, isNicknameTranslated: true, isLocationTranslated: true }));
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

        // Location tags translation
        if (!state.stake && currentUser?.stake) {
            translateField(currentUser.stake, language, 'user_stake', stakeCacheKey)
                .then(res => { if (res) setState(prev => ({ ...prev, stake: res, isLocationTranslated: true })); })
                .catch(e => console.error('Translate stake failed:', e));
        }
        if (!state.ward && currentUser?.ward) {
            translateField(currentUser.ward, language, 'user_ward', wardCacheKey)
                .then(res => { if (res) setState(prev => ({ ...prev, ward: res, isLocationTranslated: true })); })
                .catch(e => console.error('Translate ward failed:', e));
        }
    }, [state.isNicknameTranslated, state.nickname, state.stake, state.ward, currentUser, language, nickCacheKey, stakeCacheKey, wardCacheKey, t]);

    const handleTranslateBio = useCallback(async () => {
        if (state.isBioTranslated) {
            setState(prev => ({ ...prev, isBioTranslated: false }));
            return;
        }

        if (state.bio) {
            setState(prev => ({ ...prev, isBioTranslated: true }));
            return;
        }

        if (!currentUser?.bio) return;

        setLoadingBio(true);
        try {
            const res = await translateField(currentUser.bio, language, 'user_bio', bioCacheKey);
            if (res) {
                setState(prev => ({ ...prev, bio: res, isBioTranslated: true }));
            } else {
                throw new Error('No translation returned');
            }
        } catch (err) {
            console.error('Failed to translate bio:', err);
            toast.error(t('common.error') || 'Translation failed');
        } finally {
            setLoadingBio(false);
        }
    }, [state.isBioTranslated, state.bio, currentUser, language, bioCacheKey, t]);

    return {
        translatedNickname: state.nickname,
        translatedBio: state.bio,
        translatedStake: state.stake,
        translatedWard: state.ward,
        isNicknameTranslated: state.isNicknameTranslated,
        isBioTranslated: state.isBioTranslated,
        isLocationTranslated: state.isLocationTranslated,
        loadingNickname,
        loadingBio,
        handleTranslateNickname,
        handleTranslateBio
    };
};
