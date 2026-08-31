import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMilestoneAchieverCount } from '../use-milestone-achiever-count';

const mockGetCountFromServer = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getCountFromServer: (...args: any[]) => mockGetCountFromServer(...args)
}));

vi.mock('../../firebase', () => ({
  db: {}
}));

describe('useMilestoneAchieverCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns count and hasEnoughAchievers = true when 3 or more users have achieved the milestone', async () => {
    mockGetCountFromServer.mockResolvedValueOnce({
      data: () => ({ count: 15 })
    });

    const { result } = renderHook(() => useMilestoneAchieverCount(10));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.count).toBe(15);
    expect(result.current.hasEnoughAchievers).toBe(true);
    expect(mockGetCountFromServer).toHaveBeenCalledTimes(1);
  });

  it('returns hasEnoughAchievers = false when fewer than 3 users have achieved the milestone', async () => {
    mockGetCountFromServer.mockResolvedValueOnce({
      data: () => ({ count: 2 })
    });

    const { result } = renderHook(() => useMilestoneAchieverCount(500));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.count).toBe(2);
    expect(result.current.hasEnoughAchievers).toBe(false);
  });

  it('handles targetDays <= 0 gracefully without making firestore calls', () => {
    const { result } = renderHook(() => useMilestoneAchieverCount(0));

    expect(result.current.count).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.hasEnoughAchievers).toBe(false);
    expect(mockGetCountFromServer).not.toHaveBeenCalled();
  });

  it('handles firestore errors safely without throwing exceptions', async () => {
    mockGetCountFromServer.mockRejectedValueOnce(new Error('Network offline'));

    const { result } = renderHook(() => useMilestoneAchieverCount(75));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.count).toBeNull();
    expect(result.current.hasEnoughAchievers).toBe(false);
  });
});
