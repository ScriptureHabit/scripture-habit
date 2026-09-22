import { useEffect, useRef } from 'react';
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
    const modalRef = useRef<HTMLDivElement>(null);
    const closeBtnRef = useRef<HTMLButtonElement>(null);

    // a11y: Escape key handling and focus management
    useEffect(() => {
        if (!isOpen) return;

        const previouslyFocused = document.activeElement as HTMLElement | null;
        // Focus close button on open
        closeBtnRef.current?.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
                return;
            }

            // Focus Trap (cycle within modal on Tab / Shift+Tab)
            if (e.key === 'Tab' && modalRef.current) {
                const focusable = modalRef.current.querySelectorAll<HTMLElement>(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (focusable.length === 0) return;

                const first = focusable[0];
                const last = focusable[focusable.length - 1];

                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            previouslyFocused?.focus?.();
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="RecapModalOverlay" onClick={onClose}>
            <div 
                ref={modalRef}
                className="RecapModalContent" 
                role="dialog"
                aria-modal="true"
                aria-labelledby="recap-modal-title"
                onClick={(e) => e.stopPropagation()}
            >
                <button 
                    ref={closeBtnRef}
                    className="recap-close-btn" 
                    onClick={onClose} 
                    aria-label="Close modal"
                >
                    <UilTimes size="24" />
                </button>

                <div className="recap-header">
                    <div className="recap-icon-wrapper" aria-hidden="true">
                        <UilEnvelopeAlt size="40" color="#8e44ad" />
                    </div>
                    <h2 id="recap-modal-title">{t('recapModal.title') || "Your Reflection Letter"}</h2>
                    <p className="recap-subtitle">{t('recapModal.subtitle') || "A reflection on your recent spiritual journey."}</p>
                </div>

                {title && (
                    <div className="recap-ai-title" data-testid="recap-ai-title">
                        <span aria-hidden="true">✨ </span>{title}
                    </div>
                )}

                <div className="recap-paper" tabIndex={0} role="region" aria-label="Reflection content">
                    <div className="recap-body">
                        <LazyMarkdown>{recapText}</LazyMarkdown>
                    </div>
                </div>

                <div className="recap-actions">
                    <div className="recap-saved-badge" role="status" data-from-cache={isFromCache}>
                        <UilCheck size="18" color="#059669" aria-hidden="true" />
                        <span>{t('recapModal.savedToLetterBox') || "Saved in Letter Box"}</span>
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
