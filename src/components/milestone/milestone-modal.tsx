import { useRef, useEffect, useState } from 'react';
import { useMilestoneStore } from '../../store/use-milestone-store';
import { useTimeCapsuleStore } from '../../store/use-time-capsule-store';
import { useMilestoneCapsule } from '../../hooks/use-milestone-capsule';
import { useLanguage } from '../../hooks/use-language';
import { MilestoneCard } from './milestone-card';
import { triggerConfetti } from '../../utils/confetti-utils';
import { UilDownloadAlt, UilShareAlt, UilTimes, UilEnvelopeOpen } from '@iconscout/react-unicons';
import { toast } from 'react-toastify';
import './milestone-modal.css';

function MilestoneModal() {
    const { isOpen, milestoneData, closeMilestone } = useMilestoneStore();
    const { openUnlockModal } = useTimeCapsuleStore();
    const { t } = useLanguage();
    const cardRef = useRef<HTMLDivElement>(null);
    const [isSaving, setIsSaving] = useState(false);

    const days = milestoneData?.days;
    const nickname = milestoneData?.nickname;
    const achievedDate = milestoneData?.achievedDate;

    const { capsule, unlockCapsule } = useMilestoneCapsule(days, isOpen);

    useEffect(() => {
        if (isOpen && milestoneData) {
            // Elegant, subdued celebratory confetti burst
            triggerConfetti({
                particleCount: 80,
                spread: 60,
                origin: { y: 0.6 },
                zIndex: 10002
            });
        }
    }, [isOpen, milestoneData]);

    if (!isOpen || !milestoneData || !days) return null;

    const handleOpenCapsule = async () => {
        if (!capsule) {
            closeMilestone();
            return;
        }

        try {
            await unlockCapsule(capsule.id);
            closeMilestone();
            openUnlockModal({ ...capsule, isUnlocked: true });
        } catch (err) {
            console.error('Error unlocking capsule:', err);
            closeMilestone();
            openUnlockModal({ ...capsule, isUnlocked: true });
        }
    };

    const handleSaveImage = async () => {
        if (!cardRef.current || isSaving) return;
        setIsSaving(true);
        try {
            const { toPng } = await import('html-to-image');
            const dataUrl = await toPng(cardRef.current, {
                cacheBust: true,
                pixelRatio: 3,
                skipFonts: true
            });
            const link = document.createElement('a');
            link.download = `scripture-habit-${days}-days.png`;
            link.href = dataUrl;
            link.click();
            toast.success(t('milestone.imageSaved'));
        } catch (error) {
            console.error('Failed to generate milestone image:', error);
            toast.error(t('milestone.imageSaveError'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleShare = async () => {
        if (!cardRef.current) return;
        const shareText = t('milestone.shareText', { days });
        const shareUrl = 'https://scripturehabit.app';

        try {
            // Attempt native Web Share API with image file if supported
            if (navigator.share) {
                const { toBlob } = await import('html-to-image');
                const blob = await toBlob(cardRef.current, { 
                    pixelRatio: 2,
                    skipFonts: true 
                });
                if (blob && navigator.canShare && navigator.canShare({ files: [new File([blob], 'milestone.png', { type: 'image/png' })] })) {
                    const file = new File([blob], `scripture-habit-${days}days.png`, { type: 'image/png' });
                    await navigator.share({
                        title: 'Scripture Habit',
                        text: shareText,
                        url: shareUrl,
                        files: [file]
                    });
                    return;
                }

                // Fallback to text share
                await navigator.share({
                    title: 'Scripture Habit',
                    text: `${shareText}\n${shareUrl}`,
                    url: shareUrl
                });
                return;
            }

            // Desktop fallback: Open X (Twitter) intent
            const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
            window.open(twitterUrl, '_blank', 'noopener,noreferrer');
        } catch (error) {
            if ((error as Error)?.name !== 'AbortError') {
                console.warn('Share cancelled or failed:', error);
            }
        }
    };

    return (
        <div className="milestone-modal-overlay" onClick={closeMilestone} data-testid="milestone-modal-overlay">
            <div className="milestone-modal-container" onClick={(e) => e.stopPropagation()}>
                <button 
                    className="milestone-close-btn" 
                    onClick={closeMilestone} 
                    aria-label={t('common.close')}
                >
                    <UilTimes size="20" />
                </button>

                <div className="milestone-modal-header">
                    <h3 className="milestone-modal-title">
                        {t('milestone.title', { days })}
                    </h3>
                </div>

                <div className="milestone-card-wrapper">
                    <MilestoneCard
                        days={days}
                        nickname={nickname}
                        achievedDate={achievedDate}
                        cardRef={cardRef}
                    />
                </div>

                <div className="milestone-modal-actions">
                    {capsule ? (
                        <button 
                            className="milestone-action-btn primary" 
                            onClick={handleOpenCapsule}
                            data-testid="open-milestone-letter-btn"
                        >
                            <UilEnvelopeOpen size="18" />
                            <span>{t('milestone.openLetterAction')}</span>
                        </button>
                    ) : (
                        <button 
                            className="milestone-action-btn primary" 
                            onClick={handleSaveImage}
                            disabled={isSaving}
                            data-testid="save-milestone-img-btn"
                        >
                            <UilDownloadAlt size="18" />
                            <span>{isSaving ? t('milestone.saving') : t('milestone.saveImage')}</span>
                        </button>
                    )}
                    <button 
                        className="milestone-action-btn secondary" 
                        onClick={handleShare}
                        data-testid="share-milestone-btn"
                    >
                        <UilShareAlt size="18" />
                        <span>{t('milestone.share')}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MilestoneModal;
