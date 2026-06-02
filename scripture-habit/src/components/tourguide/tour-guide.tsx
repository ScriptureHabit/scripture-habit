import React, { useState, useEffect, useRef, useCallback } from 'react';
import './tour-guide.css';
import { UserData } from '../../types/user';

interface TourStep {
    targetSelector: string;
    titleKey: string;
    descKey: string;
    placement: 'top' | 'bottom' | 'left' | 'right';
}

interface TourGuideProps {
    isOpen: boolean;
    onClose: () => void;
    t: (key: string, replacements?: Record<string, string | number>) => string;
    userData?: UserData;
}

const TourGuide: React.FC<TourGuideProps> = ({ isOpen, onClose, t, userData }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [nextDisabled, setNextDisabled] = useState(true);
    const [highlightRect, setHighlightRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
    const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
    const [popoverOnTop, setPopoverOnTop] = useState(false);
    const popoverRef = useRef<HTMLDivElement | null>(null);

    const steps = React.useMemo(() => {
        const list: TourStep[] = [
            {
                targetSelector: '.Sidebar',
                titleKey: 'tourGuide.titleStep1',
                descKey: 'tourGuide.descStep1',
                placement: 'right'
            }
        ];

        // Insert Quest step as Step 2 if user has not completed onboarding
        const hasCompletedOnboarding = userData?.hasCompletedOnboarding || 
            (userData && (userData.totalNotes && userData.totalNotes > 0) && 
            ((userData.groupIds && userData.groupIds.length > 0) || !!userData.groupId));

        if (userData && !hasCompletedOnboarding) {
            list.push({
                targetSelector: '.onboarding-quest-card',
                titleKey: 'tourGuide.titleQuest',
                descKey: 'tourGuide.descQuest',
                placement: 'bottom'
            });
        }

        list.push(
            {
                targetSelector: '.streak-card',
                titleKey: 'tourGuide.titleStep2',
                descKey: 'tourGuide.descStep2',
                placement: 'bottom'
            },
            {
                targetSelector: '.level-card',
                titleKey: 'tourGuide.titleStep3',
                descKey: 'tourGuide.descStep3',
                placement: 'bottom'
            },
            {
                targetSelector: '.reading-plan-card',
                titleKey: 'tourGuide.titleStep4',
                descKey: 'tourGuide.descStep4',
                placement: 'top'
            },
            {
                targetSelector: '.share-learning-cta',
                titleKey: 'tourGuide.titleStep5',
                descKey: 'tourGuide.descStep5',
                placement: 'top'
            },
            {
                targetSelector: '.streak-calendar-container',
                titleKey: 'tourGuide.titleStep6',
                descKey: 'tourGuide.descStep6',
                placement: 'top'
            }
        );

        return list;
    }, [userData]);

    const updatePosition = useCallback(() => {
        if (!isOpen) return;

        const step = steps[currentStep];
        if (!step) return;
        const element = document.querySelector(step.targetSelector) as HTMLElement;

        if (!element) {
            // Element not found (e.g. they scrolled or navigated away), let's clear highlight
            setHighlightRect(null);
            return;
        }

        const updatedRect = element.getBoundingClientRect();

        // Add padding around the highlighted widget
        const padding = 8;
        const top = updatedRect.top - padding;
        const left = updatedRect.left - padding;
        const width = updatedRect.width + padding * 2;
        const height = updatedRect.height + padding * 2;

        setHighlightRect({ top, left, width, height });

        // If the element is on the bottom half of the viewport, move popover to the top on mobile
        const midpoint = top + height / 2;
        const isBottomHalf = midpoint > window.innerHeight / 2;
        setPopoverOnTop(isBottomHalf);

        // Calculate popover positioning relative to highlighted element
        const popoverPadding = 16;
        let pStyle: React.CSSProperties = {};

        switch (step.placement) {
            case 'right':
                pStyle = {
                    top: `${top + height / 2}px`,
                    left: `${left + width + popoverPadding}px`,
                    transform: 'translateY(-50%)'
                };
                break;
            case 'bottom':
                pStyle = {
                    top: `${top + height + popoverPadding}px`,
                    left: `${left + width / 2}px`,
                    transform: 'translateX(-50%)'
                };
                break;
            case 'top':
                pStyle = {
                    top: `${top - popoverPadding}px`,
                    left: `${left + width / 2}px`,
                    transform: 'translateX(-50%) translateY(-100%)'
                };
                break;
            case 'left':
                pStyle = {
                    top: `${top + height / 2}px`,
                    left: `${left - popoverPadding}px`,
                    transform: 'translateY(-50%) translateX(-100%)'
                };
                break;
        }

        setPopoverStyle(pStyle);
    }, [isOpen, currentStep, steps]);

    // Scroll element into view and update position when active step changes
    useEffect(() => {
        if (!isOpen) return;

        const step = steps[currentStep];
        if (!step) return;
        const element = document.querySelector(step.targetSelector) as HTMLElement;
        if (element) {
            const isMobile = window.innerWidth <= 768;
            if (isMobile) {
                if (step.targetSelector !== '.Sidebar') {
                    // Always scroll to top on mobile to prevent overlapping with bottom-fixed popover card
                    element.scrollIntoView({ block: 'start' });
                }
            } else {
                const rect = element.getBoundingClientRect();
                const isOffScreen = rect.top < 0 || rect.bottom > window.innerHeight;
                if (isOffScreen && step.targetSelector !== '.Sidebar') {
                    element.scrollIntoView({ block: 'center' });
                }
            }
        }

        // Rapid polling to keep coordinates perfectly aligned as layout/scrolling settles
        updatePosition();
        const intervalId = setInterval(updatePosition, 30);
        const timeoutId = setTimeout(() => {
            clearInterval(intervalId);
        }, 1000);

        return () => {
            clearInterval(intervalId);
            clearTimeout(timeoutId);
        };
    }, [isOpen, currentStep, updatePosition, steps]);

    // Handle resize and scroll events to keep position synced
    useEffect(() => {
        if (isOpen) {
            window.addEventListener('resize', updatePosition);
            window.addEventListener('scroll', updatePosition, true);

            return () => {
                window.removeEventListener('resize', updatePosition);
                window.removeEventListener('scroll', updatePosition, true);
            };
        }
    }, [isOpen, updatePosition]);

    // Disable Next button for 1 second on each step change
    useEffect(() => {
        if (!isOpen) return;
        setNextDisabled(true);
        const timer = setTimeout(() => setNextDisabled(false), 1000);
        return () => clearTimeout(timer);
    }, [currentStep, isOpen]);

    if (!isOpen) return null;

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            onClose();
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const step = steps[currentStep];
    if (!step) return null;

    return (
        <div className="tour-guide-overlay">
            {/* The Cutout Mask Box */}
            {highlightRect && (
                <div 
                    className="tour-highlight-box"
                    style={{
                        top: `${highlightRect.top}px`,
                        left: `${highlightRect.left}px`,
                        width: `${highlightRect.width}px`,
                        height: `${highlightRect.height}px`
                    }}
                />
            )}

            {/* The Floating Popover Wizard */}
            {highlightRect && (
                <div 
                    ref={popoverRef}
                    className={`tour-popover-card ${popoverOnTop ? 'popover-on-top' : ''}`}
                    style={popoverStyle}
                >
                    <div className="tour-popover-arrow" data-placement={step.placement} />
                    <h3 className="tour-popover-title">{t(step.titleKey)}</h3>
                    <p className="tour-popover-desc">{t(step.descKey)}</p>
                    
                    <div className="tour-popover-actions">
                        <button className="tour-btn-action skip" onClick={onClose}>
                            {t('tourGuide.skip')}
                        </button>
                        
                        <div className="tour-btn-nav-group">
                            {currentStep > 0 && (
                                <button className="tour-btn-action back" onClick={handleBack}>
                                    {t('tourGuide.back')}
                                </button>
                            )}
                            <button
                                className={`tour-btn-action next${nextDisabled ? ' disabled' : ''}`}
                                onClick={handleNext}
                                disabled={nextDisabled}
                            >
                                {currentStep === steps.length - 1 ? t('tourGuide.finish') : t('tourGuide.next')}
                            </button>
                        </div>
                    </div>

                    <div className="tour-popover-indicator">
                        {steps.map((_, idx) => (
                            <div 
                                key={idx} 
                                className={`tour-dot ${idx === currentStep ? 'active' : ''}`} 
                                onClick={() => setCurrentStep(idx)}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TourGuide;


