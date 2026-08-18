import React from 'react';
import { useLanguage } from '../../hooks/use-language';
import { UilBookOpen, UilCalendarAlt, UilUser } from '@iconscout/react-unicons';
import './milestone-card.css';

export interface MilestoneCardProps {
    days: number;
    nickname?: string;
    achievedDate?: string;
    cardRef?: React.RefObject<HTMLDivElement | null>;
}

export const MilestoneCard: React.FC<MilestoneCardProps> = ({
    days,
    nickname,
    achievedDate,
    cardRef
}) => {
    const { t } = useLanguage();
    const formattedDate = achievedDate || new Date().toISOString().split('T')[0].replace(/-/g, '.');
    const displayNickname = nickname || t('profile.you');

    return (
        <div className="milestone-card" ref={cardRef} data-testid="milestone-card">
            <div className="milestone-card-inner">
                {/* Header with App Branding */}
                <div className="milestone-card-header">
                    <div className="milestone-brand">
                        <span className="milestone-brand-icon">
                            <UilBookOpen size="18" />
                        </span>
                        <span className="milestone-brand-text">SCRIPTURE HABIT</span>
                    </div>
                    <span className="milestone-label">
                        {t('milestone.label')}
                    </span>
                </div>

                {/* Mascot & Central Stat */}
                <div className="milestone-card-body">
                    <div className="milestone-mascot-wrapper">
                        <img 
                            src="/images/mascot.png" 
                            alt="Scripture Habit Mascot" 
                            className="milestone-mascot-img"
                            crossOrigin="anonymous"
                        />
                    </div>
                    <div className="milestone-number-container">
                        <span className="milestone-number">{days}</span>
                        <span className="milestone-days-text">
                            {t('milestone.daysUnit')}
                        </span>
                    </div>
                    <div className="milestone-divider" />
                    <p className="milestone-message">
                        {t('milestone.achievementMessage', { days })}
                    </p>
                </div>

                {/* Footer with Member & Date Info */}
                <div className="milestone-card-footer">
                    <div className="milestone-user-info">
                        <span className="milestone-info-item">
                            <UilUser size="13" /> {displayNickname}
                        </span>
                        <span className="milestone-info-item">
                            <UilCalendarAlt size="13" /> {formattedDate}
                        </span>
                    </div>
                    <div className="milestone-app-url">
                        scripturehabit.app
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MilestoneCard;
