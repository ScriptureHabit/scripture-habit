import { FC } from 'react';

interface ReactionsModalProps {
    t: (key: string) => string;
    showReactionsModal: boolean;
    setShowReactionsModal: (show: boolean) => void;
    reactionsToShow: any[];
    handleUserProfileClick: (userId: string | null) => Promise<void>;
}

const ReactionsModal: FC<ReactionsModalProps> = ({
    t,
    showReactionsModal,
    setShowReactionsModal,
    reactionsToShow,
    handleUserProfileClick,
}) => {
    if (!showReactionsModal) return null;

    return (
        <div className="leave-modal-overlay" onClick={() => setShowReactionsModal(false)}>
            <div className="leave-modal-content reactions-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '300px' }}>
                <h3>👍 Reactions</h3>
                <div className="reactions-list">
                    {reactionsToShow.map((reaction, idx) => (
                        <div
                            key={idx}
                            className="reaction-user"
                            onClick={() => {
                                handleUserProfileClick(reaction.userId);
                                setShowReactionsModal(false);
                            }}
                            style={{ cursor: 'pointer' }}
                        >
                            <span className="reaction-user-emoji">👍</span>
                            <span className="reaction-user-name">{reaction.nickname}</span>
                        </div>
                    ))}
                </div>
                <div className="leave-modal-actions">
                    <button className="modal-btn cancel" onClick={() => setShowReactionsModal(false)}>
                        {t('groupChat.cancel')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReactionsModal;
