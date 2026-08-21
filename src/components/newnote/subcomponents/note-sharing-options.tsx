import { Group } from '../../../types/chat';

interface NoteSharingOptionsProps {
    userGroups: Group[];
    shareOption: string;
    setShareOption: (opt: string) => void;
    selectedShareGroups: string[];
    handleGroupSelection: (groupId: string) => void;
    t: (key: string) => string;
}

const NoteSharingOptions = ({
    userGroups,
    shareOption,
    setShareOption,
    selectedShareGroups,
    handleGroupSelection,
    t
}: NoteSharingOptionsProps) => {
    const options = userGroups.length === 1 ? ['all', 'none'] : ['all', 'specific', 'none'];

    const getOptionInfo = (opt: string) => {
        if (opt === 'all') {
            return {
                icon: '🌐',
                label: userGroups.length === 1 ? t('newNote.shareToGroupShort') : t('newNote.shareAllShort')
            };
        }
        if (opt === 'specific') {
            return {
                icon: '👥',
                label: t('newNote.shareSpecificShort')
            };
        }
        if (opt === 'none') {
            return {
                icon: '🔒',
                label: t('newNote.shareNoneShort')
            };
        }
        return { icon: '', label: opt };
    };

    return (
        <div className="sharing-options">
            <div className="sharing-header">
                <label className="sharing-label">{t('newNote.shareLabel')}</label>
                {shareOption === 'specific' && (
                    <span className="sharing-badge">
                        {t('newNote.selectedGroupCount')
                            .replace('{count}', String(selectedShareGroups.length))
                            .replace('{total}', String(userGroups.length))}
                    </span>
                )}
            </div>

            <div className="share-segmented-control" role="radiogroup" aria-label={t('newNote.shareLabel')}>
                {options.map(opt => {
                    const isActive = shareOption === opt;
                    const isDisabled = (opt === 'all' || opt === 'specific') && userGroups.length === 0;
                    const isPrivate = opt === 'none';
                    const { icon, label } = getOptionInfo(opt);

                    return (
                        <button
                            key={opt}
                            type="button"
                            role="radio"
                            aria-checked={isActive}
                            data-testid={`share-option-${opt}`}
                            className={`share-segment-btn ${isActive ? 'active' : ''} ${isPrivate ? 'btn-private' : ''} ${isDisabled ? 'disabled' : ''}`}
                            onClick={() => !isDisabled && setShareOption(opt)}
                            disabled={isDisabled}
                        >
                            {icon && <span className="share-segment-icon">{icon}</span>}
                            <span className="share-segment-text">{label}</span>
                        </button>
                    );
                })}
            </div>

            {shareOption === 'specific' && (
                <div className="group-selection-list">
                    {userGroups.map(group => (
                        <label key={group.id} className="group-checkbox-item" htmlFor={`share-group-${group.id}`}>
                            <input
                                id={`share-group-${group.id}`}
                                name={`shareGroup_${group.id}`}
                                type="checkbox"
                                checked={selectedShareGroups.includes(group.id)}
                                onChange={() => handleGroupSelection(group.id)}
                            />
                            <span>{group.name || t('newNote.unnamedGroup')}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
};

export default NoteSharingOptions;
