import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requestTranslation, _resetBatcherForTesting } from '../translation-batcher';
import apiClient from '../api-client';

vi.mock('../api-client', () => ({
  default: {
    post: vi.fn(),
  },
}));

describe('translation-batcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetBatcherForTesting();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    _resetBatcherForTesting();
  });

  it('aggregates multiple concurrent requests into a single batch call', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        translations: {
          g1: 'グループ 1',
          g2: 'グループ 2',
          g3: 'グループ 3',
        },
      },
    });

    const p1 = requestTranslation({ id: 'g1', text: 'Group 1', targetLanguage: 'ja' });
    const p2 = requestTranslation({ id: 'g2', text: 'Group 2', targetLanguage: 'ja' });
    const p3 = requestTranslation({ id: 'g3', text: 'Group 3', targetLanguage: 'ja' });

    expect(apiClient.post).not.toHaveBeenCalled();

    // Advance time past BATCH_DELAY_MS (50ms)
    await vi.advanceTimersByTimeAsync(60);

    const [res1, res2, res3] = await Promise.all([p1, p2, p3]);

    expect(res1).toBe('グループ 1');
    expect(res2).toBe('グループ 2');
    expect(res3).toBe('グループ 3');

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenCalledWith('/api/ai/translate-batch', {
      messages: [
        { id: 'g1', text: 'Group 1' },
        { id: 'g2', text: 'Group 2' },
        { id: 'g3', text: 'Group 3' },
      ],
      targetLanguage: 'ja',
    });
  });

  it('deduplicates identical in-flight requests', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        translations: {
          g1: 'グループ 1',
        },
      },
    });

    const p1 = requestTranslation({ id: 'g1', text: 'Group 1', targetLanguage: 'ja' });
    const p2 = requestTranslation({ id: 'g1', text: 'Group 1', targetLanguage: 'ja' });

    expect(p1).toBe(p2); // Same promise reference

    await vi.advanceTimersByTimeAsync(60);

    const [res1, res2] = await Promise.all([p1, p2]);
    expect(res1).toBe('グループ 1');
    expect(res2).toBe('グループ 1');
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it('separates batches by target language', async () => {
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({
        data: { translations: { g1: 'グループ 1' } },
      })
      .mockResolvedValueOnce({
        data: { translations: { g2: 'Grupo 2' } },
      });

    const pJa = requestTranslation({ id: 'g1', text: 'Group 1', targetLanguage: 'ja' });
    const pEs = requestTranslation({ id: 'g2', text: 'Group 2', targetLanguage: 'es' });

    await vi.advanceTimersByTimeAsync(60);

    const [resJa, resEs] = await Promise.all([pJa, pEs]);
    expect(resJa).toBe('グループ 1');
    expect(resEs).toBe('Grupo 2');
    expect(apiClient.post).toHaveBeenCalledTimes(2);
  });

  it('falls back to original text gracefully when API fails', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Network error'));

    const p1 = requestTranslation({ id: 'g1', text: 'Group 1', targetLanguage: 'ja' });

    await vi.advanceTimersByTimeAsync(60);

    const res1 = await p1;
    expect(res1).toBe('Group 1');
  });
});
