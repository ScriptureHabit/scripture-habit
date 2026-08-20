import { renderHook, waitFor, act } from '@testing-library/react';
import { useDashboardGroups } from './use-dashboard-groups';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { toast } from 'react-toastify';
import { GroupService } from '../../../services/group-service';
import { Group } from '../../../types/chat';

// Mock the services
vi.mock('../../../services/group-service', () => ({
    GroupService: {
        subscribeUserGroups: vi.fn(() => () => {})
    }
}));

// Mock the unity reset hook
vi.mock('../../../hooks/use-unity-midnight-reset', () => ({
    useUnityMidnightReset: vi.fn()
}));

// Mock react-toastify
vi.mock('react-toastify', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
        info: vi.fn()
    }
}));

describe('useDashboardGroups', () => {
    const mockUserData = {
        uid: 'user123',
        groupIds: ['group1']
    };

    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
        vi.clearAllMocks();
        vi.mocked(GroupService.subscribeUserGroups).mockReturnValue(() => {});
    });

    it('should initialize without crashing (verifies state initialization order)', () => {
        const { result } = renderHook(() => useDashboardGroups(mockUserData as any, null));

        expect(result.current.userGroups).toBeDefined();
        expect(result.current.activeGroupId).toBe('group1');
        expect(result.current.isLoading).toBe(true);
    });

    it('should populate userGroups and setActiveGroupId when data is fetched', async () => {
        let groupsCallback: ((groups: Group[]) => void) | undefined;
        vi.mocked(GroupService.subscribeUserGroups).mockImplementation((_userId, onUpdate) => {
            groupsCallback = onUpdate;
            return () => {};
        });

        const { result } = renderHook(() => useDashboardGroups(mockUserData as any, null));

        // Initial state
        expect(result.current.userGroups).toEqual([]);
        expect(result.current.isLoading).toBe(true);

        // Simulate callback update for groups
        act(() => {
            if (!groupsCallback) throw new Error('Groups callback not captured');
            groupsCallback([
                {
                    id: 'group1',
                    name: 'Test Group',
                    members: ['user123']
                } as Group
            ]);
        });

        // Wait for the chain of useEffects to complete
        await waitFor(() => {
            expect(result.current.userGroups.length).toBe(1);
        }, { timeout: 2000 });

        expect(result.current.userGroups[0].name).toBe('Test Group');
        expect(result.current.userGroups[0].unreadCount).toBe(0);
        expect(result.current.activeGroupId).toBe('group1');
        expect(result.current.isLoading).toBe(false);
    });

    it('should handle missing userData gracefully', () => {
        const { result } = renderHook(() => useDashboardGroups(null, null));
        expect(result.current.userGroups).toEqual([]);
        expect(result.current.activeGroupId).toBeNull();
        expect(result.current.isLoading).toBe(false);
        expect(GroupService.subscribeUserGroups).not.toHaveBeenCalled();
    });

    it('should NOT keep zombie groups if removed from Firestore membership', async () => {
        let groupsCallback: ((groups: Group[]) => void) | undefined;
        vi.mocked(GroupService.subscribeUserGroups).mockImplementation((_userId, onUpdate) => {
            groupsCallback = onUpdate;
            return () => {};
        });

        const { result } = renderHook(() => useDashboardGroups(mockUserData as any, null));

        // 1. Initial Load
        act(() => {
            if (!groupsCallback) throw new Error('Groups callback not captured');
            groupsCallback([{ id: 'group1', name: 'Test Group' } as Group]);
        });
        await waitFor(() => expect(result.current.userGroups.length).toBe(1));

        // 2. Simulate group deletion/removal from membership (empty docs)
        act(() => {
            if (!groupsCallback) throw new Error('Groups callback not captured');
            groupsCallback([]);
        });

        // 3. Ensure group is removed despite being in mockUserData.groupIds
        await waitFor(() => expect(result.current.userGroups.length).toBe(0));
    });

    it('should deduplicate groupIds from userData', async () => {
        let groupsCallback: ((groups: Group[]) => void) | undefined;
        vi.mocked(GroupService.subscribeUserGroups).mockImplementation((_userId, onUpdate) => {
            groupsCallback = onUpdate;
            return () => {};
        });

        const duplicatedUserData = {
            uid: 'user123',
            groupIds: ['group1', 'group1', 'group1']
        };

        const { result } = renderHook(() => useDashboardGroups(duplicatedUserData as any, null));

        act(() => {
            if (!groupsCallback) throw new Error('Groups callback not captured');
            groupsCallback([{ id: 'group1', name: 'Test Group' } as Group]);
        });

        await waitFor(() => {
            expect(result.current.userGroups.length).toBe(1);
        });
    });

    it('should ONLY show groups that are in groupIds (strict filtering)', async () => {
        let groupsCallback: ((groups: Group[]) => void) | undefined;
        vi.mocked(GroupService.subscribeUserGroups).mockImplementation((_userId, onUpdate) => {
            groupsCallback = onUpdate;
            return () => {};
        });

        // User is member of group1 and group2, but groupIds only has group1
        const strictUserData = {
            uid: 'user123',
            groupIds: ['group1']
        };

        const { result } = renderHook(() => useDashboardGroups(strictUserData as any, null));

        act(() => {
            if (!groupsCallback) throw new Error('Groups callback not captured');
            groupsCallback([
                { id: 'group1', name: 'Group 1' } as Group,
                { id: 'group2', name: 'Ghost Group' } as Group
            ]);
        });

        // Should only show group1
        await waitFor(() => {
            expect(result.current.userGroups.length).toBe(1);
            expect(result.current.userGroups[0].id).toBe('group1');
        });
    });

    it('should handle groups query error gracefully', async () => {
        const toastSpy = vi.spyOn(toast, 'error');
        let groupsOnError: ((err: any) => void) | undefined;

        vi.mocked(GroupService.subscribeUserGroups).mockImplementation((_userId, _onUpdate, onError) => {
            groupsOnError = onError;
            return () => {};
        });

        const { result } = renderHook(() => useDashboardGroups(mockUserData as any, null));

        await waitFor(() => {
            expect(groupsOnError).toBeDefined();
        });

        act(() => {
            groupsOnError!({ code: 'permission-denied', message: 'Denied' });
        });

        await waitFor(() => {
            expect(toastSpy).toHaveBeenCalledWith('Groups Error: permission-denied - Denied');
            expect(result.current.isLoading).toBe(false);
        });
    });

    it('should fallback to first userGroup when userData has no groupIds', async () => {
        const userDataNoGroups = {
            uid: 'user123',
            groupIds: []
        };
        let groupsCallback: ((groups: Group[]) => void) | undefined;

        vi.mocked(GroupService.subscribeUserGroups).mockImplementation((_userId, onUpdate) => {
            groupsCallback = onUpdate;
            return () => {};
        });

        const { result } = renderHook(() => useDashboardGroups(userDataNoGroups as any, null));

        await waitFor(() => {
            expect(groupsCallback).toBeDefined();
        });

        act(() => {
            groupsCallback!([
                {
                    id: 'group_from_query',
                    name: 'Query Group',
                    members: ['user123']
                } as Group
            ]);
        });

        await waitFor(() => {
            expect(result.current.activeGroupId).toBe('group_from_query');
        });
    });

    it('should reset activeGroupId if current active group is no longer in groupIds list', async () => {
        let groupsCallback: ((groups: Group[]) => void) | undefined;

        vi.mocked(GroupService.subscribeUserGroups).mockImplementation((_userId, onUpdate) => {
            groupsCallback = onUpdate;
            return () => {};
        });

        const { result, rerender } = renderHook(
            ({ uData }) => useDashboardGroups(uData, 'group2'),
            { initialProps: { uData: { uid: 'user123', groupIds: ['group1', 'group2'] } as any } }
        );

        await waitFor(() => {
            expect(groupsCallback).toBeDefined();
        });

        act(() => {
            groupsCallback!([
                { id: 'group1', name: 'Group 1', members: ['user123'] } as Group,
                { id: 'group2', name: 'Group 2', members: ['user123'] } as Group
            ]);
        });

        await waitFor(() => {
            expect(result.current.activeGroupId).toBe('group2');
            expect(result.current.userGroups.length).toBe(2);
        });

        const updatedUserData = {
            uid: 'user123',
            groupIds: ['group1']
        };
        rerender({ uData: updatedUserData as any });
        
        act(() => {
            groupsCallback!([
                { id: 'group1', name: 'Group 1', members: ['user123'] } as Group
            ]);
        });

        await waitFor(() => {
            expect(result.current.activeGroupId).toBe('group1');
        });
    });
});
