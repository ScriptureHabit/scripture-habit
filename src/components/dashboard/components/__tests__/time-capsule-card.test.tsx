import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimeCapsuleCard } from '../time-capsule-card';
import { useTimeCapsuleStore } from '../../../../store/use-time-capsule-store';
import { UserData } from '../../../../types/user';

const mockUseTimeCapsule = vi.fn();

vi.mock('../../../../hooks/use-time-capsule', () => ({
  useTimeCapsule: () => mockUseTimeCapsule()
}));

vi.mock('../../../../hooks/use-language', () => ({
  useLanguage: () => ({
    t: (key: string, replacements?: any) => {
      if (key === 'timeCapsule.cardNoLetterTitle') return `Day ${replacements?.days}への手紙がまだありません`;
      if (key === 'timeCapsule.cardSealedTitle') return `Day ${replacements?.days}のタイムカプセル封印中`;
      if (key === 'timeCapsule.cardSosTitle') return 'サボりそうなあなたへ：過去の自分からの言葉';
      if (key === 'timeCapsule.writeLetterBtn') return '手紙を書く';
      if (key === 'timeCapsule.postNowBtn') return '今すぐ投稿する';
      return key;
    }
  })
}));

describe('TimeCapsuleCard', () => {
  const mockUserData: UserData = {
    uid: 'user-123',
    nickname: 'TestUser',
    daysStudiedCount: 4,
    hasCompletedOnboarding: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render for anonymous demo users', () => {
    mockUseTimeCapsule.mockReturnValue({
      sealedCapsule: null,
      nextTargetDays: 10,
      activeSosMessage: null
    });

    render(
      <TimeCapsuleCard
        userData={{ ...mockUserData, isAnonymousDemo: true }}
      />
    );

    expect(screen.queryByTestId('time-capsule-unwritten-card')).toBeNull();
    expect(screen.queryByTestId('time-capsule-sealed-card')).toBeNull();
  });

  it('renders unwritten card when user has no active sealed capsule', () => {
    mockUseTimeCapsule.mockReturnValue({
      sealedCapsule: null,
      nextTargetDays: 10,
      activeSosMessage: null
    });

    render(<TimeCapsuleCard userData={mockUserData} />);

    expect(screen.getByTestId('time-capsule-unwritten-card')).toBeTruthy();
    expect(screen.getByText('Day 10への手紙がまだありません')).toBeTruthy();

    const writeBtn = screen.getByTestId('write-capsule-card-btn');
    fireEvent.click(writeBtn);
    expect(useTimeCapsuleStore.getState().isCreateOpen).toBe(true);
    expect(useTimeCapsuleStore.getState().targetDays).toBe(10);
  });

  it('renders sealed card when user has an active sealed capsule', () => {
    mockUseTimeCapsule.mockReturnValue({
      sealedCapsule: {
        id: 'capsule_10',
        targetDays: 10,
        title: 'Day 10の自分へ',
        content: 'Letter body',
        sosMessage: 'SOS message',
        isUnlocked: false
      },
      nextTargetDays: 10,
      activeSosMessage: 'SOS message'
    });

    render(<TimeCapsuleCard userData={mockUserData} warnings={[]} />);

    expect(screen.getByTestId('time-capsule-sealed-card')).toBeTruthy();
    expect(screen.getByText('Day 10のタイムカプセル封印中')).toBeTruthy();
    expect(screen.getByText('あと 6日')).toBeTruthy();
  });

  it('calculates progress correctly within the milestone interval for Day 300', () => {
    mockUseTimeCapsule.mockReturnValue({
      sealedCapsule: {
        id: 'capsule_300',
        targetDays: 300,
        title: 'Day 300の自分へ',
        content: 'Letter body',
        sosMessage: 'SOS message',
        isUnlocked: false,
        createdStats: {
          days: 275,
          level: 40,
          date: '2026.09.04'
        }
      },
      nextTargetDays: 300,
      activeSosMessage: null
    });

    const { container, rerender } = render(
      <TimeCapsuleCard userData={{ ...mockUserData, daysStudiedCount: 275 }} warnings={[]} />
    );

    // At Day 275 (start of 275->300 interval, 25 days remaining), progress should be 0%
    const progressBarFill = container.querySelector('.sealed-progress-bar-fill') as HTMLElement;
    expect(progressBarFill).toBeTruthy();
    expect(progressBarFill.style.width).toBe('0%');

    // After studying 10 more days (Day 285, 15 days remaining), progress should be (10 / 25) = 40%
    rerender(
      <TimeCapsuleCard userData={{ ...mockUserData, daysStudiedCount: 285 }} warnings={[]} />
    );
    expect(progressBarFill.style.width).toBe('40%');
  });

  it('renders SOS crisis card when warnings exist and activeSosMessage is available', () => {
    mockUseTimeCapsule.mockReturnValue({
      sealedCapsule: {
        id: 'capsule_10',
        targetDays: 10,
        isUnlocked: false
      },
      nextTargetDays: 10,
      activeSosMessage: '初心を思い出して！'
    });

    render(
      <TimeCapsuleCard
        userData={mockUserData}
        warnings={[{ name: 'TestGroup', hoursRemaining: 5 }]}
      />
    );

    expect(screen.getByTestId('time-capsule-sos-card')).toBeTruthy();
    expect(screen.getByText('"初心を思い出して！"')).toBeTruthy();
    expect(screen.getByText('サボりそうなあなたへ：過去の自分からの言葉')).toBeTruthy();
  });
});
