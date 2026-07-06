import { renderHook, act } from '@testing-library/react';
import { useUnityMidnightReset } from '../use-unity-midnight-reset';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';

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

// Spy on API requests via MSW
const requestSpy = vi.fn();

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
        requestSpy.mockClear();
        
        server.use(
            http.post('*/api/groups/reset-unity-if-midnight', () => {
                requestSpy();
                return HttpResponse.json({ reset: true });
            })
        );
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

        expect(requestSpy).not.toHaveBeenCalled();
    });

    it('should reset when date changes in group timezone', async () => {
        const props = { ...defaultProps, dailyActivityDate: '2026-04-15' };
        
        renderHook(() => useUnityMidnightReset(props));

        await act(async () => {
            await vi.runOnlyPendingTimersAsync();
        });

        expect(requestSpy).toHaveBeenCalled();
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
        expect(requestSpy).not.toHaveBeenCalled();

        // Advance 10 hours -> 11:00 UTC (LA: 04:00 AM on April 17)
        await act(async () => {
            vi.advanceTimersByTime(10 * 60 * 60 * 1000);
        });

        expect(requestSpy).toHaveBeenCalled();
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

        expect(requestSpy).toHaveBeenCalled();
    });

    it('should not reset when groupId is missing', async () => {
        renderHook(() => useUnityMidnightReset({ ...defaultProps, groupId: null }));

        await act(async () => {
            await vi.runOnlyPendingTimersAsync();
        });

        expect(requestSpy).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully (not calling onReset)', async () => {
        // Ensure ALL calls fail for this test
        server.use(
            http.post('*/api/groups/reset-unity-if-midnight', () => {
                requestSpy();
                return new HttpResponse('Internal Server Error', { status: 500 });
            })
        );

        const props = { ...defaultProps, dailyActivityDate: '2026-04-15' };
        renderHook(() => useUnityMidnightReset(props));

        await act(async () => {
            await vi.runOnlyPendingTimersAsync();
        });

        expect(requestSpy).toHaveBeenCalled();
        expect(props.onReset).not.toHaveBeenCalled();
    });
});
