import React, { useState } from 'react';
import { UilHeartSign, UilCheckCircle, UilAngleRight } from '@iconscout/react-unicons';
import { Group } from '../../../types/chat';
import { UserData } from '../../../types/user';
import { FAMILY_THEMES, FamilyThemeId } from '../../../types/family-theme';
import { FamilyThemeModal } from './family-theme-modal';
import { useLanguage } from '../../../hooks/use-language';
import './family-theme-card.css';

interface FamilyThemeCardProps {
    userData: UserData;
    familyGroup?: Group | null;
}

export const FamilyThemeCard: React.FC<FamilyThemeCardProps> = ({
    userData,
    familyGroup
}) => {
    const { t } = useLanguage();
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Only render if user belongs to a family-sync enabled group
    if (!familyGroup || !familyGroup.isFamilySyncEnabled) {
        return null;
    }

    const session = familyGroup.familyThemeSession;
    const selections = session?.selections || {};
    const myUid = userData.uid;
    const mySelection = selections[myUid] as FamilyThemeId | undefined;

    // Detect if partner selected a theme
    const otherSelections = Object.entries(selections).filter(([uid]) => uid !== myUid);
    const partnerHasSelected = otherSelections.length > 0;

    const isCompleted = !!session?.matchedTheme;
    const matchedThemeId = session?.matchedTheme as FamilyThemeId | undefined;

    return (
        <>
            <div
                className={`family-theme-card ${isCompleted ? 'is-completed' : ''} ${partnerHasSelected && !mySelection ? 'partner-ready' : ''}`}
                onClick={() => setIsModalOpen(true)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        setIsModalOpen(true);
                    }
                }}
            >
                <div className="family-card-left">
                    <div className="family-card-icon-container">
                        {isCompleted ? (
                            <span className="matched-theme-emoji">
                                {FAMILY_THEMES.find((item) => item.id === matchedThemeId)?.icon || '✨'}
                            </span>
                        ) : (
                            <UilHeartSign className="heart-icon" />
                        )}
                    </div>

                    <div className="family-card-text">
                        {isCompleted ? (
                            <>
                                <h4 className="family-card-title completed-title">
                                    {t('familyTheme.completedTitle', {
                                        theme: t(`familyTheme.themes.${matchedThemeId}`)
                                    })}
                                </h4>
                                <p className="family-card-desc">
                                    {t('familyTheme.completedDesc')}
                                </p>
                            </>
                        ) : partnerHasSelected && !mySelection ? (
                            <>
                                <h4 className="family-card-title partner-ready-title">
                                    {t('familyTheme.partnerSelectedTitle')}
                                </h4>
                                <p className="family-card-desc">
                                    {t('familyTheme.partnerSelectedDesc')}
                                </p>
                            </>
                        ) : mySelection ? (
                            <>
                                <h4 className="family-card-title waiting-title">
                                    {t('familyTheme.waitingPartnerTitle')}
                                </h4>
                                <p className="family-card-desc">
                                    {t('familyTheme.waitingPartnerDesc', {
                                        selectedTheme: t(`familyTheme.themes.${mySelection}`)
                                    })}
                                </p>
                            </>
                        ) : (
                            <>
                                <h4 className="family-card-title">
                                    {t('familyTheme.cardTitle')}
                                </h4>
                                <p className="family-card-desc">
                                    {t('familyTheme.cardDesc')}
                                </p>
                            </>
                        )}
                    </div>
                </div>

                <div className="family-card-right">
                    {isCompleted ? (
                        <div className="completed-badge">
                            <UilCheckCircle size="20" />
                            <span>{t('familyTheme.completedBadge') || '完了'}</span>
                        </div>
                    ) : (
                        <button
                            type="button"
                            className="family-action-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsModalOpen(true);
                            }}
                        >
                            <span>
                                {mySelection
                                    ? t('familyTheme.changeSelection')
                                    : t('familyTheme.openModalBtn')}
                            </span>
                            <UilAngleRight size="18" />
                        </button>
                    )}
                </div>
            </div>

            <FamilyThemeModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                familyGroup={familyGroup}
                currentUserId={myUid}
                userData={userData}
            />
        </>
    );
};
