import { useEffect, useRef } from 'react';
import { useTimeCapsuleStore } from '../../store/use-time-capsule-store';
import { useLanguage } from '../../hooks/use-language';
import { triggerConfetti } from '../../utils/confetti-utils';
import { getNextMilestone } from '../../utils/milestone';
import { UilEnvelopeOpen, UilTimes, UilPen, UilArchiveAlt } from '@iconscout/react-unicons';
import { useModalA11y } from '../../hooks/use-modal-a11y';
import './time-capsule-unlock-modal.css';

export function TimeCapsuleUnlockModal() {
  const { isUnlockOpen, unlockedCapsule, closeUnlockModal, openCreateModal } = useTimeCapsuleStore();
  const { t } = useLanguage();
  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useModalA11y({
    isOpen: Boolean(isUnlockOpen && unlockedCapsule),
    onClose: closeUnlockModal,
    containerRef: modalRef,
    initialFocusRef: closeBtnRef,
  });

  useEffect(() => {
    if (isUnlockOpen && unlockedCapsule) {
      triggerConfetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.55 },
        zIndex: 10007
      });
    }
  }, [isUnlockOpen, unlockedCapsule]);

  if (!isUnlockOpen || !unlockedCapsule) return null;

  const targetDays = unlockedCapsule.targetDays;
  const nextTarget = getNextMilestone(targetDays);
  const stats = unlockedCapsule.createdStats;

  const handleWriteNext = () => {
    closeUnlockModal();
    openCreateModal(nextTarget);
  };

  return (
    <div className="time-capsule-unlock-overlay" onClick={closeUnlockModal} data-testid="time-capsule-unlock-overlay">
      <div
        ref={modalRef}
        className="time-capsule-unlock-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="time-capsule-unlock-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="time-capsule-unlock-header">
          <div className="unlock-badge-icon">
            <UilEnvelopeOpen size="28" color="#ffffff" />
          </div>
          <h3 id="time-capsule-unlock-title" className="time-capsule-unlock-title">
            {t('timeCapsule.unlockTitle')}
          </h3>
          <p className="time-capsule-unlock-subtitle">
            {t('timeCapsule.unlockSubtitle', { days: targetDays })}
          </p>
          <button 
            ref={closeBtnRef}
            className="time-capsule-unlock-close-btn" 
            onClick={closeUnlockModal} 
            aria-label={t('common.close')}
          >
            <UilTimes size="18" />
          </button>
        </div>

        {/* Body */}
        <div className="time-capsule-unlock-body">
          <div className="letter-paper-card">
            <div className="letter-paper-header">
              <span className="letter-paper-tag">
                <UilEnvelopeOpen size="16" />
                {t('timeCapsule.fromPastSelf')}
              </span>
              {stats?.date && (
                <span className="letter-paper-date">
                  {stats.date}
                </span>
              )}
            </div>

            <div className="letter-paper-content">
              {unlockedCapsule.content}
            </div>

            {stats && (
              <div className="letter-paper-stats-footer">
                <span>
                  {t('timeCapsule.createdOn', { 
                    date: stats.date || '', 
                    days: stats.days ?? 0, 
                    level: stats.level ?? 1 
                  })}
                </span>
              </div>
            )}
          </div>

          <div className="archive-notice-bar">
            <UilArchiveAlt size="18" color="#805ad5" />
            <span>{t('timeCapsule.savedToLetterBoxArchive')}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="time-capsule-unlock-footer">
          <button
            className="next-letter-cta-btn"
            onClick={handleWriteNext}
            data-testid="write-next-capsule-btn"
          >
            <UilPen size="18" />
            <span>{t('timeCapsule.writeNextLetter', { nextDays: nextTarget })}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
