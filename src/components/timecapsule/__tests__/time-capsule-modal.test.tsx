import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TimeCapsuleModal } from '../time-capsule-modal';
import { useTimeCapsuleStore } from '../../../store/use-time-capsule-store';
import { UserData } from '../../../types/user';

// Mock language hook
vi.mock('../../../hooks/use-language', () => ({
  useLanguage: () => ({
    t: (key: string, replacements?: any) => {
      if (key === 'timeCapsule.createTitle') return `Day ${replacements?.days}の自分へ手紙を書く`;
      if (key === 'timeCapsule.createSubtitle') return `合計${replacements?.days}日達成するまで大切に封印されます`;
      if (key === 'timeCapsule.letterSectionTitle') return `Day ${replacements?.days}達成した自分への手紙`;
      if (key === 'timeCapsule.sosSectionTitle') return 'サボりそうな時の自分へのSOS一言';
      if (key === 'timeCapsule.sealButton') return 'タイムカプセルを封印する';
      if (key === 'timeCapsule.charCount') return `${replacements?.current}/${replacements?.max}文字`;
      return key;
    }
  })
}));

const mockCreateTimeCapsule = vi.fn().mockResolvedValue(undefined);
const mockGetDraft = vi.fn().mockReturnValue({ content: '', sosMessage: '' });

vi.mock('../../../hooks/use-time-capsule', () => ({
  useTimeCapsule: () => ({
    getDraft: mockGetDraft,
    saveDraft: vi.fn(),
    createTimeCapsule: mockCreateTimeCapsule
  })
}));

vi.mock('../../../hooks/use-milestone-achiever-count', () => ({
  useMilestoneAchieverCount: () => ({
    count: 128,
    loading: false,
    hasEnoughAchievers: true
  })
}));

vi.mock('../../../utils/confetti-utils', () => ({
  triggerConfetti: vi.fn()
}));

describe('TimeCapsuleModal', () => {
  const mockUserData: UserData = {
    uid: 'user-123',
    nickname: 'TestUser',
    daysStudiedCount: 1
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useTimeCapsuleStore.getState().closeCreateModal();
  });

  it('does not render when isCreateOpen is false', () => {
    render(<TimeCapsuleModal userData={mockUserData} />);
    expect(screen.queryByTestId('time-capsule-modal-overlay')).toBeNull();
  });

  it('renders correctly when isCreateOpen is true including social proof badge', () => {
    useTimeCapsuleStore.getState().openCreateModal(10);
    render(<TimeCapsuleModal userData={mockUserData} />);

    expect(screen.getByTestId('time-capsule-modal-overlay')).toBeTruthy();
    expect(screen.getByText('Day 10の自分へ手紙を書く')).toBeTruthy();
    expect(screen.getByTestId('time-capsule-social-proof')).toBeTruthy();
    expect(screen.getByTestId('time-capsule-letter-input')).toBeTruthy();
    expect(screen.getByTestId('time-capsule-sos-input')).toBeTruthy();
    expect(screen.getByTestId('seal-time-capsule-btn')).toBeDisabled();
  });

  it('enables submit button when valid text is entered and calls createTimeCapsule', async () => {
    useTimeCapsuleStore.getState().openCreateModal(10);
    render(<TimeCapsuleModal userData={mockUserData} />);

    const letterInput = screen.getByTestId('time-capsule-letter-input');
    const sosInput = screen.getByTestId('time-capsule-sos-input');
    const submitBtn = screen.getByTestId('seal-time-capsule-btn');

    // Type valid content
    fireEvent.change(letterInput, { target: { value: '10日達成おめでとう！よく頑張ったね！' } });
    fireEvent.change(sosInput, { target: { value: '初心を思い出して！' } });

    await waitFor(() => {
      expect(submitBtn).not.toBeDisabled();
    });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateTimeCapsule).toHaveBeenCalledWith(10, '10日達成おめでとう！よく頑張ったね！', '初心を思い出して！');
    });
  });
});
