import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TimeCapsuleModal } from '../time-capsule-modal';
import { TimeCapsuleUnlockModal } from '../time-capsule-unlock-modal';
import { TimeCapsuleCard } from '../../dashboard/components/time-capsule-card';
import { useTimeCapsuleStore } from '../../../store/use-time-capsule-store';
import { UserData } from '../../../types/user';
import { TimeCapsule } from '../../../types/time-capsule';

// Mock Language
vi.mock('../../../hooks/use-language', () => ({
  useLanguage: () => ({
    t: (key: string, replacements?: any) => {
      if (key === 'timeCapsule.createTitle') return `Day ${replacements?.days}の自分へ手紙を書く`;
      if (key === 'timeCapsule.charCount') return `${replacements?.current}/${replacements?.max}文字`;
      if (key === 'timeCapsule.unlockTitle') return 'タイムカプセル開封！';
      if (key === 'timeCapsule.writeNextLetter') return `次のDay ${replacements?.nextDays}の自分へ手紙を書く`;
      if (key === 'timeCapsule.createdOn') return `作成日: ${replacements?.date} (当時: ${replacements?.days}日目 / Lv.${replacements?.level})`;
      if (key === 'timeCapsule.cardNoLetterTitle') return `Day ${replacements?.days}への手紙がまだありません`;
      if (key === 'timeCapsule.cardSealedTitle') return `Day ${replacements?.days}のタイムカプセル封印中`;
      if (key === 'timeCapsule.cardSosTitle') return 'サボりそうなあなたへ：過去の自分からの言葉';
      if (key === 'timeCapsule.socialProofCount') return `今まで${replacements?.count}名の仲間がDay ${replacements?.days}を達成しました！`;
      if (key === 'timeCapsule.socialProofChallengers') return `世界中の仲間がDay ${replacements?.days}を目指して挑戦中！`;
      return key;
    }
  })
}));

const mockCreateTimeCapsule = vi.fn().mockResolvedValue(undefined);
const mockGetDraft = vi.fn();
const mockSaveDraft = vi.fn();
const mockClearDraft = vi.fn();
const mockUseTimeCapsuleHook = vi.fn();
const mockUseMilestoneAchieverCount = vi.fn();

vi.mock('../../../hooks/use-time-capsule', () => ({
  useTimeCapsule: (userData: any) => mockUseTimeCapsuleHook(userData)
}));

vi.mock('../../../hooks/use-milestone-achiever-count', () => ({
  useMilestoneAchieverCount: (targetDays: number) => mockUseMilestoneAchieverCount(targetDays)
}));

vi.mock('../../../utils/confetti-utils', () => ({
  triggerConfetti: vi.fn()
}));

