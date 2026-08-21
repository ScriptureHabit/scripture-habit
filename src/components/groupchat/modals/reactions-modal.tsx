
interface Reaction {
    userId: string;
    nickname: string;
}

interface ReactionsModalProps {
    t: (key: string) => string;
    showReactionsModal: boolean;
    setShowReactionsModal: (show: boolean) => void;
    reactionsToShow: Reaction[];
    handleUserProfileClick: (userId: string | null) => Promise<void>;
}

const ReactionsModal = ({
    t,
    showReactionsModal,
    setShowReactionsModal,
    reactionsToShow,
    handleUserProfileClick,
}: ReactionsModalProps) => {
    if (!showReactionsModal) return null;

    return (
        <div className="leave-modal-overlay" onClick={() => setShowReactionsModal(false)}>
            <div className="leave-modal-content reactions-modal" onClick={(e) => e.stopPropagation()}>
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
