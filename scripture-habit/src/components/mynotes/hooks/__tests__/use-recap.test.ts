import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRecapOperations, useRecap } from '../use-recap';
import apiClient from '../../../../utils/api-client';
import { toast } from 'react-toastify';
import { UserData } from '../../../../types/user';
import { addDoc, updateDoc } from 'firebase/firestore';

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
    const lastGeneratedDate = new Date(Date.now() - 5.9 * 24 * 60 * 60 * 1000);
    const userData = createUserData(lastGeneratedDate);

    vi.mocked(apiClient.post).mockResolvedValue({ data: { recap: 'Cached Recap', fromCache: true } });

    const { result } = renderHook(() => useRecapOperations(userData, 'en', mockT));

    let recap: { text: string; fromCache: boolean } | null = null;
    await act(async () => {
      recap = await result.current.generateRecap(0);
    });

    expect(toast.info).toHaveBeenCalledWith('myNotes.fetchingRecentRecap');
    expect(apiClient.post).toHaveBeenCalledWith('/api/ai/generate-personal-weekly-recap', {
      uid: 'user123',
      language: 'en'
    }, expect.any(Object));
    expect(recap).toEqual({ text: 'Cached Recap', fromCache: true });
  });

  it('should trigger cooldown (isWithinCooldown = true) if recap was generated exactly 5.0 days ago', async () => {
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
    const lastGeneratedDate = new Date(Date.now() - 6.0 * 24 * 60 * 60 * 1000);
    const userData = createUserData(lastGeneratedDate);

    vi.mocked(apiClient.post).mockResolvedValue({ data: { recap: 'New Recap Text', fromCache: false } });

    const { result } = renderHook(() => useRecapOperations(userData, 'en', mockT));

    let recap: { text: string; fromCache: boolean } | null = null;
    await act(async () => {
      recap = await result.current.generateRecap(5);
    });

    expect(toast.info).toHaveBeenCalledWith('myNotes.generatingRecap');
    expect(apiClient.post).toHaveBeenCalled();
    expect(recap).toEqual({ text: 'New Recap Text', fromCache: false });
  });

  it('should NOT trigger cooldown (isWithinCooldown = false) if recap was generated 6.1 days ago', async () => {
    const lastGeneratedDate = new Date(Date.now() - 6.1 * 24 * 60 * 60 * 1000);
    const userData = createUserData(lastGeneratedDate);

    vi.mocked(apiClient.post).mockResolvedValue({ data: { recap: 'New Recap Text', fromCache: false } });

    const { result } = renderHook(() => useRecapOperations(userData, 'en', mockT));

    let recap: { text: string; fromCache: boolean } | null = null;
    await act(async () => {
      recap = await result.current.generateRecap(5);
    });

    expect(toast.info).toHaveBeenCalledWith('myNotes.generatingRecap');
    expect(apiClient.post).toHaveBeenCalled();
    expect(recap).toEqual({ text: 'New Recap Text', fromCache: false });
  });

  it('should return null and show toast if not in cooldown and notesCount is 0', async () => {
    const lastGeneratedDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const userData = createUserData(lastGeneratedDate);

    const { result } = renderHook(() => useRecapOperations(userData, 'en', mockT));

    let recap: { text: string; fromCache: boolean } | null = null;
    await act(async () => {
      recap = await result.current.generateRecap(0);
    });

    expect(toast.info).toHaveBeenCalledWith('myNotes.noNotesForRecap');
    expect(recap).toBeNull();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('should handle API response without a recap by showing message or default toast', async () => {
    const userData = createUserData(null);
    vi.mocked(apiClient.post).mockResolvedValue({ data: { message: 'Custom API warning' } });

    const { result } = renderHook(() => useRecapOperations(userData, 'en', mockT));

    let recap: { text: string; fromCache: boolean } | null = null;
    await act(async () => {
      recap = await result.current.generateRecap(5);
    });

    expect(toast.info).toHaveBeenCalledWith('Custom API warning');
    expect(recap).toBeNull();
  });

  it('should handle API response without recap and without custom message', async () => {
    const userData = createUserData(null);
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });

    const { result } = renderHook(() => useRecapOperations(userData, 'en', mockT));

    let recap: { text: string; fromCache: boolean } | null = null;
    await act(async () => {
      recap = await result.current.generateRecap(5);
    });

    expect(toast.info).toHaveBeenCalledWith('myNotes.noNotesForRecap');
    expect(recap).toBeNull();
  });

  it('should handle API errors by logging, showing error toast, and returning null', async () => {
    const userData = createUserData(null);
    const apiError = new Error('Network failure');
    vi.mocked(apiClient.post).mockRejectedValue(apiError);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useRecapOperations(userData, 'en', mockT));

    let recap: { text: string; fromCache: boolean } | null = null;
    await act(async () => {
      recap = await result.current.generateRecap(5);
    });

    expect(consoleSpy).toHaveBeenCalledWith('Error generating recap:', apiError);
    expect(toast.error).toHaveBeenCalledWith('myNotes.recapError');
    expect(recap).toBeNull();

    consoleSpy.mockRestore();
  });
});

