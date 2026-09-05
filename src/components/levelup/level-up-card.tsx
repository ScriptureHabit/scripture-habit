import React from 'react';
import { useLanguage } from '../../hooks/use-language';
import { UilBookOpen, UilCalendarAlt, UilUser } from '@iconscout/react-unicons';
import { getLevelTier } from '../../utils/level-utils';
import './level-up-card.css';

export interface LevelUpCardProps {
    level: number;
    days: number;
    nickname?: string;
    achievedDate?: string;
    cardRef?: React.RefObject<HTMLDivElement | null>;
}

export const LevelUpCard: React.FC<LevelUpCardProps> = ({
    level,
    days,
    nickname,
    achievedDate,
    cardRef
}) => {
    const { t } = useLanguage();
    const formattedDate = achievedDate || new Date().toISOString().split('T')[0].replace(/-/g, '.');
    const displayNickname = nickname || t('profile.you');
    const tier = getLevelTier(level);

    return (
        <div className={`level-up-card tier-${tier}`} ref={cardRef} data-testid="level-up-card">
            <div className="level-up-card-inner">
                {/* Header with App Branding */}
                <div className="level-up-card-header">
                    <div className="level-up-brand">
                        <span className="level-up-brand-icon">
                            <UilBookOpen size="18" />
                        </span>
                        <span className="level-up-brand-text">SCRIPTURE HABIT</span>
                    </div>
                    <span className="level-up-label-badge">
                        {t('levelUp.label')}
                    </span>
                </div>

                {/* Mascot & Speech Bubble */}
                <div className="level-up-card-body">
                    <div className="level-up-mascot-row">
                        <div className="level-up-mascot-wrapper">
                            <img 
                                src="/images/mascot.webp" 
                                alt="Scripture Habit Mascot" 
                                className="level-up-mascot-img"
                                crossOrigin="anonymous"
                            />
                        </div>
                        <div className="level-up-speech-bubble" data-testid="level-up-speech-bubble">
                            <span className="level-up-bubble-line1">
                                {t('levelUp.speechBubbleLine1', { level })}
                            </span>
                            <span className="level-up-bubble-line2">
                                {t('levelUp.speechBubbleLine2')}
                            </span>
                        </div>
                    </div>
                    <div className="level-up-number-container">
                        <span className="level-up-prefix">Lv.</span>
                        <span className="level-up-number">{level}</span>
                    </div>
                    <div className="level-up-days-badge">
                        {t('levelUp.daysStudied', { days })}
                    </div>
                    <div className="level-up-divider" />
                    <p className="level-up-message">
                        {t('levelUp.achievementMessage', { level })}
                    </p>
                </div>

                {/* Footer with Member & Date Info */}
                <div className="level-up-card-footer">
                    <div className="level-up-user-info">
                        <span className="level-up-info-item">
                            <UilUser size="13" /> {displayNickname}
                        </span>
                        <span className="level-up-info-item">
                            <UilCalendarAlt size="13" /> {formattedDate}
                        </span>
                    </div>
                    <div className="level-up-app-url">
                        scripturehabit.app
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LevelUpCard;
