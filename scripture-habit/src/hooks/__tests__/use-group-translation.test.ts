import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGroupTranslation } from '../use-group-translation';
import apiClient from '../../utils/api-client';
import { _resetBatcherForTesting } from '../../utils/translation-batcher';
import { Group } from '../../types/chat';

vi.mock('../../hooks/use-language', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: 'ja',
  }),
}));

vi.mock('../../utils/api-client', () => ({
  default: {
    post: vi.fn(),
  },
}));

describe('useGroupTranslation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    _resetBatcherForTesting();
  });

  afterEach(() => {
    _resetBatcherForTesting();
  });

  it('skips translation if group name is already in target language', async () => {
    const group: Group = {
      id: 'g1',
      name: '聖典読書会',
      description: '日本語の説明です',
    } as unknown as Group;

    const { result } = renderHook(() => useGroupTranslation(group, 'ja'));

    expect(result.current.displayName).toBe('聖典読書会');
    expect(result.current.displayDesc).toBe('日本語の説明です');
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('translates name but skips description by default for foreign group', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        translations: {
          group_name_g2: '聖典スタディ',
        },
      },
    });

    const group: Group = {
      id: 'g2',
      name: 'Scripture Study',
      description: 'English description for study',
    } as unknown as Group;

    const { result } = renderHook(() => useGroupTranslation(group, 'ja'));

    await waitFor(() => {
      expect(result.current.displayName).toBe('聖典スタディ');
    });

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenCalledWith('/api/ai/translate-batch', {
      messages: [{ id: 'group_name_g2', text: 'Scripture Study' }],
      targetLanguage: 'ja',
    });
  });

  it('translates description when translateDescription is true in a single batch', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        translations: {
          group_name_g3: '聖典スタディ',
          group_desc_g3: '勉強用の説明',
        },
      },
    });

    const group: Group = {
      id: 'g3',
      name: 'Scripture Study',
      description: 'Study description',
    } as unknown as Group;

    const { result } = renderHook(() =>
      useGroupTranslation(group, 'ja', { translateDescription: true })
    );

    await waitFor(() => {
      expect(result.current.displayName).toBe('聖典スタディ');
      expect(result.current.displayDesc).toBe('勉強用の説明');
    });

    // Both name and description batched into 1 HTTP POST call
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenCalledWith('/api/ai/translate-batch', {
      messages: [
        { id: 'group_name_g3', text: 'Scripture Study' },
        { id: 'group_desc_g3', text: 'Study description' },
      ],
      targetLanguage: 'ja',
    });
  });

  it('uses Firestore translation when available without API call', async () => {
    const group: Group = {
      id: 'g4',
      name: 'English Group',
      description: 'English Desc',
      translations: {
        ja: {
          name: '登録済み日本語名',
          description: '登録済み日本語説明',
        },
      },
    } as unknown as Group;

    const { result } = renderHook(() => useGroupTranslation(group, 'ja'));

    expect(result.current.displayName).toBe('登録済み日本語名');
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('uses sessionStorage cache without API call', async () => {
    sessionStorage.setItem('trans_name_g5_ja', 'キャッシュされた名前');

    const group: Group = {
      id: 'g5',
      name: 'Cached Group',
    } as unknown as Group;

    const { result } = renderHook(() => useGroupTranslation(group, 'ja'));

    await waitFor(() => {
      expect(result.current.displayName).toBe('キャッシュされた名前');
    });

    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('batches multiple group name translations into a single API call when rendered concurrently', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        translations: {
          group_name_ga: 'グループA',
          group_name_gb: 'グループB',
          group_name_gc: 'グループC',
        },
      },
    });

    const groupA: Group = { id: 'ga', name: 'Group A' } as unknown as Group;
    const groupB: Group = { id: 'gb', name: 'Group B' } as unknown as Group;
    const groupC: Group = { id: 'gc', name: 'Group C' } as unknown as Group;

    const hookA = renderHook(() => useGroupTranslation(groupA, 'ja'));
    const hookB = renderHook(() => useGroupTranslation(groupB, 'ja'));
    const hookC = renderHook(() => useGroupTranslation(groupC, 'ja'));

    await waitFor(() => {
      expect(hookA.result.current.displayName).toBe('グループA');
      expect(hookB.result.current.displayName).toBe('グループB');
      expect(hookC.result.current.displayName).toBe('グループC');
    });

    // Exactly 1 HTTP POST to /api/ai/translate-batch for all 3 groups
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenCalledWith('/api/ai/translate-batch', {
      messages: [
        { id: 'group_name_ga', text: 'Group A' },
        { id: 'group_name_gb', text: 'Group B' },
        { id: 'group_name_gc', text: 'Group C' },
      ],
      targetLanguage: 'ja',
    });
  });
});
