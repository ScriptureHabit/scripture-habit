import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerApiWarmup, useApiWarmupOnMount, _resetWarmupTimestampForTesting, WARMUP_COOLDOWN_MS } from '../api-warmup';
import apiClient from '../api-client';
import { renderHook } from '@testing-library/react';

vi.mock('../api-client', () => ({
    default: {
        get: vi.fn().mockResolvedValue({ data: { status: 'ok', warmed: true } })
    }
}));

describe('api-warmup utility', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        _resetWarmupTimestampForTesting();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('triggers /api/warmup on initial call', () => {
        triggerApiWarmup();
        expect(apiClient.get).toHaveBeenCalledTimes(1);
        expect(apiClient.get).toHaveBeenCalledWith('/api/warmup', expect.objectContaining({ priority: 'low' }));
    });

    it('skips subsequent calls within cooldown window', () => {
        triggerApiWarmup();
        expect(apiClient.get).toHaveBeenCalledTimes(1);

        // Immediate subsequent call
        triggerApiWarmup();
        expect(apiClient.get).toHaveBeenCalledTimes(1);

        // Advance 2 minutes (still under 4-min cooldown)
        vi.advanceTimersByTime(2 * 60 * 1000);
        triggerApiWarmup();
        expect(apiClient.get).toHaveBeenCalledTimes(1);
    });

    it('triggers again after cooldown window expires', () => {
        triggerApiWarmup();
        expect(apiClient.get).toHaveBeenCalledTimes(1);

        // Advance past 4 minutes
        vi.advanceTimersByTime(WARMUP_COOLDOWN_MS + 1000);
        triggerApiWarmup();
        expect(apiClient.get).toHaveBeenCalledTimes(2);
    });

    it('silently ignores network errors', async () => {
        vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Network error'));
        expect(() => triggerApiWarmup()).not.toThrow();
    });

    it('useApiWarmupOnMount triggers warmup when enabled is true', () => {
        renderHook(() => useApiWarmupOnMount(true));
        expect(apiClient.get).toHaveBeenCalledTimes(1);
    });

    it('useApiWarmupOnMount does not trigger when enabled is false', () => {
        renderHook(() => useApiWarmupOnMount(false));
        expect(apiClient.get).not.toHaveBeenCalled();
    });
});