describe('useRecapOperations saveRecapToLetterBox', () => {
  const mockT = (key: string) => key;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const userData: UserData = {
    uid: 'user123',
    email: 'test@example.com',
  } as unknown as UserData;

  it('should save recap to letter box with default title when title line is absent', async () => {
    const { result } = renderHook(() => useRecapOperations(userData, 'en', mockT));

    let success = false;
    await act(async () => {
      success = await result.current.saveRecapToLetterBox('Line 1\nLine 2');
    });

    expect(addDoc).toHaveBeenCalledWith(undefined, {
      content: 'Line 1\nLine 2',
      title: 'letterBox.defaultTitle',
      createdAt: 'mock-timestamp',
      type: 'weekly_recap'
    });
    expect(toast.success).toHaveBeenCalledWith('myNotes.letterSaveSuccess');
    expect(success).toBe(true);
  });

  it('should extract title successfully from title line in recap text (English format)', async () => {
    const { result } = renderHook(() => useRecapOperations(userData, 'en', mockT));

    let success = false;
    await act(async () => {
      success = await result.current.saveRecapToLetterBox('Title: **My Awesome Title**\nSome comments here.');
    });

    expect(addDoc).toHaveBeenCalledWith(undefined, {
      content: 'Title: **My Awesome Title**\nSome comments here.',
      title: 'My Awesome Title',
      createdAt: 'mock-timestamp',
      type: 'weekly_recap'
    });
    expect(success).toBe(true);
  });

  it('should extract title successfully from title line in recap text (Japanese format)', async () => {
    const { result } = renderHook(() => useRecapOperations(userData, 'en', mockT));

    let success = false;
    await act(async () => {
      success = await result.current.saveRecapToLetterBox('タイトル：**素晴らしいタイトル**\nここに内容。');
    });

    expect(addDoc).toHaveBeenCalledWith(undefined, {
      content: 'タイトル：**素晴らしいタイトル**\nここに内容。',
      title: '素晴らしいタイトル',
      createdAt: 'mock-timestamp',
      type: 'weekly_recap'
    });
    expect(success).toBe(true);
  });

  it('should handle save errors by logging, showing error toast, and returning false', async () => {
    vi.mocked(addDoc).mockRejectedValueOnce(new Error('Firestore write quota exceeded'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useRecapOperations(userData, 'en', mockT));

    let success = true;
    await act(async () => {
      success = await result.current.saveRecapToLetterBox('Weekly recap content');
    });

    expect(consoleSpy).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('myNotes.letterSaveError');
    expect(success).toBe(false);

    consoleSpy.mockRestore();
  });
});

describe('useRecap Orchestrator Hook', () => {
  const mockT = (key: string) => key;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const userData: UserData = {
    uid: 'user123',
    email: 'test@example.com',
  } as unknown as UserData;

  it('should initialize with default UI states', () => {
    const { result } = renderHook(() => useRecap(userData, 'en', mockT));

    expect(result.current.isRecapModalOpen).toBe(false);
    expect(result.current.generatedRecapText).toBe('');
    expect(result.current.isFromCache).toBe(false);
    expect(result.current.recapLoading).toBe(false);
  });

  it('should open modal and populate text on successful recap generation', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { recap: 'Recap content generated', fromCache: true } });

    const { result } = renderHook(() => useRecap(userData, 'en', mockT));

    await act(async () => {
      await result.current.handleGenerateRecap(5);
    });

    expect(result.current.isRecapModalOpen).toBe(true);
    expect(result.current.generatedRecapText).toBe('Recap content generated');
    expect(result.current.isFromCache).toBe(true);
  });

  it('should not open modal or update state if recap generation returns null', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} }); // returns null

    const { result } = renderHook(() => useRecap(userData, 'en', mockT));

    await act(async () => {
      await result.current.handleGenerateRecap(5);
    });

    expect(result.current.isRecapModalOpen).toBe(false);
    expect(result.current.generatedRecapText).toBe('');
    expect(result.current.isFromCache).toBe(false);
  });

  it('should close modal on successful save to letter box', async () => {
    // Generate recap first to set modal state
    vi.mocked(apiClient.post).mockResolvedValue({ data: { recap: 'Recap content', fromCache: false } });
    vi.mocked(addDoc).mockResolvedValue({ id: 'saved-doc' } as any);

    const { result } = renderHook(() => useRecap(userData, 'en', mockT));

    await act(async () => {
      await result.current.handleGenerateRecap(5);
    });
    expect(result.current.isRecapModalOpen).toBe(true);

    let success = false;
    await act(async () => {
      success = await result.current.handleSaveRecapToLetterBox();
    });

    expect(success).toBe(true);
    expect(result.current.isRecapModalOpen).toBe(false);
  });

  it('should keep modal open if save to letter box fails', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { recap: 'Recap content', fromCache: false } });
    vi.mocked(addDoc).mockRejectedValue(new Error('DB failure'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useRecap(userData, 'en', mockT));

    await act(async () => {
      await result.current.handleGenerateRecap(5);
    });
    expect(result.current.isRecapModalOpen).toBe(true);

    let success = true;
    await act(async () => {
      success = await result.current.handleSaveRecapToLetterBox();
    });

    expect(success).toBe(false);
    expect(result.current.isRecapModalOpen).toBe(true); // remains open

    consoleSpy.mockRestore();
  });
});
