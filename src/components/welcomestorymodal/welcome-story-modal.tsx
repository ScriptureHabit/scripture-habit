
import React, { useState, useEffect } from 'react';
import './welcome-story-modal.css';
import { useLanguage } from '../../hooks/use-language';
import { UilTimes, UilCheck } from '@iconscout/react-unicons';
import { triggerConfetti } from '../../utils/confetti-utils';
import { UserData } from '../../types/user';
import { DEFAULT_KICK_THRESHOLD } from '../../constants';

interface WelcomeStoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    userData: UserData | null;
}

const WelcomeStoryModal = ({ isOpen, onClose, userData }: WelcomeStoryModalProps): React.ReactElement | null => {
    const { t } = useLanguage();
    const [page, setPage] = useState(0);
    const [isNextVisible, setIsNextVisible] = useState(false);

    // Reset next button visibility and start a 2-second timer on page or open state changes
    useEffect(() => {
        if (isOpen) {
            queueMicrotask(() => {
                setIsNextVisible(false);
            });
            const timer = setTimeout(() => {
                setIsNextVisible(true);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [page, isOpen]);

    if (!isOpen) return null;

    const handleNext = () => {
        if (page < 5) {
            setPage(page + 1);
        } else {
            // Trigger confetti on clicking 'はじめる' (on the last page)
            triggerConfetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 }
            });
            onClose();
        }
    };

    const handleBack = () => {
        if (page > 0) {
            setPage(page - 1);
        }
    };

    const username = userData?.nickname || 'Friend';

    const replaceUsername = (text: string) => text.replace('{username}', username);

    const pages = [
        // Page 1: Welcome
        <div className="story-page" key="p1">
            <img src="/images/mascot.webp" alt="Welcome Bird" className="story-image" />
            <h2 className="story-title">{t('welcomeStory.page1Title')}</h2>
            <p className="story-text">{t('welcomeStory.page1Content')}</p>
        </div>,

        // Page 2: Evidence
        <div className="story-page" key="p2">
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔬📈</div>
            <h2 className="story-title">{t('welcomeStory.page2Title')}</h2>
            <div className="story-highlight-box">
                {/* nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml */}
                <p
                    className="story-text"
                    style={{ margin: 0, fontWeight: '500' }}
                    dangerouslySetInnerHTML={{ __html: t('welcomeStory.page2Content') }}
                />
            </div>
        </div>,

        // Page 3: How it works
        <div className="story-page" key="p3">
            <h2 className="story-title">{replaceUsername(t('welcomeStory.page3Title'))}</h2>
            <div className="list-steps">
                <div className="step-item">
                    <UilCheck className="step-icon" /> {t('welcomeStory.page3Step1')}
                </div>
                <div className="step-item">
                    <UilCheck className="step-icon" /> {t('welcomeStory.page3Step2')}
                </div>
                <div className="step-item">
                    <UilCheck className="step-icon" /> {t('welcomeStory.page3Step3')}
                </div>
            </div>
            {t('welcomeStory.page3ContentSuffix') && (
                <p className="story-text" style={{ marginTop: '1rem' }}>
                    {replaceUsername(t('welcomeStory.page3ContentSuffix'))}
                </p>
            )}
        </div>,

        // Page 4: The Rule (New)
        <div className="story-page" key="p3-rule">
            <h2 className="story-title">{t('welcomeStory.page3RuleTitle')}</h2>
            <div className="story-highlight-box" style={{ background: 'rgba(255, 100, 100, 0.1)', borderLeft: '4px solid #ff6b6b' }}>
                {/* nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml */}
                <p className="story-text" dangerouslySetInnerHTML={{ __html: t('welcomeStory.page3RuleContent1', { days: userData?.kickThreshold || DEFAULT_KICK_THRESHOLD }) }} />
            </div>
            <p className="story-text" style={{ marginTop: '1rem', fontSize: '0.95rem' }}>
                {t('welcomeStory.page3RuleContent2', { days: userData?.kickThreshold || DEFAULT_KICK_THRESHOLD })}
            </p>

        </div>,

        // Page 5: Vision
        <div className="story-page" key="p4">
            <h2 className="story-title">{t('welcomeStory.page4Title')}</h2>
            <div style={{ padding: '0 1rem' }}>
                <p className="story-quote">
                    {t('welcomeStory.page4Quote')}
                </p>
                <p className="story-text" style={{ fontStyle: 'italic', marginTop: '1rem' }}>
                    {replaceUsername(t('welcomeStory.page4Content'))}
                </p>
            </div>
        </div>,

        // Page 6: Start
        <div className="story-page" key="p5">
            <img src="/images/mascot.webp" alt="Welcome Bird" className="story-image" style={{ transform: 'scale(1.2)' }} />
            <h2 className="story-title">{t('welcomeStory.page5Title')}</h2>
            <p className="story-text" style={{ fontSize: '1.2rem' }}>
                {t('welcomeStory.page5Content')}
            </p>
        </div>
    ];

    return (
        <div className="welcome-story-overlay">
            <div className="welcome-story-content">
                <button className="welcome-story-close" onClick={onClose} aria-label="Close story">
                    <UilTimes size="24" />
                </button>

                {pages[page]}

                <div className="story-navigation">
                    <div className="story-buttons-container">
                        {page > 0 && (
                            <button className="story-btn secondary" onClick={handleBack}>
                                {t('welcomeStory.backButton')}
                            </button>
                        )}
                        <button 
                            className={`story-btn${!isNextVisible ? ' waiting' : ''}`}
                            onClick={handleNext}
                            disabled={!isNextVisible}
                        >
                            {page === 5 ? t('welcomeStory.startButton') : t('welcomeStory.nextButton')}
                        </button>
                    </div>

                    <div className="story-indicator">
                        {pages.map((_, idx) => (
                            <div key={idx} className={`dot ${idx === page ? 'active' : ''}`} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WelcomeStoryModal;


