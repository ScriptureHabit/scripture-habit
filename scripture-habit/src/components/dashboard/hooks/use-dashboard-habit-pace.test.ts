import { renderHook, act } from '@testing-library/react';
import { useDashboardHabitPace } from './use-dashboard-habit-pace';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { toast } from 'react-toastify';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';

// Mock AuthService instead of Firebase directly
vi.mock('../../../services/auth-service', () => ({
    AuthService: {
        getIdToken: vi.fn(() => Promise.resolve('mock-token')),
        getAppCheckToken: vi.fn(() => Promise.resolve('mock-appcheck-token'))
    }
}));

// Mock react-toastify
vi.mock('react-toastify', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn()
    }
}));

describe('useDashboardHabitPace', () => {
    const mockT = vi.fn((key: string) => key);
    const mockUserData = {
        uid: 'user123',
        hasSetKickThreshold: false,
        hasSeenWelcomeStory: true
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should show modal on mount if conditions are met', () => {
        const { result } = renderHook(() => useDashboardHabitPace(mockUserData as any, false, false, mockT));
        expect(result.current.showAutoKickModal).toBe(true);
        expect(result.current.autoKickStep).toBe(0);
    });

    it('should not show modal if userData.hasSetKickThreshold is true', () => {
        const userDataSet = { ...mockUserData, hasSetKickThreshold: true };
        const { result } = renderHook(() => useDashboardHabitPace(userDataSet as any, false, false, mockT));
        expect(result.current.showAutoKickModal).toBe(false);
    });

    it('should handle validation mismatch error', async () => {
        const { result } = renderHook(() => useDashboardHabitPace(mockUserData as any, false, false, mockT));
        
        // Step 1: go to confirm step
        act(() => {
            result.current.setAutoKickStep(1);
            result.current.setKickConfirmInput('5'); // mismatch default 7
        });

        // Submit
        await act(async () => {
            await result.current.handleAutoKickSubmit();
        });

        expect(result.current.autoKickError).toBe('groupChat.autoKickErrorMismatch');
        expect(result.current.kickConfirmInput).toBe('');
    });

    it('should submit successfully and progress to step 2', async () => {
        const { result } = renderHook(() => useDashboardHabitPace(mockUserData as any, false, false, mockT));
        
        act(() => {
            result.current.setAutoKickStep(1);
            result.current.setKickConfirmInput('7'); // matches default 7
        });

        await act(async () => {
            await result.current.handleAutoKickSubmit();
        });

        expect(result.current.autoKickError).toBe('');
        expect(toast.success).toHaveBeenCalledWith('groupChat.autoKickSuccess');
        expect(result.current.autoKickStep).toBe(2);
    });

    it('should handle API failure with error toast (4xx/5xx)', async () => {
        // Override default success handler with error
        server.use(
            http.post('/api/groups/update-kick-threshold', () => {
                return HttpResponse.json({ error: 'Threshold is invalid' }, { status: 400 });
            })
        );

        const { result } = renderHook(() => useDashboardHabitPace(mockUserData as any, false, false, mockT));
        
        act(() => {
            result.current.setAutoKickStep(1);
            result.current.setKickConfirmInput('7');
        });

        await act(async () => {
            await result.current.handleAutoKickSubmit();
        });

        expect(result.current.autoKickStep).toBe(1); // remains on step 1
        expect(toast.error).toHaveBeenCalledWith('Failed to update pace: Threshold is invalid');
    });

    it('should handle network/connection exceptions gracefully', async () => {
        // Force network error
        server.use(
            http.post('/api/groups/update-kick-threshold', () => {
                return HttpResponse.error();
            })
        );

        const { result } = renderHook(() => useDashboardHabitPace(mockUserData as any, false, false, mockT));
        
        act(() => {
            result.current.setAutoKickStep(1);
            result.current.setKickConfirmInput('7');
        });

        await act(async () => {
            await result.current.handleAutoKickSubmit();
        });

        expect(result.current.autoKickStep).toBe(1); // remains on step 1
        expect(toast.error).toHaveBeenCalledWith('An error occurred: Network Error');
    });
});
