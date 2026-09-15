import { renderHook } from '@testing-library/react';
import { useDashboardWarnings } from './use-dashboard-warnings';
import { describe, it, expect } from 'vitest';
import { UserData } from '../../../types/user';
import { Group } from '../../../types/chat';

describe('useDashboardWarnings', () => {
    const mockUserData: UserData = {
        uid: 'user-1',
        nickname: 'Test User',
        kickThreshold: 7,
        // Last posted 6 days and 12 hours ago (12 hours remaining for a 7-day threshold)
        lastPostAt: new Date(Date.now() - (6 * 24 + 12) * 60 * 60 * 1000).toISOString(),
    };

    const mockGroup: Group = {
        id: 'group-1',
        name: 'Daily Readers',
        members: ['user-1'],
        memberKickThresholds: {
            'user-1': 7,
        },
        memberJoinedAt: {
            'user-1': new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
    };

    it('should return empty warnings when isDataFetching is true, even if threshold is close', () => {
        const { result } = renderHook(() => 
            useDashboardWarnings(mockUserData, [mockGroup], true)
        );

        expect(result.current.warnings).toEqual([]);
    });

    it('should return warning when isDataFetching is false and inactivity condition is met', () => {
        const { result } = renderHook(() => 
            useDashboardWarnings(mockUserData, [mockGroup], false)
        );

        expect(result.current.warnings.length).toBe(1);
        expect(result.current.warnings[0].name).toBe('Daily Readers');
        expect(result.current.warnings[0].hoursRemaining).toBeLessThanOrEqual(24);
    });

    it('should not return warning if user has posted recently', () => {
        const activeUserData: UserData = {
            ...mockUserData,
            // Last post 2 hours ago
            lastPostAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        };

        const { result } = renderHook(() => 
            useDashboardWarnings(activeUserData, [mockGroup], false)
        );

        expect(result.current.warnings).toEqual([]);
    });

    it('should return empty warnings if userData is null', () => {
        const { result } = renderHook(() => 
            useDashboardWarnings(null, [mockGroup], false)
        );

        expect(result.current.warnings).toEqual([]);
    });

    it('should return empty warnings if userGroups is empty', () => {
        const { result } = renderHook(() => 
            useDashboardWarnings(mockUserData, [], false)
        );

        expect(result.current.warnings).toEqual([]);
    });

    it('should dynamically update warnings when isDataFetching transitions from true to false', () => {
        let isFetching = true;
        const { result, rerender } = renderHook(() => 
            useDashboardWarnings(mockUserData, [mockGroup], isFetching)
        );

        // While fetching: no warnings
        expect(result.current.warnings).toEqual([]);

        // Once fetching finishes: warning appears
        isFetching = false;
        rerender();
        expect(result.current.warnings.length).toBe(1);
        expect(result.current.warnings[0].name).toBe('Daily Readers');
    });
});
