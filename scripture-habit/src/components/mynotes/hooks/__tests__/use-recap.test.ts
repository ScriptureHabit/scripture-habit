import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRecapOperations } from '../use-recap';
import apiClient from '../../../../utils/api-client';
import { toast } from 'react-toastify';
import { UserData } from '../../../../types/user';

// Mock dependencies
vi.mock('../../../../utils/api-client', () => ({
  default: {
    post: vi.fn(),
  },
}));

vi.mock('../../../../firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  serverTimestamp: vi.fn(() => 'mock-timestamp'),
  collection: vi.fn(),
  addDoc: vi.fn().mockResolvedValue({ id: 'mock-doc-id' }),
}));

vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('useRecapOperations Cooldown Logic', () => {
  const mockT = (key: string) => key;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createUserData = (lastRecapGeneratedAt: Date | null): UserData => {
    return {
      uid: 'user123',
      email: 'test@example.com',
      nickname: 'Test User',
      createdAt: new Date().toISOString(),
      lastRecapGeneratedAt: lastRecapGeneratedAt ? lastRecapGeneratedAt.toISOString() : undefined,
    } as unknown as UserData;
  };

  it('should trigger cooldown (isWithinCooldown = true) if recap was generated exactly 5.9 days ago', async () => {
    // 5.9 days ago (5 days, 21.6 hours ago)
    const lastGeneratedDate = new Date(Date.now() - 5.9 * 24 * 60 * 60 * 1000);
    const userData = createUserData(lastGeneratedDate);

    vi.mocked(apiClient.post).mockResolvedValue({ data: { recap: 'Cached Recap', fromCache: true } });

    const { result } = renderHook(() => useRecapOperations(userData, 'en', mockT));

    let recap: { text: string; fromCache: boolean } | null = null;
    await act(async () => {
      recap = await result.current.generateRecap(0);
    });

    // It should invoke the API to fetch the cached recap (because isWithinCooldown is true)
    expect(toast.info).toHaveBeenCalledWith('myNotes.fetchingRecentRecap');
    expect(apiClient.post).toHaveBeenCalledWith('/api/ai/generate-personal-weekly-recap', {
      uid: 'user123',
      language: 'en'
    }, expect.any(Object));
    expect(recap).toEqual({ text: 'Cached Recap', fromCache: true });
  });

  it('should trigger cooldown (isWithinCooldown = true) if recap was generated exactly 5.0 days ago', async () => {
    // 5.0 days ago
    const lastGeneratedDate = new Date(Date.now() - 5.0 * 24 * 60 * 60 * 1000);
    const userData = createUserData(lastGeneratedDate);

    vi.mocked(apiClient.post).mockResolvedValue({ data: { recap: 'Cached Recap', fromCache: true } });

    const { result } = renderHook(() => useRecapOperations(userData, 'en', mockT));

    let recap: { text: string; fromCache: boolean } | null = null;
    await act(async () => {
      recap = await result.current.generateRecap(0);
    });

    expect(toast.info).toHaveBeenCalledWith('myNotes.fetchingRecentRecap');
    expect(apiClient.post).toHaveBeenCalled();
    expect(recap).toEqual({ text: 'Cached Recap', fromCache: true });
  });

  it('should NOT trigger cooldown (isWithinCooldown = false) if recap was generated exactly 6.0 days ago', async () => {
    // Exactly 6.0 days ago
    const lastGeneratedDate = new Date(Date.now() - 6.0 * 24 * 60 * 60 * 1000);
    const userData = createUserData(lastGeneratedDate);

    vi.mocked(apiClient.post).mockResolvedValue({ data: { recap: 'New Recap Text', fromCache: false } });

    const { result } = renderHook(() => useRecapOperations(userData, 'en', mockT));

    let recap: { text: string; fromCache: boolean } | null = null;
    await act(async () => {
      recap = await result.current.generateRecap(5); // 5 notes
    });

    // Since cooldown is over, it should try to generate a NEW recap
    expect(toast.info).toHaveBeenCalledWith('myNotes.generatingRecap');
    expect(apiClient.post).toHaveBeenCalled();
    expect(recap).toEqual({ text: 'New Recap Text', fromCache: false });
  });

  it('should NOT trigger cooldown (isWithinCooldown = false) if recap was generated 6.1 days ago', async () => {
    // 6.1 days ago
    const lastGeneratedDate = new Date(Date.now() - 6.1 * 24 * 60 * 60 * 1000);
    const userData = createUserData(lastGeneratedDate);

    vi.mocked(apiClient.post).mockResolvedValue({ data: { recap: 'New Recap Text', fromCache: false } });

    const { result } = renderHook(() => useRecapOperations(userData, 'en', mockT));

    let recap: { text: string; fromCache: boolean } | null = null;
    await act(async () => {
      recap = await result.current.generateRecap(5); // 5 notes
    });

    expect(toast.info).toHaveBeenCalledWith('myNotes.generatingRecap');
    expect(apiClient.post).toHaveBeenCalled();
    expect(recap).toEqual({ text: 'New Recap Text', fromCache: false });
  });
});
