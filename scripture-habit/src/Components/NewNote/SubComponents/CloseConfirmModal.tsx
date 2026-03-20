import { FC } from 'react';

interface CloseConfirmModalProps {
    t: (key: string) => string;
    onClose: () => void;
    setShowCloseConfirm: (show: boolean) => void;
    handleSubmit: () => Promise<void>;
}

const CloseConfirmModal: FC<CloseConfirmModalProps> = ({
    t,
    onClose,
    setShowCloseConfirm,
    handleSubmit
}) => {
    return (
        <div className="ModalOverlay" style={{ zIndex: 1100, backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowCloseConfirm(false)}>
            <div className="ModalContent" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', height: 'auto', padding: '2rem' }}>
                <div className="modal-header" style={{ justifyContent: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: 0, textAlign: 'center' }}>
                        {t('newNote.confirmCloseTitle')}
                    </h2>
                </div>
                <p style={{ textAlign: 'center', marginBottom: '2rem', color: '#666' }}>
                    {t('newNote.confirmCloseMessage')}
                </p>
                <div className="modal-actions" style={{ justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setShowCloseConfirm(false)}
                        className="cancel-btn"
                        style={{ background: '#e2e8f0', color: '#4a5568', width: 'auto' }}
                    >
                        {t('newNote.confirmCloseKeepEditing')}
                    </button>
                    <button
                        onClick={() => {
                            setShowCloseConfirm(false);
                            onClose();
                        }}
                        className="cancel-btn"
                        style={{ background: '#fed7d7', color: '#c53030', width: 'auto' }}
                    >
                        {t('newNote.confirmCloseDiscard')}
                    </button>
                    <button
                        onClick={() => {
                            setShowCloseConfirm(false);
                            handleSubmit();
                        }}
                        className="submit-btn"
                        style={{ width: 'auto' }}
                    >
                        {t('newNote.confirmCloseSave')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CloseConfirmModal;
