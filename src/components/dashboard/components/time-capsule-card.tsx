import { UserData } from '../../../types/user';
import { useTimeCapsule } from '../../../hooks/use-time-capsule';
import { useTimeCapsuleStore } from '../../../store/use-time-capsule-store';
import { useLanguage } from '../../../hooks/use-language';
import { 
  UilEnvelopeLock, 
  UilEnvelopeAlt, 
  UilExclamationTriangle, 
  UilPen, 
  UilPlusCircle 
} from '@iconscout/react-unicons';
import './time-capsule-card.css';

interface TimeCapsuleCardProps {
  userData: UserData;
  warnings?: Array<{ name: string; hoursRemaining: number }>;
  setIsModalOpen?: (open: boolean) => void;
}

export function TimeCapsuleCard({
  userData,
  warnings = [],
  setIsModalOpen
}: TimeCapsuleCardProps) {
  const { t } = useLanguage();
  const { openCreateModal } = useTimeCapsuleStore();
  const { sealedCapsule, nextTargetDays, activeSosMessage, loading } = useTimeCapsule(userData);

  // Do not show for demo users
  if (userData.isAnonymousDemo) {
    return null;
  }

  // Do not show if user has not completed onboarding yet (onboarding quest has priority)
  const isLegacyCompleted = !userData.isAnonymousDemo && !userData.questCreatedGroup && !userData.questPostedNote && 
    (userData.totalNotes && userData.totalNotes > 0) && 
    ((userData.groupIds && userData.groupIds.length > 0) || !!userData.groupId);
  const hasOnboarded = !!userData.hasCompletedOnboarding || isLegacyCompleted;

  if (!hasOnboarded) {
    return null;
  }

  // 0. Skeleton Loading State (When loading and no local cached capsule is available)
  if (loading && !sealedCapsule) {
    return (
      <div className="time-capsule-card time-capsule-skeleton" data-testid="time-capsule-skeleton">
        <div className="skeleton-line skeleton-header-line" />
        <div className="skeleton-line skeleton-desc-line" />
        <div className="skeleton-bar" />
      </div>
    );
  }

  const currentDays = userData.daysStudiedCount || 0;
  const isCrisis = warnings.length > 0;

  // 1. SOS Crisis State (Less than 24h remaining & has SOS message)
  if (isCrisis && activeSosMessage) {
    const handlePostNote = () => {
      const targetElement = document.querySelector<HTMLElement>('[data-testid="new-note-button"]') ||
                            document.querySelector<HTMLElement>('.share-learning-cta') ||
                            document.querySelector<HTMLElement>('.new-note-btn');

      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetElement.focus();
      } else if (setIsModalOpen) {
        setIsModalOpen(true);
      }
    };

    return (
      <div className="time-capsule-card state-sos fade-in" data-testid="time-capsule-sos-card">
        <div className="sos-card-header">
          <UilExclamationTriangle size="20" />
          <span>{t('timeCapsule.cardSosTitle')}</span>
        </div>
        <div className="sos-card-message">
          "{activeSosMessage}"
        </div>
        <button 
          className="sos-card-action-btn" 
          onClick={handlePostNote}
          data-testid="sos-post-note-btn"
        >
          <UilPlusCircle size="16" />
          <span>{t('timeCapsule.postNowBtn')}</span>
        </button>
      </div>
    );
  }

  // 2. Sealed State (User has an active capsule)
  if (sealedCapsule) {
    const target = sealedCapsule.targetDays;
    const remaining = Math.max(0, target - currentDays);

    // Calculate progress within the current milestone interval (e.g. Day 275 -> Day 300)
    // Milestones: 10, 25, 50, 75, 100, 125, 150...
    const previousMilestone = target <= 10 ? 0 : target <= 25 ? 10 : target - 25;
    const startDays = sealedCapsule.createdStats?.days != null
      ? Math.min(sealedCapsule.createdStats.days, previousMilestone)
      : previousMilestone;
    const totalSpan = Math.max(1, target - startDays);
    const progressDays = Math.max(0, currentDays - startDays);
    const progressPercent = Math.min(100, Math.max(0, (progressDays / totalSpan) * 100));

    return (
      <div className="time-capsule-card state-sealed fade-in" data-testid="time-capsule-sealed-card">
        <div className="sealed-card-header">
          <span className="sealed-card-title">
            <UilEnvelopeLock size="18" color="#6b46c1" />
            {t('timeCapsule.cardSealedTitle', { days: target })}
          </span>
          <span className="sealed-card-badge">
            {remaining > 0 ? `あと ${remaining}日` : '開封間近！'}
          </span>
        </div>
        <div className="sealed-card-progress-text">
          {t('timeCapsule.cardSealedDesc', { current: currentDays, remaining })}
        </div>
        <div className="sealed-progress-bar-container">
          <div 
            className="sealed-progress-bar-fill" 
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    );
  }

  // 3. Unwritten State (User has completed onboarding or passed previous capsule, but hasn't written the next one)
  return (
    <div className="time-capsule-card state-unwritten fade-in" data-testid="time-capsule-unwritten-card">
      <div className="unwritten-card-info">
        <span className="unwritten-card-title">
          <UilEnvelopeAlt size="18" color="#6b46c1" />
          {t('timeCapsule.cardNoLetterTitle', { days: nextTargetDays })}
        </span>
        <p className="unwritten-card-desc">
          {t('timeCapsule.cardNoLetterDesc')}
        </p>
      </div>
      <button 
        className="unwritten-card-btn"
        onClick={() => openCreateModal(nextTargetDays)}
        data-testid="write-capsule-card-btn"
      >
        <UilPen size="16" />
        <span>{t('timeCapsule.writeLetterBtn')}</span>
      </button>
    </div>
  );
};
