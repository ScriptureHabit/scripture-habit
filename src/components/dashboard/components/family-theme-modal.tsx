import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { UilTimes, UilCheckCircle, UilHeartSign } from '@iconscout/react-unicons';
import { toast } from 'react-toastify';
import apiClient from '../../../utils/api-client';
import { triggerConfetti } from '../../../utils/confetti-utils';
import { playNoteSubmitSound } from '../../../utils/audio-feedback';
import { isLevelUpDay, calculateLevel } from '../../../utils/level-utils';
import { isStudyMilestone } from '../../../utils/milestone';
import { useLevelUpStore } from '../../../store/use-level-up-store';
import { useMilestoneStore } from '../../../store/use-milestone-store';
import { FAMILY_THEMES, FamilyThemeId } from '../../../types/family-theme';
import { Group } from '../../../types/chat';
import { UserData } from '../../../types/user';
import { useLanguage } from '../../../hooks/use-language';
import './family-theme-modal.css';

interface FamilyThemeModalProps {
    isOpen: boolean;
    onClose: () => void;
    familyGroup: Group;
    currentUserId: string;
    userData?: UserData;
    onThemeMatched?: (themeId: string) => void;
}

export const FamilyThemeModal: React.FC<FamilyThemeModalProps> = ({
    isOpen,
    onClose,
    familyGroup,
    currentUserId,
    userData,
    onThemeMatched
}) => {
    const { t } = useLanguage();
    const [submitting, setSubmitting] = useState(false);
    const [localMatchSuccess, setLocalMatchSuccess] = useState<string | null>(null);

    const session = familyGroup.familyThemeSession;
    const selections = session?.selections || {};
    const mySelection = selections[currentUserId] as FamilyThemeId | undefined;

    // Detect if another member chose a different theme (mismatch)
    const otherSelections = Object.entries(selections).filter(([uid]) => uid !== currentUserId);
    const partnerSelection = otherSelections.length > 0 ? (otherSelections[0][1] as FamilyThemeId) : null;
    const isMismatch = mySelection && partnerSelection && mySelection !== partnerSelection;

    const isAlreadyCompleted = !!session?.matchedTheme;
    const matchedThemeId = (session?.matchedTheme || localMatchSuccess) as FamilyThemeId | null;

    if (!isOpen) return null;

    const handleClose = () => {
        setLocalMatchSuccess(null);
        onClose();
    };

    const handleSelectTheme = async (themeId: FamilyThemeId) => {
        if (submitting || isAlreadyCompleted) return;
        setSubmitting(true);

        try {
            const res = await apiClient.post(`/api/groups/${familyGroup.id}/family-theme/select`, {
                themeId
            });

            if (res.data?.matched) {
                const matchedTheme = res.data.matchedTheme || themeId;
                const streakUpdated = res.data?.streakUpdated ?? true;
                const prevDays = userData?.daysStudiedCount || 0;
                const newDays = typeof res.data?.daysStudiedCount === 'number'
                    ? res.data.daysStudiedCount
                    : (streakUpdated ? prevDays + 1 : prevDays);

                // Play celebratory note submission sound
                playNoteSubmitSound();

                if (streakUpdated) {
                    const isLevelUp = isLevelUpDay(newDays);
                    const isMilestone = isStudyMilestone(newDays);

                    if (isLevelUp) {
                        const newLevel = calculateLevel(newDays);
                        const pendingMilestone = isMilestone ? {
                            days: newDays,
                            nickname: userData?.nickname || ''
                        } : null;

                        handleClose();
                        useLevelUpStore.getState().openLevelUp({
                            level: newLevel,
                            days: newDays,
                            nickname: userData?.nickname || ''
                        }, pendingMilestone);
                    } else if (isMilestone) {
                        handleClose();
                        useMilestoneStore.getState().openMilestone({
                            days: newDays,
                            nickname: userData?.nickname || ''
                        });
                    } else {
                        setLocalMatchSuccess(matchedTheme);
                        triggerConfetti({
                            particleCount: 150,
                            spread: 70,
                            origin: { y: 0.6 },
                            zIndex: 10000
                        });
                    }
                } else {
                    setLocalMatchSuccess(matchedTheme);
                    triggerConfetti({
                        particleCount: 150,
                        spread: 70,
                        origin: { y: 0.6 },
                        zIndex: 10000
                    });
                }

                toast.success(t('familyTheme.matchSuccessTitle'));
                onThemeMatched?.(matchedTheme);
            } else {
                toast.info(t('familyTheme.waitingPartnerTitle'));
            }
        } catch (error: unknown) {
            console.error('[FamilyThemeModal] Error selecting theme:', error);
            const msg =
                (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                'Error occurred';
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDevSimulate = async (theme?: string, reset?: boolean) => {
        try {
            await apiClient.post(`/api/groups/${familyGroup.id}/family-theme/dev-simulate`, {
                partnerTheme: theme,
                reset
            });
            if (reset) {
                setLocalMatchSuccess(null);
            }
            toast.info(reset ? '🧪 Dev: Session reset' : `🧪 Dev: Partner selected ${theme}`);
        } catch (e: unknown) {
            console.error('Dev simulate failed:', e);
        }
    };

    return createPortal(
        <div className="family-theme-modal-overlay" onClick={handleClose} role="dialog" aria-modal="true">
            <div
                className="family-theme-modal-card"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    className="family-theme-modal-close"
                    onClick={handleClose}
                    aria-label={t('familyTheme.closeBtn') || 'Close'}
                >
                    <UilTimes size="20" />
                </button>

                {matchedThemeId ? (
                    <div className="theme-matched-view">
                        <div className="theme-matched-confetti-icon">🎉</div>
                        <h3 className="theme-matched-title">{t('familyTheme.matchSuccessTitle')}</h3>
                        <p className="theme-matched-sub">{t('familyTheme.completedDesc')}</p>

                        <button className="theme-matched-done-btn" onClick={handleClose}>
                            {t('familyTheme.closeBtn') || 'Close'}
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="family-theme-modal-header">
                            <div className="family-theme-header-badge">
                                <UilHeartSign size="18" />
                                <span>{familyGroup.name}</span>
                            </div>
                            <h2 className="family-theme-modal-title">{t('familyTheme.modalTitle')}</h2>
                            <p className="family-theme-modal-subtitle">{t('familyTheme.modalSubtitle')}</p>
                        </div>

                        {/* Mismatch banner */}
                        {isMismatch && (
                            <div className="theme-mismatch-banner">
                                <span className="mismatch-icon">💡</span>
                                <div>
                                    <div className="mismatch-title">{t('familyTheme.mismatchTitle')}</div>
                                    <div className="mismatch-sub">
                                        {t('familyTheme.mismatchDesc', {
                                            myTheme: mySelection ? t(`familyTheme.themes.${mySelection}`) : '',
                                            partnerTheme: partnerSelection ? t(`familyTheme.themes.${partnerSelection}`) : ''
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="family-theme-grid">
                            {FAMILY_THEMES.map((theme) => {
                                const isSelected = mySelection === theme.id;
                                const isPartnerSelected = partnerSelection === theme.id;

                                return (
                                    <button
                                        key={theme.id}
                                        className={`theme-grid-item ${isSelected ? 'is-selected' : ''} ${isPartnerSelected ? 'partner-selected' : ''}`}
                                        onClick={() => handleSelectTheme(theme.id)}
                                        disabled={submitting}
                                    >
                                        <span className="theme-item-icon">{theme.icon}</span>
                                        <span className="theme-item-name">
                                            {t(`familyTheme.themes.${theme.id}`)}
                                        </span>
                                        {isSelected && (
                                            <span className="selected-indicator">
                                                <UilCheckCircle size="16" />
                                            </span>
                                        )}
                                        {isPartnerSelected && !isSelected && (
                                            <span className="partner-indicator" title={t('familyTheme.partnerSelectedTitle')}>
                                                👤
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {mySelection && !partnerSelection && (
                            <div className="theme-waiting-hint">
                                <span className="waiting-spinner">⏳</span>
                                <span>{t('familyTheme.waitingPartnerTitle')}</span>
                            </div>
                        )}

                        {import.meta.env.DEV && (
                            <div style={{
                                marginTop: '1.2rem',
                                padding: '0.6rem 0.75rem',
                                background: 'rgba(0,0,0,0.03)',
                                borderRadius: '10px',
                                border: '1px dashed #cbd5e0',
                                fontSize: '0.75rem',
                                display: 'flex',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}>
                                <span style={{ fontWeight: 600, color: '#718096' }}>🧪 Dev Partner:</span>
                                <button
                                    type="button"
                                    onClick={() => handleDevSimulate('charity')}
                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e0', background: '#fff', cursor: 'pointer' }}
                                >
                                    慈愛
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDevSimulate('faith')}
                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e0', background: '#fff', cursor: 'pointer' }}
                                >
                                    信仰
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDevSimulate('hope')}
                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e0', background: '#fff', cursor: 'pointer' }}
                                >
                                    希望
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDevSimulate(undefined, true)}
                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #feb2b2', background: '#fff5f5', color: '#c53030', cursor: 'pointer' }}
                                >
                                    リセット
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>,
        document.body
    );
};
