import { useEffect } from 'react';
import { useLanguage } from '../../hooks/use-language';
import './join-success-modal.css';

interface JoinSuccessModalProps {
  onClose: () => void;
}

export default function JoinSuccessModal({ onClose }: JoinSuccessModalProps) {
  const { t } = useLanguage();

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="join-success-overlay"
      data-testid="join-success-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Group joined"
    >
      <div
        className="join-success-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mascot image */}
        <div className="join-success-mascot-wrapper">
          <img
            src="/images/mascot.webp"
            alt="Scripture Habit Mascot"
            className="join-success-mascot"
          />
        </div>

        {/* Message */}
        <div className="join-success-body">
          <h2 className="join-success-title">
            {t('joinGroup.joinedGroupWelcome')}
          </h2>
        </div>

        {/* Close button */}
        <button
          id="join-success-close-btn"
          className="join-success-btn"
          onClick={onClose}
          autoFocus
        >
          {t('common.close')}
        </button>
      </div>
    </div>
  );
}
