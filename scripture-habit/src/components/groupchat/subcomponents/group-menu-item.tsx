import { useState, useEffect, useRef, FC } from 'react';
import { getToken } from 'firebase/app-check';
import { auth, appCheck } from '../../../firebase';
import { calculateUnityPercentage } from '../../../utils/unity-utils';
import { Group } from '../../../types/chat';

interface GroupMenuItemProps {
    group: Group;
    currentGroupId: string | null;
    language: string;
    onSelect: () => void;
}

const GroupMenuItem: FC<GroupMenuItemProps> = ({ group, currentGroupId, language, onSelect }) => {
    const [translatedName, setTranslatedName] = useState('');
    const translationAttemptedRef = useRef(false);

    /* 
     * Translation handling 
     */
    useEffect(() => {
        // 1. Check Firestore
        if (group.translations && group.translations[language] && group.translations[language].name) {
            setTranslatedName(group.translations[language].name || "");
            return;
        }

        // Check if we already attempted translation for this specific combination
        if (translationAttemptedRef.current) return;

        const autoTranslate = async () => {
            if (!group.name || !language) return;

            const cacheKey = `trans_name_${group.id}_${language}`;
            const cached = sessionStorage.getItem(cacheKey);

            if (cached) {
                setTranslatedName(cached);
                translationAttemptedRef.current = true;
                return;
            }

            translationAttemptedRef.current = true;

            try {
                const user = auth?.currentUser;
                if (!user) return;
                const idToken = await user.getIdToken();
                let appCheckToken = '';
                if (appCheck) {
                    const appCheckTokenResponse = await getToken(appCheck, false); // Get AppCheck token
                    appCheckToken = appCheckTokenResponse.token;
                }
                const API_BASE = window.location.hostname === 'localhost' ? '' : 'https://scripturehabit.app';

                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                };
                if (appCheckToken) {
                    headers['X-Firebase-AppCheck'] = appCheckToken;
                }

                const response = await fetch(`${API_BASE}/api/translate`, {
                    method: 'POST',
                    headers,


                    body: JSON.stringify({
                        text: group.name,
                        targetLanguage: language,
                        updateType: 'group_name'
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.translatedText) {
                        setTranslatedName(data.translatedText);
                        sessionStorage.setItem(cacheKey, data.translatedText);
                    }
                }
            } catch (error) {
                console.error('Error translating group name:', error);
            }
        };

        autoTranslate();
    }, [group.id, group.name, group.translations, language]);

    const getEmoji = (g: Group) => {
        const percentage = calculateUnityPercentage(g);

        if (percentage === 100) return '☀️';
        if (percentage >= 66) return '🌕';
        if (percentage >= 33) return '🌠';
        return '🌑';
    };

    const isActive = group.id === currentGroupId;
    const displayName = translatedName || group.name;

    return (
        <div
            className={`mobile-menu-item ${isActive ? 'active' : ''}`}
            onClick={onSelect}
        >
            <div className="menu-item-icon">
                <span className="menu-item-emoji">{getEmoji(group)}</span>
            </div>
            <span className="menu-item-label">
                {displayName} {group.members && <span className="sidebar-members-count">({group.members.length})</span>}
            </span>
        </div>
    );
};

export default GroupMenuItem;
