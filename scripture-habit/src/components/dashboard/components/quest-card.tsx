import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { UserData } from '../../../types/user';
import { useLanguage } from '../../../hooks/use-language';
import confetti from 'canvas-confetti';
import './quest-card.css';

interface QuestCardProps {
  userData: UserData;
  t: (key: string, replacements?: Record<string, string | number>) => string;
  setIsModalOpen?: (open: boolean) => void;
  onStep1Click?: () => void;
  onStep2Click?: () => void;
}

export const QuestCard = ({ userData, t, setIsModalOpen, onStep1Click, onStep2Click }: QuestCardProps) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [celebrated, setCelebrated] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const step1Done = !!userData.questCreatedGroup || (userData.groupIds && userData.groupIds.length > 0) || !!userData.groupId;
  const step2Done = !!userData.questPostedNote || (userData.totalNotes && userData.totalNotes > 0);
  const allDone = step1Done && step2Done;

  // Identify legacy users who have already completed the actions before the quest system was introduced
  const isLegacyCompleted = !userData.questCreatedGroup && !userData.questPostedNote && 
    (userData.totalNotes && userData.totalNotes > 0) && 
    ((userData.groupIds && userData.groupIds.length > 0) || !!userData.groupId);

  useEffect(() => {
    const isE2E = typeof navigator !== 'undefined' && navigator.webdriver;
    if (allDone && !celebrated && !userData.hasCompletedOnboarding && !isLegacyCompleted && !isE2E) {
      queueMicrotask(() => {
        setCelebrated(true);
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
      } else if (setIsModalOpen) {
        setIsModalOpen(true);
      }
    }
  };

  const progressPercent = (step1Done ? 50 : 0) + (step2Done ? 50 : 0);

  return (
    <div className="onboarding-quest-card glassmorphic-card" data-testid="onboarding-quest-card">
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
              className={`quest-step-item ${step1Done ? 'completed' : 'pending'}`}
              onClick={handleStep1Click}
              role={step1Done ? undefined : 'button'}
              tabIndex={step1Done ? undefined : 0}
            >
              <div className="step-checkbox">
                {step1Done ? '✅' : '🌟'}
              </div>
              <div className="step-content">
                <span className="step-title">{t('onboardingQuest.step1Title')}</span>
                <span className="step-desc">
                  {step1Done ? t('onboardingQuest.step1DescSuccess') : t('onboardingQuest.step1Desc')}
                </span>
              </div>
            </div>

            <div 
              className={`quest-step-item ${step2Done ? 'completed' : !step1Done ? 'locked' : 'pending'}`}
              onClick={!step1Done ? undefined : handleStep2Click}
              role={step2Done || !step1Done ? undefined : 'button'}
              tabIndex={step2Done || !step1Done ? undefined : 0}
            >
              <div className="step-checkbox">
                {step2Done ? '✅' : !step1Done ? '🔒' : '🌟'}
              </div>
              <div className="step-content">
                <span className="step-title">{t('onboardingQuest.step2Title')}</span>
                <span className="step-desc">{t('onboardingQuest.step2Desc')}</span>
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
  );
};
