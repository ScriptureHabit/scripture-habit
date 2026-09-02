import { useRef, useEffect, useState } from 'react';
import { useLevelUpStore } from '../../store/use-level-up-store';
import { useLanguage } from '../../hooks/use-language';
import { LevelUpCard } from './level-up-card';
import { triggerConfetti } from '../../utils/confetti-utils';
import { UilDownloadAlt, UilShareAlt, UilTimes } from '@iconscout/react-unicons';
import { toast } from 'react-toastify';
import './level-up-modal.css';

function LevelUpModal() {
    const { isOpen, levelUpData, closeLevelUp } = useLevelUpStore();
    const { t } = useLanguage();
    const cardRef = useRef<HTMLDivElement>(null);
    const [isSaving, setIsSaving] = useState(false);

    const level = levelUpData?.level;
    const days = levelUpData?.days ?? (level ? (level - 1) * 7 : 0);
    const nickname = levelUpData?.nickname;
    const achievedDate = levelUpData?.achievedDate;

    useEffect(() => {
        if (isOpen && levelUpData) {
            // Celebratory confetti burst for level up
            triggerConfetti({
                particleCount: 90,
                spread: 70,
                origin: { y: 0.6 },
                zIndex: 10002
            });
        }
    }, [isOpen, levelUpData]);

    if (!isOpen || !levelUpData || !level) return null;

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
            link.download = `scripture-habit-level-${level}.png`;
            link.href = dataUrl;
            link.click();
            toast.success(t('levelUp.imageSaved'));
        } catch (error) {
            console.error('Failed to generate level-up image:', error);
            toast.error(t('levelUp.imageSaveError'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleShare = async () => {
        if (!cardRef.current) return;
        const shareText = t('levelUp.shareText', { level, days });
        const shareUrl = 'https://scripturehabit.app';

        try {
            // Attempt native Web Share API with image file if supported
            if (navigator.share) {
                const { toBlob } = await import('html-to-image');
                const blob = await toBlob(cardRef.current, { 
                    pixelRatio: 2,
                    skipFonts: true 
                });
                if (blob && navigator.canShare && navigator.canShare({ files: [new File([blob], 'levelup.png', { type: 'image/png' })] })) {
                    const file = new File([blob], `scripture-habit-level-${level}.png`, { type: 'image/png' });
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
        <div className="level-up-modal-overlay" onClick={closeLevelUp} data-testid="level-up-modal-overlay">
            <div className="level-up-modal-container" onClick={(e) => e.stopPropagation()}>
                <button 
                    className="level-up-close-btn" 
                    onClick={closeLevelUp} 
                    aria-label={t('common.close')}
                    data-testid="level-up-close-btn"
                >
                    <UilTimes size="20" />
                </button>

                <div className="level-up-modal-header">
                    <h3 className="level-up-modal-title">
                        {t('levelUp.title', { level })}
                    </h3>
                </div>

                <div className="level-up-card-wrapper">
                    <LevelUpCard
                        level={level}
                        days={days}
                        nickname={nickname}
                        achievedDate={achievedDate}
                        cardRef={cardRef}
                    />
                </div>

                <div className="level-up-modal-actions">
                    <button 
                        className="level-up-action-btn primary" 
                        onClick={handleSaveImage}
                        disabled={isSaving}
                        data-testid="save-level-up-img-btn"
                    >
                        <UilDownloadAlt size="18" />
                        <span>{isSaving ? t('levelUp.saving') : t('levelUp.saveImage')}</span>
                    </button>
                    <button 
                        className="level-up-action-btn secondary" 
                        onClick={handleShare}
                        data-testid="share-level-up-btn"
                    >
                        <UilShareAlt size="18" />
                        <span>{t('levelUp.share')}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default LevelUpModal;