describe('Time Capsule Comprehensive Scenario & Edge Case Testing', () => {
  const mockUserData: UserData = {
    uid: 'user-comprehensive',
    nickname: 'HeroUser',
    daysStudiedCount: 4,
    hasCompletedOnboarding: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useTimeCapsuleStore.getState().closeCreateModal();
    useTimeCapsuleStore.getState().closeUnlockModal();

    mockGetDraft.mockReturnValue({ content: '', sosMessage: '' });
    mockUseTimeCapsuleHook.mockReturnValue({
      sealedCapsule: null,
      unlockedCapsules: [],
      nextTargetDays: 10,
      activeSosMessage: null,
      getDraft: mockGetDraft,
      saveDraft: mockSaveDraft,
      clearDraft: mockClearDraft,
      createTimeCapsule: mockCreateTimeCapsule
    });

    mockUseMilestoneAchieverCount.mockReturnValue({
      count: 128,
      loading: false,
      hasEnoughAchievers: true
    });
  });

  describe('0. Social Proof Badge (Achiever Count & Challengers)', () => {
    it('displays social proof message when achiever count is 3 or more', () => {
      mockUseMilestoneAchieverCount.mockReturnValue({
        count: 128,
        loading: false,
        hasEnoughAchievers: true
      });

      useTimeCapsuleStore.getState().openCreateModal(10);
      render(<TimeCapsuleModal userData={mockUserData} />);

      expect(screen.getByTestId('time-capsule-social-proof')).toBeTruthy();
      expect(screen.getByText('✨ 今まで128名の仲間がDay 10を達成しました！')).toBeTruthy();
    });

    it('displays challenger encouragement message when achiever count is less than 3', () => {
      mockUseMilestoneAchieverCount.mockReturnValue({
        count: 1,
        loading: false,
        hasEnoughAchievers: false
      });

      useTimeCapsuleStore.getState().openCreateModal(100);
      render(<TimeCapsuleModal userData={mockUserData} />);

      expect(screen.getByTestId('time-capsule-social-proof')).toBeTruthy();
      expect(screen.getByText('🌱 世界中の仲間がDay 100を目指して挑戦中！')).toBeTruthy();
    });
  });

  describe('1. Character Length Boundary & Validation Scenarios', () => {
    it('disallows submission when content length is below 5 characters or SOS is below 3 characters', async () => {
      useTimeCapsuleStore.getState().openCreateModal(10);
      render(<TimeCapsuleModal userData={mockUserData} />);

      const letterInput = screen.getByTestId('time-capsule-letter-input');
      const sosInput = screen.getByTestId('time-capsule-sos-input');
      const submitBtn = screen.getByTestId('seal-time-capsule-btn');

      // 0 chars
      expect(submitBtn).toBeDisabled();

      // 4 chars content (boundary: 1 char too short)
      fireEvent.change(letterInput, { target: { value: '1234' } });
      fireEvent.change(sosInput, { target: { value: '123' } });
      expect(submitBtn).toBeDisabled();

      // 5 chars content & 2 chars SOS (SOS boundary: 1 char too short)
      fireEvent.change(letterInput, { target: { value: '12345' } });
      fireEvent.change(sosInput, { target: { value: '12' } });
      expect(submitBtn).toBeDisabled();

      // 5 chars content & 3 chars SOS (exact minimum valid boundary)
      fireEvent.change(letterInput, { target: { value: '12345' } });
      fireEvent.change(sosInput, { target: { value: '123' } });

      await waitFor(() => {
        expect(submitBtn).not.toBeDisabled();
      });
    });

    it('enforces maximum character constraints by clamping input at 500 and 100 characters', async () => {
      useTimeCapsuleStore.getState().openCreateModal(10);
      render(<TimeCapsuleModal userData={mockUserData} />);

      const letterInput = screen.getByTestId('time-capsule-letter-input');
      const sosInput = screen.getByTestId('time-capsule-sos-input');

      const over500Chars = 'a'.repeat(600);
      const over100Chars = 'b'.repeat(150);

      fireEvent.change(letterInput, { target: { value: over500Chars } });
      fireEvent.change(sosInput, { target: { value: over100Chars } });

      expect(mockSaveDraft).toHaveBeenCalledWith(10, 'a'.repeat(500), 'b'.repeat(100));
    });
  });

  describe('2. Draft Auto-save and Modal Re-open Scenarios', () => {
    it('restores draft data when modal is reopened', () => {
      mockGetDraft.mockReturnValue({
        content: 'Draft content for future me',
        sosMessage: 'Draft SOS'
      });

      useTimeCapsuleStore.getState().openCreateModal(25);
      render(<TimeCapsuleModal userData={mockUserData} />);

      const letterInput = screen.getByTestId('time-capsule-letter-input') as HTMLTextAreaElement;
      const sosInput = screen.getByTestId('time-capsule-sos-input') as HTMLTextAreaElement;

      expect(letterInput.value).toBe('Draft content for future me');
      expect(sosInput.value).toBe('Draft SOS');
    });
  });

  describe('3. Milestone Achievement, Unlock Modal & Next Target Transition', () => {
    const mockCapsule: TimeCapsule = {
      id: 'capsule_10',
      type: 'time_capsule',
      targetDays: 10,
      title: 'Day 10の自分へ',
      content: 'You reached 10 days! Great job!',
      sosMessage: 'Do not quit!',
      isUnlocked: true,
      createdAt: {} as any,
      createdStats: {
        days: 1,
        level: 1,
        date: '2026.08.31'
      }
    };

    it('renders unlocked capsule details and transitions to next milestone letter creation (Day 25)', () => {
      useTimeCapsuleStore.getState().openUnlockModal(mockCapsule);
      render(<TimeCapsuleUnlockModal />);

      expect(screen.getByTestId('time-capsule-unlock-overlay')).toBeTruthy();
      expect(screen.getByText('You reached 10 days! Great job!')).toBeTruthy();
      expect(screen.getByText('作成日: 2026.08.31 (当時: 1日目 / Lv.1)')).toBeTruthy();

      const nextBtn = screen.getByTestId('write-next-capsule-btn');
      expect(nextBtn).toBeTruthy();
      expect(screen.getByText('次のDay 25の自分へ手紙を書く')).toBeTruthy();

      fireEvent.click(nextBtn);

      // Unlock modal closed and Create modal opened with Day 25 target
      expect(useTimeCapsuleStore.getState().isUnlockOpen).toBe(false);
      expect(useTimeCapsuleStore.getState().isCreateOpen).toBe(true);
      expect(useTimeCapsuleStore.getState().targetDays).toBe(25);
    });
  });

  describe('4. Crisis SOS Warning vs Normal Progress Switching', () => {
    it('seamlessly switches between SOS warning and normal progress cards based on hours remaining', () => {
      // 1. Normal state: 48h remaining (No warning banner)
      mockUseTimeCapsuleHook.mockReturnValue({
        sealedCapsule: { id: 'capsule_10', targetDays: 10, isUnlocked: false },
        nextTargetDays: 10,
        activeSosMessage: 'Keep going!'
      });

      const { rerender } = render(<TimeCapsuleCard userData={mockUserData} warnings={[]} />);
      expect(screen.getByTestId('time-capsule-sealed-card')).toBeTruthy();
      expect(screen.queryByTestId('time-capsule-sos-card')).toBeNull();

      // 2. Crisis state: Warning present (<24h remaining)
      rerender(
        <TimeCapsuleCard
          userData={mockUserData}
          warnings={[{ name: 'MyGroup', hoursRemaining: 8 }]}
        />
      );
      expect(screen.getByTestId('time-capsule-sos-card')).toBeTruthy();
      expect(screen.getByText('"Keep going!"')).toBeTruthy();

      // 3. Recovery: User posted note, warning cleared
      rerender(<TimeCapsuleCard userData={mockUserData} warnings={[]} />);
      expect(screen.getByTestId('time-capsule-sealed-card')).toBeTruthy();
      expect(screen.queryByTestId('time-capsule-sos-card')).toBeNull();
    });
  });
});
