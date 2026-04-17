import { renderHook, act } from '@testing-library/react';
import { useUnityMidnightReset } from '../use-unity-midnight-reset';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock Firebase
vi.mock('../../firebase', () => ({
    auth: {
        currentUser: {
            uid: 'test-uid',
            getIdToken: vi.fn().mockResolvedValue('test-token'),
        },
    },
    appCheck: {},
}));

vi.mock('firebase/app-check', () => ({
    getToken: vi.fn().mockResolvedValue({ token: 'app-check-token' }),
}));

// Mock fetch
const globalFetch = vi.fn();
global.fetch = globalFetch;

describe('useUnityMidnightReset', () => {
    const defaultProps = {
        groupId: 'test-group',
        groupTimeZone: 'UTC',
        dailyActivityDate: '2026-04-16',
        onReset: vi.fn(),
    };

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-16T12:00:00Z'));
        globalFetch.mockReset();
        // Default mock implementation
        globalFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ reset: true }),
        });
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should not reset if today matches dailyActivityDate', async () => {
        renderHook(() => useUnityMidnightReset(defaultProps));
        
        await act(async () => {
            await vi.runOnlyPendingTimersAsync();
        });

        expect(globalFetch).not.toHaveBeenCalled();
    });

    it('should reset when date changes in group timezone', async () => {
        const props = { ...defaultProps, dailyActivityDate: '2026-04-15' };
        
        renderHook(() => useUnityMidnightReset(props));

        await act(async () => {
            await vi.runOnlyPendingTimersAsync();
        });

        expect(globalFetch).toHaveBeenCalled();
        expect(props.onReset).toHaveBeenCalled();
    });

    it('should respect group timezone', async () => {
        // System time: 2026-04-17 01:00 UTC (LA: 2026-04-16 18:00)
        vi.setSystemTime(new Date('2026-04-17T01:00:00Z'));
        
        const props = { 
            ...defaultProps, 
            groupTimeZone: 'America/Los_Angeles',
            dailyActivityDate: '2026-04-16' 
        };

        renderHook(() => useUnityMidnightReset(props));

        await act(async () => {
            await vi.runOnlyPendingTimersAsync();
        });

        // Should NOT reset yet (it's 18:00 on April 16 in LA)
        expect(globalFetch).not.toHaveBeenCalled();

        // Advance 10 hours -> 11:00 UTC (LA: 04:00 AM on April 17)
        await act(async () => {
            vi.advanceTimersByTime(10 * 60 * 60 * 1000);
        });

        expect(globalFetch).toHaveBeenCalled();
    });

    it('should retry on focus', async () => {
        renderHook(() => useUnityMidnightReset(defaultProps));

        await act(async () => {
            await vi.runOnlyPendingTimersAsync();
        });

        // Date change
        vi.setSystemTime(new Date('2026-04-17T12:00:00Z'));
        
        // Trigger focus
        await act(async () => {
            window.dispatchEvent(new Event('focus'));
            await vi.runOnlyPendingTimersAsync();
        });

        expect(globalFetch).toHaveBeenCalled();
    });

    it('should handle API errors gracefully (not calling onReset)', async () => {
        // Ensure ALL calls fail for this test
        globalFetch.mockResolvedValue({
            ok: false,
            text: async () => 'Internal Server Error',
        });

        const props = { ...defaultProps, dailyActivityDate: '2026-04-15' };
        renderHook(() => useUnityMidnightReset(props));

        await act(async () => {
            await vi.runOnlyPendingTimersAsync();
        });

        expect(globalFetch).toHaveBeenCalled();
        expect(props.onReset).not.toHaveBeenCalled();
    });
});
