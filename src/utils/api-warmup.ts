import { useEffect } from 'react';
import apiClient from './api-client';

export const WARMUP_COOLDOWN_MS = 4 * 60 * 1000; // 4 minutes
let lastWarmupTimestamp = 0;

/**
 * Triggers a lightweight request to /api/warmup to wake up the backend
 * serverless instance if it has been idle.
 * Throttled to at most once every 4 minutes.
 * Completely non-blocking and silent on failure.
 */
export const triggerApiWarmup = (): void => {
    const now = Date.now();
    if (now - lastWarmupTimestamp < WARMUP_COOLDOWN_MS) {
        return; // Skip if recently warmed up
    }
    lastWarmupTimestamp = now;

    // Use low-priority fire-and-forget request
    apiClient.get('/api/warmup', {
        // @ts-expect-error browser fetch priority extension
        priority: 'low'
    }).catch(() => {
        // Silently ignore failures (offline / development)
    });
};

/**
 * Hook to trigger backend warmup on component mount.
 * @param enabled Whether warmup should be triggered (defaults to true)
 */
export const useApiWarmupOnMount = (enabled: boolean = true): void => {
    useEffect(() => {
        if (enabled) {
            triggerApiWarmup();
        }
    }, [enabled]);
};

/**
 * Helper to reset cooldown in tests
 */
export const _resetWarmupTimestampForTesting = (): void => {
    lastWarmupTimestamp = 0;
};
