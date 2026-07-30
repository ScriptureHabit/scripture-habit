import { FC } from 'react';
import { calculateUnityPercentage } from '../../../utils/unity-utils';
import { Group } from '../../../types/chat';
import { useGroupTranslation } from '../../../hooks/use-group-translation';

interface GroupMenuItemProps {
    group: Group;
    currentGroupId: string | null;
    language: string;
    onSelect: () => void;
}

const GroupMenuItem: FC<GroupMenuItemProps> = ({ group, currentGroupId, language, onSelect }) => {
    const { displayName } = useGroupTranslation(group, language);

    const getEmoji = (g: Group) => {
        const percentage = calculateUnityPercentage(g);

        if (percentage === 100) return '☀️';
        if (percentage >= 66) return '🌕';
        if (percentage >= 33) return '🌠';
        return '🌑';
    };

    const isActive = group.id === currentGroupId;

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
