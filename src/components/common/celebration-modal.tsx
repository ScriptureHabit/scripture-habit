import React from 'react';
import { UilTimes } from '@iconscout/react-unicons';
import './celebration-modal.css';

export interface CelebrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    closeAriaLabel?: string;
    overlayClassName?: string;
    containerClassName?: string;
    overlayTestId?: string;
    closeBtnTestId?: string;
    children: React.ReactNode;
    actions: React.ReactNode;
}

export const CelebrationModal: React.FC<CelebrationModalProps> = ({
    isOpen,
    onClose,
    title,
    closeAriaLabel = 'Close',
    overlayClassName = '',
    containerClassName = '',
    overlayTestId,
    closeBtnTestId,
    children,
    actions
}) => {
    if (!isOpen) return null;

    return (
        <div
            className={`celebration-modal-overlay ${overlayClassName}`.trim()}
            onClick={onClose}
            data-testid={overlayTestId}
        >
            <div
                className={`celebration-modal-container ${containerClassName}`.trim()}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    className="celebration-close-btn"
                    onClick={onClose}
                    aria-label={closeAriaLabel}
                    data-testid={closeBtnTestId}
                >
                    <UilTimes size="20" />
                </button>

                <div className="celebration-modal-header">
                    <h3 className="celebration-modal-title">
                        {title}
                    </h3>
                </div>

                <div className="celebration-card-wrapper">
                    {children}
                </div>

                <div className="celebration-modal-actions">
                    {actions}
                </div>
            </div>
        </div>
    );
};
