import { renderHook, act } from '@testing-library/react';
import { useDashboardHabitPace } from './use-dashboard-habit-pace';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { toast } from 'react-toastify';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';

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

    it('should submit successfully and close modal', async () => {
        const { result } = renderHook(() => useDashboardHabitPace(mockUserData as any, false, false, mockT));
        
        act(() => {
            result.current.setAutoKickStep(1);
        });

        await act(async () => {
            await result.current.handleAutoKickSubmit();
        });

        expect(result.current.autoKickError).toBe('');
        expect(toast.success).toHaveBeenCalledWith('groupChat.autoKickSuccess');
        expect(result.current.showAutoKickModal).toBe(false);
        expect(result.current.autoKickStep).toBe(0);
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
        });

        await act(async () => {
            await result.current.handleAutoKickSubmit();
        });

        expect(result.current.autoKickStep).toBe(1); // remains on step 1
        expect(toast.error).toHaveBeenCalledWith('An error occurred: Network Error');
    });
});
