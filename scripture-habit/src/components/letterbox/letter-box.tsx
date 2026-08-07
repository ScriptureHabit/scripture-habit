
import { UilEnvelope, UilTrashAlt, UilTimes } from '@iconscout/react-unicons';
import ReactMarkdown from 'react-markdown';
import './letter-box.css';
import { useLanguage } from '../../hooks/use-language';
import { UserData } from '../../types/user';
import ConfirmModal from '../confirmmodal/confirm-modal';
import { parseTimestampToDate } from '../../utils/time-utils';
import { useLetterBox } from './hooks/use-letter-box';

interface LetterBoxProps {
    isOpen: boolean;
    onClose: () => void;
    userData: UserData | null;
}

const LetterBox = ({ isOpen, onClose, userData }: LetterBoxProps) => {
    const { t } = useLanguage();
    const {
        letters,
        loading,
        selectedLetter,
        setSelectedLetter,
        deleteTargetLetterId,
        setDeleteTargetLetterId,
        handleDelete,
        confirmDeleteLetter
    } = useLetterBox(isOpen, userData);

    if (!isOpen) return null;

    return (
        <div className="LetterBoxOverlay" onClick={onClose}>
            <div className="LetterBoxContent" onClick={(e) => e.stopPropagation()}>
                <div className="letterbox-header">
                    <h2><UilEnvelope /> {t('letterBox.title')}</h2>
                    <button className="close-btn" onClick={onClose} aria-label="Close"><UilTimes color="#ffffff" size="24" /></button>
                </div>

                <div className="letterbox-body">
                    {selectedLetter ? (
                        <div className="letter-detail-view">
                            <button className="back-btn" onClick={() => setSelectedLetter(null)}>
                                &larr; {t('letterBox.back')}
                            </button>
                            <div className="letter-paper">
                                <div className="letter-date">
                                    {parseTimestampToDate(selectedLetter.createdAt).toLocaleDateString()}
                                </div>
                                <ReactMarkdown>{selectedLetter.content || ""}</ReactMarkdown>
                            </div>
                        </div>
                    ) : (
                        <div className="letter-list">
                            {loading ? (
                                <p>{t('letterBox.loading')}</p>
                            ) : letters.length === 0 ? (
                                <div className="empty-letters">
                                    <UilEnvelope size="48" color="#ccc" />
                                    <p>{t('letterBox.empty')}</p>
                                </div>
                            ) : (
                                letters.map(letter => (
                                    <div
                                        key={letter.id}
                                        className="letter-item"
                                        onClick={() => setSelectedLetter(letter)}
                                    >
                                        <div className="letter-icon">
                                            <UilEnvelope size="24" color="#8e44ad" />
                                        </div>
                                        <div className="letter-info">
                                            <h3>{letter.title || t('letterBox.defaultTitle')}</h3>
                                            <span className="letter-date-meta">
                                                {letter.createdAt ? parseTimestampToDate(letter.createdAt).toLocaleDateString() : ""}
                                            </span>
                                        </div>
                                        <button
                                            className="delete-letter-btn"
                                            onClick={(e) => handleDelete(e, letter.id)}
                                            aria-label="Delete letter"
                                        >
                                            <UilTrashAlt size="18" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
            <ConfirmModal
                isOpen={Boolean(deleteTargetLetterId)}
                title={t('letterBox.deleteTitle') || 'Delete letter'}
                description={t('letterBox.deleteConfirm') || 'Are you sure you want to delete this letter?'}
                confirmLabel={t('common.delete') || 'Delete'}
                cancelLabel={t('common.cancel') || 'Cancel'}
                onConfirm={confirmDeleteLetter}
                onCancel={() => setDeleteTargetLetterId(null)}
            />
        </div>
    );
};

export default LetterBox;


