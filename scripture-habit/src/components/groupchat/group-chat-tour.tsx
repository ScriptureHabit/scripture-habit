import { useState, useEffect, useRef } from 'react';
import '../tourguide/tour-guide.css';

interface GroupChatTourProps {
  isOpen: boolean;
  onClose: () => void;
  t: (key: string) => string;
}

const STEPS = [
  {
    selector: '[data-testid="new-note-button"]',
    titleKey: 'groupChat.groupChatTour.step1Title',
    descKey: 'groupChat.groupChatTour.step1Desc',
    placement: 'top' as const,
  },
  {
    selector: '.back-button',
    titleKey: 'groupChat.groupChatTour.step2Title',
    descKey: 'groupChat.groupChatTour.step2Desc',
    placement: 'bottom' as const,
  },
];

const GroupChatTour = ({ isOpen, onClose, t }: GroupChatTourProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState<{
    top: number; left: number; width: number; height: number;
  } | null>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const [popoverOnTop, setPopoverOnTop] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const step = STEPS[currentStep];

    let intervalId: ReturnType<typeof setInterval> | null = null;
    const update = () => {
      const el = document.querySelector(step.selector) as HTMLElement | null;
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;

      const padding = 8;
      setHighlightRect({
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });

      const popover = popoverRef.current;
      const popoverH = popover?.offsetHeight || 200;
      const popoverW = popover?.offsetWidth || 290;
      const vw = window.innerWidth;

      const isTop = step.placement === 'top' || rect.bottom + popoverH + 24 > window.innerHeight;
      setPopoverOnTop(isTop);

      const top = isTop
        ? Math.max(16, rect.top - padding - popoverH - 16)
        : rect.bottom + padding + 16;
      const left = Math.max(16, Math.min(rect.left + rect.width / 2 - popoverW / 2, vw - popoverW - 16));
      setPopoverStyle({ top, left });
      return true;
    };

    if (!update()) {
      intervalId = setInterval(() => {
        if (update() && intervalId) {
          clearInterval(intervalId);
        }
      }, 200);
    }

    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [isOpen, currentStep]);

  if (!isOpen) return null;

  const isLast = currentStep === STEPS.length - 1;
  const step = STEPS[currentStep];

  return (
    <div className="tour-guide-overlay" onClick={onClose}>
      {highlightRect && (
        <div
          className="tour-highlight-box"
          style={{
            top: highlightRect.top,
            left: highlightRect.left,
            width: highlightRect.width,
            height: highlightRect.height,
          }}
        />
      )}

      <div
        ref={popoverRef}
        className={`tour-popover-card ${popoverOnTop ? 'popover-on-top' : ''}`}
        style={popoverStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tour-popover-title">{t(step.titleKey)}</div>
        <div className="tour-popover-desc">{t(step.descKey)}</div>

        <div className="tour-popover-actions">
          <button className="tour-btn-action skip" onClick={() => { setCurrentStep(0); onClose(); }}>
            {t('tourGuide.skip')}
          </button>
          <div className="tour-btn-nav-group">
            {currentStep > 0 && (
              <button
                className="tour-btn-action back"
                onClick={() => setCurrentStep((s) => s - 1)}
              >
                {t('tourGuide.back')}
              </button>
            )}
            <button
              className="tour-btn-action next"
              onClick={() => {
                if (isLast) {
                  setCurrentStep(0);
                  onClose();
                } else {
                  setCurrentStep((s) => s + 1);
                }
              }}
            >
              {isLast ? t('tourGuide.finish') : t('tourGuide.next')}
            </button>
          </div>
        </div>

        <div className="tour-popover-indicator">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`tour-dot ${i === currentStep ? 'active' : ''}`}
              onClick={() => setCurrentStep(i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default GroupChatTour;
