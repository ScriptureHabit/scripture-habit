import LazyMarkdown from '../common/lazy-markdown';
import { UilEnvelopeAlt, UilTimes, UilCheck } from '@iconscout/react-unicons';
import './recap-modal.css';
import { useLanguage } from '../../hooks/use-language';

interface RecapModalProps {
    isOpen: boolean;
    onClose: () => void;
    recapText: string;
    title?: string;
    onSave?: () => void;
    isFromCache?: boolean;
}

const RecapModal = ({ isOpen, onClose, recapText, title, isFromCache = false }: RecapModalProps) => {
    const { t } = useLanguage();

    if (!isOpen) return null;

    return (
        <div className="RecapModalOverlay" onClick={onClose}>
            <div className="RecapModalContent" onClick={(e) => e.stopPropagation()}>
                <button className="recap-close-btn" onClick={onClose} aria-label="Close modal">
                    <UilTimes size="24" />
                </button>

                <div className="recap-header">
                    <div className="recap-icon-wrapper">
                        <UilEnvelopeAlt size="40" color="#8e44ad" />
                    </div>
                    <h2>{t('recapModal.title') || "Your Reflection Letter"}</h2>
                    <p className="recap-subtitle">{t('recapModal.subtitle') || "A reflection on your recent spiritual journey."}</p>
                </div>

                {title && (
                    <div className="recap-ai-title" data-testid="recap-ai-title">
                        ✨ {title}
                    </div>
                )}

                <div className="recap-paper">
                    <div className="recap-body">
                        <LazyMarkdown>{recapText}</LazyMarkdown>
                    </div>
                </div>

                <div className="recap-actions">
                    <div className="recap-saved-badge">
                        <UilCheck size="18" color="#059669" />
                        <span>{isFromCache ? (t('recapModal.savedToLetterBox') || "Saved in Letter Box") : (t('recapModal.savedToLetterBox') || "Saved in Letter Box")}</span>
                    </div>
                    <button className="recap-discard-btn" onClick={onClose}>
                        {t('recapModal.close') || "Close"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RecapModal;
