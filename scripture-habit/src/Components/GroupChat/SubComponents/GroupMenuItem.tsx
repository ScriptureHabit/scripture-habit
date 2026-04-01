import { useState, useEffect, useRef, FC } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
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
                const idToken = await user?.getIdToken();
                const API_BASE = window.location.hostname === 'localhost' ? '' : 'https://scripturehabit.app';

                const response = await fetch(`${API_BASE}/api/translate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
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

                        // Save to Firestore (opportunistic)
                        try {
                            const groupRef = doc(db, 'groups', group.id);
                            await updateDoc(groupRef, {
                                [`translations.${language}.name`]: data.translatedText
                            });
                        } catch (e) {
                            console.error("Failed to save translation to Firestore", e);
                        }
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
            let joinedTime = 0;
            if (joinedTs?.toDate) joinedTime = joinedTs.toDate().getTime();
            else if (joinedTs?.seconds) joinedTime = joinedTs.seconds * 1000;
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
    const unreadCount = group.unreadCount || 0;

    return (
        <div
            className={`mobile-menu-item ${isActive ? 'active' : ''}`}
            onClick={onSelect}
            style={isActive ? { background: 'rgba(255, 145, 157, 0.1)', color: 'var(--pink)' } : {}}
        >
            <div className="menu-item-icon" style={isActive ? { color: 'var(--pink)' } : {}}>
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{getEmoji(group)}</span>
            </div>
            <span className="menu-item-label" style={isActive ? { fontWeight: 'bold' } : {}}>
                {displayName} {group.members && <span style={{ fontSize: '0.85em', color: isActive ? 'var(--pink)' : 'var(--gray)', opacity: 0.8, fontWeight: 'normal', marginLeft: '4px' }}>({group.members.length})</span>}
            </span>
            {unreadCount > 0 && (
                <span className="unread-badge-mini" style={{ marginLeft: 'auto' }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                </span>
            )}
        </div>
    );
};

export default GroupMenuItem;
