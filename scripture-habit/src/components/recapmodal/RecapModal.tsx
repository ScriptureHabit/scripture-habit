import { FC } from 'react';
import ReactMarkdown from 'react-markdown';
import { UilEnvelopeAlt, UilSave, UilTimes } from '@iconscout/react-unicons';
import './RecapModal.css';
import { useLanguage } from '../../Context/LanguageContext';

interface RecapModalProps {
    isOpen: boolean;
    onClose: () => void;
    recapText: string;
    onSave: () => void;
}

const RecapModal: FC<RecapModalProps> = ({ isOpen, onClose, recapText, onSave }) => {
    const { t } = useLanguage();

    if (!isOpen) return null;

    return (
        <div className="RecapModalOverlay" onClick={onClose}>
            <div className="RecapModalContent" onClick={(e) => e.stopPropagation()}>
                <button className="recap-close-btn" onClick={onClose}>
                    <UilTimes size="24" />
                </button>

                <div className="recap-header">
                    <div className="recap-icon-wrapper">
                        <UilEnvelopeAlt size="40" color="#8e44ad" />
                    </div>
                    <h2>{t('recapModal.title') || "Your Weekly Letter"}</h2>
                    <p className="recap-subtitle">{t('recapModal.subtitle') || "A reflection on your spiritual journey this week."}</p>
                </div>

                <div className="recap-paper">
                    <div className="recap-body">
                        <ReactMarkdown>{recapText}</ReactMarkdown>
                    </div>
                </div>

                <div className="recap-actions">
                    <button className="recap-discard-btn" onClick={onClose}>
                        {t('recapModal.close') || "Close"}
                    </button>
                    <button className="recap-save-btn" onClick={onSave}>
                        <UilSave size="20" />
                        {t('recapModal.saveToNotes') || "Save to Notes"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RecapModal;
