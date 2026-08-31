import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTimeCapsule } from '../use-time-capsule';
import { UserData } from '../../types/user';

// Mock Firebase
vi.mock('../../firebase', () => ({
  db: {}
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn((_q, callback) => {
    // Return empty docs by default
    callback({ docs: [] });
    return () => {};
  }),
  doc: vi.fn(),
  setDoc: vi.fn().mockResolvedValue(undefined),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  serverTimestamp: vi.fn(() => 'MOCK_TIMESTAMP')
}));

describe('useTimeCapsule', () => {
  const mockUserData: UserData = {
    uid: 'test-user-123',
    nickname: 'TestUser',
    daysStudiedCount: 4
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('calculates nextTargetDays correctly for current days count', () => {
    const { result: r1 } = renderHook(() => useTimeCapsule({ ...mockUserData, daysStudiedCount: 4 }));
    expect(r1.current.nextTargetDays).toBe(10);

    const { result: r2 } = renderHook(() => useTimeCapsule({ ...mockUserData, daysStudiedCount: 10 }));
    expect(r2.current.nextTargetDays).toBe(25);

    const { result: r3 } = renderHook(() => useTimeCapsule({ ...mockUserData, daysStudiedCount: 32 }));
    expect(r3.current.nextTargetDays).toBe(50);
  });

  it('saves, loads, and clears drafts in localStorage', () => {
    const { result } = renderHook(() => useTimeCapsule(mockUserData));

    // Initially empty
    expect(result.current.getDraft(10)).toEqual({ content: '', sosMessage: '' });

    // Save draft
    act(() => {
      result.current.saveDraft(10, 'Hello Day 10!', 'Keep going!');
    });

    expect(result.current.getDraft(10)).toEqual({
      content: 'Hello Day 10!',
      sosMessage: 'Keep going!'
    });

    // Clear draft
    act(() => {
      result.current.clearDraft(10);
    });

    expect(result.current.getDraft(10)).toEqual({ content: '', sosMessage: '' });
  });

  it('handles anonymous demo users safely by not loading letters', () => {
    const demoUser: UserData = {
      uid: 'demo-uid',
      isAnonymousDemo: true,
      daysStudiedCount: 10
    };

    const { result } = renderHook(() => useTimeCapsule(demoUser));
    expect(result.current.sealedCapsule).toBeNull();
    expect(result.current.unlockedCapsules).toEqual([]);
    expect(result.current.loading).toBe(false);
  });
});
