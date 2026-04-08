import { useState, useEffect, useRef, FC } from 'react';
import { getToken } from 'firebase/app-check'; // Added AppCheck getToken
import { auth, appCheck } from '../../../firebase'; // Added appCheck
import { parseTimestampToMillis } from '../../../utils/timeUtils';
import { Group } from '../../../types/chat';

interface GroupMenuItemProps {
    group: Group;
    currentGroupId: string | null;
    language: string;
    onSelect: () => void;
    timeZone?: string;
}

const GroupMenuItem: FC<GroupMenuItemProps> = ({ group, currentGroupId, language, onSelect, timeZone = 'UTC' }) => {
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
                const appCheckTokenResponse = await getToken(appCheck, false); // Get AppCheck token
                const appCheckToken = appCheckTokenResponse.token;
                const API_BASE = window.location.hostname === 'localhost' ? '' : 'https://scripturehabit.app';

                const response = await fetch(`${API_BASE}/api/translate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${idToken}`,
                        'X-Firebase-AppCheck': appCheckToken, // Add AppCheck header
                    },


                    body: JSON.stringify({
                        text: group.name,
                        targetLanguage: language,
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
        if (!g || !g.members || g.members.length === 0) return '🌑';

        const effectiveTimeZone = g.timeZone || timeZone || 'UTC';
        const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: effectiveTimeZone });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTime = today.getTime();

        const uniquePosters = new Set<string>();

        // SOURCE 1: dailyActivity
        if (g.dailyActivity?.activeMembers && (g.dailyActivity.date === todayStr || g.dailyActivity.date === new Date().toDateString())) {
            g.dailyActivity.activeMembers.forEach(uid => uniquePosters.add(uid));
        }



        // Exclude members who joined today UNLESS they have already posted
        const memberJoinedAt = g.memberJoinedAt || {};
        const eligibleMembers = g.members.filter(uid => {
            if (uniquePosters.has(uid)) return true; // Posted today -> count
            const joinedTs = memberJoinedAt[uid];
            if (!joinedTs) return true;
            const joinedTime = parseTimestampToMillis(joinedTs);
            return joinedTime < todayTime;
        });

        if (eligibleMembers.length === 0) return '🌑';

        const eligiblePostersCount = [...uniquePosters].filter(uid => eligibleMembers.includes(uid)).length;
        const percentage = Math.round((eligiblePostersCount / eligibleMembers.length) * 100);

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
