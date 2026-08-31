import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { useTimeCapsuleStore } from '../../store/use-time-capsule-store';
import { useTimeCapsule } from '../../hooks/use-time-capsule';
import { useMilestoneAchieverCount } from '../../hooks/use-milestone-achiever-count';
import { UserData } from '../../types/user';
import { useLanguage } from '../../hooks/use-language';
import { triggerConfetti } from '../../utils/confetti-utils';
import { UilEnvelopeLock, UilTimes, UilPen, UilExclamationTriangle } from '@iconscout/react-unicons';
import { toast } from 'react-toastify';
import './time-capsule-modal.css';

interface TimeCapsuleModalProps {
  userData: UserData | null;
}

const MAX_CONTENT_LENGTH = 500;
const MIN_CONTENT_LENGTH = 5;
const MAX_SOS_LENGTH = 100;
const MIN_SOS_LENGTH = 3;

export function TimeCapsuleModal({ userData }: TimeCapsuleModalProps) {
  const { isCreateOpen, targetDays, closeCreateModal } = useTimeCapsuleStore();
  const { getDraft, saveDraft, createTimeCapsule } = useTimeCapsule(userData);
  const { count, hasEnoughAchievers } = useMilestoneAchieverCount(targetDays || 0);
  const { t } = useLanguage();

  const [content, setContent] = useState('');
  const [sosMessage, setSosMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const prevOpenRef = useRef(false);

  // Load draft when modal opens
  useEffect(() => {
    if (isCreateOpen && !prevOpenRef.current && targetDays) {
      const draft = getDraft(targetDays);
      setContent(draft.content || '');
      setSosMessage(draft.sosMessage || '');
    }
    prevOpenRef.current = isCreateOpen;
  }, [isCreateOpen, targetDays, getDraft]);

  // Auto-save draft on change
  const handleContentChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value.slice(0, MAX_CONTENT_LENGTH);
    setContent(val);
    saveDraft(targetDays, val, sosMessage);
  };

  const handleSosChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value.slice(0, MAX_SOS_LENGTH);
    setSosMessage(val);
    saveDraft(targetDays, content, val);
  };

  if (!isCreateOpen) return null;

  const isValid = content.trim().length >= MIN_CONTENT_LENGTH && sosMessage.trim().length >= MIN_SOS_LENGTH;

  const handleSubmit = async () => {
    if (!isValid || isSubmitting) {
      toast.warn(t('timeCapsule.minCharWarning'));
      return;
    }

    setIsSubmitting(true);
    try {
      await createTimeCapsule(targetDays, content, sosMessage);
      triggerConfetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      toast.success(t('timeCapsule.sealedSuccess', { days: targetDays }));
      closeCreateModal();
    } catch (err) {
      console.error('Failed to seal time capsule:', err);
      toast.error('Failed to seal time capsule');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="time-capsule-overlay" onClick={closeCreateModal} data-testid="time-capsule-modal-overlay">
      <div className="time-capsule-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="time-capsule-header">
          <div className="time-capsule-header-content">
            <div className="time-capsule-icon-badge">
              <UilEnvelopeLock size="22" />
            </div>
            <h3 className="time-capsule-title">
              {t('timeCapsule.createTitle', { days: targetDays })}
            </h3>
          </div>
          <button 
            className="time-capsule-close-btn" 
            onClick={closeCreateModal} 
            aria-label={t('common.close')}
          >
            <UilTimes size="18" />
          </button>
        </div>

        {/* Form Body */}
        <div className="time-capsule-body">
          {/* Section 1: Letter to Future Self */}
          <div className="time-capsule-section">
            <div className="time-capsule-section-header">
              <label className="time-capsule-label">
                <UilPen size="16" />
                {t('timeCapsule.letterSectionTitle', { days: targetDays })}
              </label>
            </div>
            <p className="time-capsule-desc">
              {t('timeCapsule.letterSectionDesc')}
            </p>
            <div className="time-capsule-textarea-wrapper">
              <textarea
                className="time-capsule-textarea main-letter"
                value={content}
                onChange={handleContentChange}
                placeholder={t('timeCapsule.letterPlaceholder')}
                disabled={isSubmitting}
                data-testid="time-capsule-letter-input"
              />
              <span className={`time-capsule-char-count ${content.length >= MAX_CONTENT_LENGTH ? 'warning' : ''}`}>
                {t('timeCapsule.charCount', { current: content.length, max: MAX_CONTENT_LENGTH })}
              </span>
            </div>
          </div>

          {/* Section 2: Emergency SOS Message */}
          <div className="time-capsule-section">
            <div className="time-capsule-section-header">
              <label className="time-capsule-label">
                <UilExclamationTriangle size="16" />
                {t('timeCapsule.sosSectionTitle')}
              </label>
            </div>
            <p className="time-capsule-desc">
              {t('timeCapsule.sosSectionDesc')}
            </p>
            <div className="time-capsule-textarea-wrapper">
              <textarea
                className="time-capsule-textarea sos-note"
                value={sosMessage}
                onChange={handleSosChange}
                placeholder={t('timeCapsule.sosPlaceholder')}
                disabled={isSubmitting}
                data-testid="time-capsule-sos-input"
              />
              <span className={`time-capsule-char-count ${sosMessage.length >= MAX_SOS_LENGTH ? 'warning' : ''}`}>
                {t('timeCapsule.charCount', { current: sosMessage.length, max: MAX_SOS_LENGTH })}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="time-capsule-footer">
          <div className="time-capsule-footer-social-proof" data-testid="time-capsule-social-proof">
            {hasEnoughAchievers && count !== null ? (
              <span>✨ {t('timeCapsule.socialProofCount', { count, days: targetDays })}</span>
            ) : (
              <span>🌱 {t('timeCapsule.socialProofChallengers', { days: targetDays })}</span>
            )}
          </div>
          <button
            className="time-capsule-submit-btn"
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            data-testid="seal-time-capsule-btn"
          >
            <UilEnvelopeLock size="18" />
            <span>{isSubmitting ? t('timeCapsule.sealing') : t('timeCapsule.sealButton')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
