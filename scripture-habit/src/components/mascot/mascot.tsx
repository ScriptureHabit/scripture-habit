
import React, { useMemo } from 'react';
import './mascot.css';
import { useLanguage } from '../../hooks/use-language';
import { UserData } from '../../types/user';

interface MascotProps {
  userData?: UserData | null;
  onClick?: () => void;
  customMessage?: string | null;
  reversed?: boolean;
}

const Mascot: React.FC<MascotProps> = ({ userData, onClick, customMessage = null, reversed = false }) => {
  const { t } = useLanguage();
  const mascotImg = '/images/mascot.png';

  const isDoneToday = useMemo(() => {
    if (!userData || !userData.lastPostDate) return false;

    let timeZone = userData.timeZone || 'UTC';
    try {
      Intl.DateTimeFormat(undefined, { timeZone });
    } catch {
      timeZone = 'UTC';
    }

    const now = new Date();
    const todayStr = now.toLocaleDateString('sv-SE', { timeZone });

    // In this app, lastPostDate is stored as a string "YYYY-MM-DD"
    // However, we handle both cases just in case
    if (typeof userData.lastPostDate === 'string') {
      return userData.lastPostDate === todayStr;
    }

    // Fallback for Timestamp objects (e.g. legacy or other types)
    let lastPostDate: Date;
    const lpd = userData.lastPostDate;
    if (lpd && typeof lpd === 'object' && 'toDate' in lpd && typeof lpd.toDate === 'function') {
      lastPostDate = (lpd as { toDate: () => Date }).toDate();
    } else {
      lastPostDate = new Date(lpd as string | number);
    }

    if (isNaN(lastPostDate.getTime())) return false;
    const lastPostDateStr = lastPostDate.toLocaleDateString('sv-SE', { timeZone });

    return todayStr === lastPostDateStr;
  }, [userData]);

  const streak = userData?.streakCount || 0;

  const getMessage = (): string => {
    if (customMessage) return customMessage;

    if (isDoneToday) {
      if (streak >= 7) {
        return t('mascot.streakCelebration', { streak: streak.toString() });
      }
      return t('mascot.doneToday');
    } else {
      return t('mascot.promptToday');
    }
  };

  return (
    <div className={`mascot-container ${isDoneToday ? 'is-done' : ''} ${reversed ? 'reversed' : ''}`} onClick={onClick}>
      <div className="mascot-image-wrapper">
        <img src={mascotImg} alt="Scripture Habit Mascot - Your guide to daily study" className="mascot-image" />
        {isDoneToday && <div className="mascot-sparkles">✨</div>}
      </div>
      <div className="mascot-bubble">
        <p className="mascot-text">{getMessage()}</p>
        <div className="mascot-bubble-tail"></div>
      </div>
    </div>
  );
};

export default Mascot;


