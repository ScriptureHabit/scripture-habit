import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LevelUpModal from '../level-up-modal';
import LevelUpCard from '../level-up-card';
import { useLevelUpStore } from '../../../store/use-level-up-store';
import { useMilestoneStore } from '../../../store/use-milestone-store';
import { toast } from 'react-toastify';
import { triggerConfetti } from '../../../utils/confetti-utils';

vi.mock('react-toastify', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('../../../utils/confetti-utils', () => ({
    triggerConfetti: vi.fn(),
}));

vi.mock('html-to-image', () => ({
    toPng: vi.fn().mockResolvedValue('data:image/png;base64,mockPngData'),
    toBlob: vi.fn().mockResolvedValue(new Blob(['mock-blob'], { type: 'image/png' })),
}));

vi.mock('../../../hooks/use-language', () => ({
    useLanguage: () => ({
        t: (key: string, replacements?: Record<string, any>) => {
            if (key === 'levelUp.title') return `Level ${replacements?.level} 達成！`;
            if (key === 'levelUp.daysStudied') return `${replacements?.days} DAYS`;
            if (key === 'levelUp.speechBubbleLine1') return `Lv.${replacements?.level}達成おめでとう！✨`;
            if (key === 'levelUp.speechBubbleLine2') return 'すごい！';
            if (key === 'levelUp.shareText') return `Level ${replacements?.level} reached (${replacements?.days} days)`;
            if (key === 'levelUp.saveImage') return '画像を保存';
            if (key === 'levelUp.imageSaved') return '画像を保存しました';
            if (key === 'levelUp.share') return 'シェア';
            if (key === 'levelUp.label') return 'レベルアップ';
            if (key === 'common.close') return '閉じる';
            return key;
        },
        language: 'ja'
    })
}));

describe('LevelUpCard', () => {
    it('renders level and days correctly with appropriate tier class', () => {
        render(<LevelUpCard level={5} days={35} nickname="Test User" achievedDate="2026.09.02" />);
        expect(screen.getByText('5')).toBeDefined();
        expect(screen.getByText('35 DAYS')).toBeDefined();
        expect(screen.getByText('Test User')).toBeDefined();
        expect(screen.getByText('2026.09.02')).toBeDefined();

        const card = screen.getByTestId('level-up-card');
        expect(card.className).toContain('tier-gold');
    });

    it('renders the speech bubble with celebration text', () => {
        render(<LevelUpCard level={3} days={21} />);
        const bubble = screen.getByTestId('level-up-speech-bubble');
        expect(bubble).toBeDefined();
        expect(screen.getByText('Lv.3達成おめでとう！✨')).toBeDefined();
        expect(screen.getByText('すごい！')).toBeDefined();
    });
});

describe('LevelUpModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useLevelUpStore.setState({
            isOpen: false,
            levelUpData: null,
            pendingMilestone: null
        });
    });

    it('renders nothing when closed', () => {
        const { container } = render(<LevelUpModal />);
        expect(container.firstChild).toBeNull();
    });

    it('renders modal when open in store and triggers confetti', () => {
        act(() => {
            useLevelUpStore.getState().openLevelUp({
                level: 2,
                days: 7,
                nickname: 'Hero'
            });
        });

        render(<LevelUpModal />);
        expect(screen.getByText('Level 2 達成！')).toBeDefined();
        expect(screen.getByText('7 DAYS')).toBeDefined();
        expect(screen.getByText('Hero')).toBeDefined();
        expect(triggerConfetti).toHaveBeenCalled();
    });

    it('closes modal when close button is clicked', () => {
        act(() => {
            useLevelUpStore.getState().openLevelUp({
                level: 3,
                days: 14,
                nickname: 'Hero'
            });
        });

        render(<LevelUpModal />);
        const closeBtn = screen.getByTestId('level-up-close-btn');
        fireEvent.click(closeBtn);

        expect(useLevelUpStore.getState().isOpen).toBe(false);
    });

    it('calls save image flow when clicking save button', async () => {
        act(() => {
            useLevelUpStore.getState().openLevelUp({
                level: 2,
                days: 7,
                nickname: 'Hero'
            });
        });

        render(<LevelUpModal />);
        const saveBtn = screen.getByTestId('save-level-up-img-btn');
        await act(async () => {
            fireEvent.click(saveBtn);
        });

        expect(toast.success).toHaveBeenCalledWith('画像を保存しました');
    });

    it('triggers pending milestone after level up modal closes', async () => {
        vi.useFakeTimers();
        const openMilestoneSpy = vi.spyOn(useMilestoneStore.getState(), 'openMilestone');

        act(() => {
            useLevelUpStore.getState().openLevelUp(
                { level: 26, days: 175, nickname: 'Hero' },
                { days: 175, nickname: 'Hero' }
            );
        });

        render(<LevelUpModal />);
        const closeBtn = screen.getByTestId('level-up-close-btn');
        fireEvent.click(closeBtn);

        act(() => {
            vi.advanceTimersByTime(350);
        });

        expect(openMilestoneSpy).toHaveBeenCalledWith({
            days: 175,
            nickname: 'Hero'
        });
        vi.useRealTimers();
    });
});
