import { useState, useEffect, useRef, FC } from 'react';
import { auth } from '../../../firebase';
import apiClient from '../../../utils/api-client';
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
        const targetTrans = group.translations?.[language];
        if (targetTrans?.name) {
            queueMicrotask(() => {
                setTranslatedName(targetTrans.name || "");
            });
            return;
        }

        // Check if we already attempted translation for this specific combination
        if (translationAttemptedRef.current) return;

        const autoTranslate = async () => {
            if (!group.name || !language) return;

            const cacheKey = `trans_name_${group.id}_${language}`;
            const cached = sessionStorage.getItem(cacheKey);

            if (cached) {
                queueMicrotask(() => {
                    setTranslatedName(cached);
                });
                translationAttemptedRef.current = true;
                return;
            }

            translationAttemptedRef.current = true;

            try {
                const user = auth?.currentUser;
                if (!user) return;

                const response = await apiClient.post('/api/ai/translate', {
                    text: group.name,
                    targetLanguage: language,
                    updateType: 'group_name'
                });

                const data = response.data;
                if (data.translatedText) {
                    setTranslatedName(data.translatedText);
                    sessionStorage.setItem(cacheKey, data.translatedText);
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
