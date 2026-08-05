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

    return (
        <div className="sharing-options">
            <label className="sharing-label">{t('newNote.shareLabel')}</label>
            <div className="radio-group">
                {options.map(opt => {
                    const isDisabled = (opt === 'all' || opt === 'specific') && userGroups.length === 0;
                    return (
                        <label key={opt} className={`radio-option ${isDisabled ? 'disabled' : ''}`}>
                            <input
                                type="radio" 
                                value={opt}
                                checked={shareOption === opt}
                                onChange={(e) => setShareOption(e.target.value)}
                                disabled={isDisabled}
                            />
                            <span>
                                {userGroups.length === 1 && opt === 'all'
                                    ? t('newNote.shareToGroup')
                                    : t(`newNote.share${opt.charAt(0).toUpperCase() + opt.slice(1)}`)
                                }
                            </span>
                        </label>
                    );
                })}
            </div>

            {shareOption === 'specific' && (
                <div className="group-selection-list">
                    {userGroups.map(group => (
                        <label key={group.id} className="group-checkbox-item">
                            <input
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
