import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { UserData } from '../../../types/user';
import { useLanguage } from '../../../hooks/use-language';
import { useModalStore } from '../../../store/use-modal-store';
import confetti from 'canvas-confetti';
import './quest-card.css';

interface QuestCardProps {
  userData: UserData;
  t: (key: string, replacements?: Record<string, string | number>) => string;
  setIsModalOpen?: (open: boolean) => void;
  onStep1Click?: () => void;
  onStep2Click?: () => void;
  onGoToGroupChat?: () => void;
  hasActiveModal?: boolean;
}

export const QuestCard = ({ 
  userData, 
  t, 
  setIsModalOpen, 
  onStep1Click, 
  onStep2Click, 
  onGoToGroupChat,
  hasActiveModal = false 
}: QuestCardProps) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { activeModal } = useModalStore();
  const [celebrated, setCelebrated] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const step1Done = !!userData.questCreatedGroup || (userData.groupIds && userData.groupIds.length > 0) || !!userData.groupId;
  const step2Done = !!userData.questPostedNote || (!userData.isAnonymousDemo && !!(userData.totalNotes && userData.totalNotes > 0));
  const allDone = step1Done && step2Done;

  // Identify legacy users who have already completed the actions before the quest system was introduced
  const isLegacyCompleted = !userData.isAnonymousDemo && !userData.questCreatedGroup && !userData.questPostedNote && 
    (userData.totalNotes && userData.totalNotes > 0) && 
    ((userData.groupIds && userData.groupIds.length > 0) || !!userData.groupId);

  const isSpotlightVisible = !allDone && !activeModal && !hasActiveModal;

  useEffect(() => {
    const isE2E = typeof navigator !== 'undefined' && navigator.webdriver;
    if (allDone && !celebrated && !userData.hasCompletedOnboarding && !isLegacyCompleted && !isE2E) {
      queueMicrotask(() => {
        setCelebrated(true);
        setShowModal(true);
      });
      // Fire premium confetti burst!
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
    }
  }, [allDone, celebrated, userData.hasCompletedOnboarding, isLegacyCompleted]);

  if (isDismissed || userData.hasCompletedOnboarding || isLegacyCompleted) {
    return null;
  }

  const handleComplete = async () => {
    setIsDismissed(true);
    if (!userData.uid) return;
    try {
      await updateDoc(doc(db, 'users', userData.uid), {
        hasCompletedOnboarding: true
      });
    } catch (err) {
      console.error('Error completing onboarding:', err);
      setIsDismissed(false); // Rollback optimistic update if network/server write fails
    }
  };

  const handleStep1Click = () => {
    if (!step1Done) {
      if (onStep1Click) {
        onStep1Click();
      } else {
        navigate(`/${language || 'ja'}/group-options`);
      }
    }
  };

  const handleStep2Click = () => {
    if (!step2Done) {
      if (onStep2Click) {
        onStep2Click();
        return;
      }

      // Smoothly scroll down to the note creation section and focus it
      const targetElement = document.querySelector<HTMLElement>('[data-testid="new-note-button"]') ||
                            document.querySelector<HTMLElement>('.share-learning-cta') ||
                            document.querySelector<HTMLElement>('.new-note-btn');

      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetElement.focus();
        targetElement.classList.add('pulse-focus-attention');
        setTimeout(() => {
          targetElement.classList.remove('pulse-focus-attention');
        }, 2000);
      } else if (setIsModalOpen) {
        setIsModalOpen(true);
      }
    }
  };

  const progressPercent = (step1Done ? 50 : 0) + (step2Done ? 50 : 0);

  return (
    <>
      {isSpotlightVisible && createPortal(
        <div className="quest-spotlight-overlay" />,
        document.body
      )}
      <div className={`onboarding-quest-card glassmorphic-card${isSpotlightVisible ? ' spotlight-active' : ''}`} data-testid="onboarding-quest-card">
      {!allDone ? (
        <>
          <div className="quest-header">
            <h3>{t('onboardingQuest.title')}</h3>
            <span className="quest-progress-label">{step1Done && step2Done ? '2/2' : (step1Done || step2Done ? '1/2' : '0/2')}</span>
          </div>
          
          <div className="quest-progress-bar-container">
            <div className="quest-progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
          </div>

          <div className="quest-steps">
            <div 
              className={`quest-step-item ${step1Done ? 'completed' : 'pending active-guide'}`}
              onClick={handleStep1Click}
              role={step1Done ? undefined : 'button'}
              tabIndex={step1Done ? undefined : 0}
              data-testid="quest-step-1"
            >
              <div className="step-checkbox">
                {step1Done ? '✅' : '🌟'}
              </div>
              <div className="step-content">
                <span className="step-title">{t('onboardingQuest.step1Title')}</span>
                {!step1Done && (
                  <span className="quest-action-pill">
                    {t('onboardingQuest.step1Action')} →
                  </span>
                )}
              </div>
            </div>

            <div 
              className={`quest-step-item ${step2Done ? 'completed' : !step1Done ? 'locked' : 'pending active-guide'}`}
              onClick={!step1Done ? undefined : handleStep2Click}
              role={step2Done || !step1Done ? undefined : 'button'}
              tabIndex={step2Done || !step1Done ? undefined : 0}
              data-testid="quest-step-2"
            >
              <div className="step-checkbox">
                {step2Done ? '✅' : !step1Done ? '🔒' : '🌟'}
              </div>
              <div className="step-content">
                <span className="step-title">{t('onboardingQuest.step2Title')}</span>
                {step1Done && !step2Done && (
                  <span className="quest-action-pill">
                    {t('onboardingQuest.step2Action')} ↓
                  </span>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="quest-congrats-container">
          <div className="congrats-badge">🎉</div>
          <h3>{t('onboardingQuest.congratsTitle')}</h3>
          <p>{t('onboardingQuest.congratsDesc')}</p>
          <button className="cta-btn quest-start-btn" onClick={handleComplete} data-testid="onboarding-quest-complete-button">
            {t('onboardingQuest.congratsBtn')}
          </button>
        </div>
      )}
    </div>

      {showModal && createPortal(
        <div className="quest-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="quest-modal-card" onClick={(e) => e.stopPropagation()} data-testid="quest-milestone-modal">
            <div className="quest-modal-mascot-wrapper">
              <img src="/images/mascot.png" alt="Mascot" className="quest-modal-mascot-img" />
            </div>
            
            <h2 className="quest-modal-title">
              {userData.isAnonymousDemo 
                ? (t('onboardingQuest.demo1000ModalTitle') || '🎉 1,000日目達成おめでとうございます！')
                : t('onboardingQuest.congratsTitle')}
            </h2>
            
            <p className="quest-modal-desc">
              {userData.isAnonymousDemo 
                ? (t('onboardingQuest.demo1000ModalDesc') || 'ついに大台の1,000日目を達成しました！グループチャットで投稿とみんなの反応を確認しましょう！✨')
                : t('onboardingQuest.congratsDesc')}
            </p>

            <div className="quest-modal-actions">
              <button 
                className="cta-btn quest-modal-primary-btn"
                onClick={() => {
                  handleComplete();
                  setShowModal(false);
                  if (onGoToGroupChat) {
                    onGoToGroupChat();
                  } else {
                    navigate(`/${language || 'ja'}/dashboard`);
                  }
                }}
                data-testid="quest-modal-go-chat-button"
              >
                {userData.isAnonymousDemo 
                  ? (t('onboardingQuest.demo1000ModalGoChatBtn') || 'グループチャットに行く')
                  : (t('onboardingQuest.congratsGoChatBtn') || 'グループチャットに行く')}
              </button>

              <button 
                className="quest-modal-secondary-btn"
                onClick={() => {
                  handleComplete();
                  setShowModal(false);
                }}
                data-testid="quest-modal-close-button"
              >
                {userData.isAnonymousDemo 
                  ? (t('onboardingQuest.demo1000ModalCloseBtn') || 'あとで確認する')
                  : t('onboardingQuest.congratsBtn')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
