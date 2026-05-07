import { renderHook, waitFor } from '@testing-library/react';
import { useDashboardGroups } from './use-dashboard-groups';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as firestore from 'firebase/firestore';

// Mock firestore
vi.mock('firebase/firestore', () => {
    const mockRef = {
        withConverter: vi.fn().mockReturnThis(),
    };
    return {
        doc: vi.fn(() => mockRef),
        onSnapshot: vi.fn(),
        collection: vi.fn(),
        query: vi.fn(),
        where: vi.fn(),
        Timestamp: {
            fromDate: vi.fn((date) => ({ seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 }))
        }
    };
});

// Mock the db
vi.mock('../../../firebase', () => ({
    db: {}
}));

// Mock the converters
vi.mock('../../../utils/firestore-converters', () => ({
    groupMemberConverter: {}
}));

// Mock the unity reset hook
vi.mock('../../../hooks/use-unity-midnight-reset', () => ({
    useUnityMidnightReset: vi.fn()
}));

describe('useDashboardGroups', () => {
    const mockUserData = {
        uid: 'user123',
        groupIds: ['group1']
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should initialize without crashing (verifies state initialization order)', () => {
        // Setup mock for onSnapshot to return a dummy unsubscriber
        vi.mocked(firestore.onSnapshot).mockReturnValue(() => {});

        // Rendering the hook will execute the function body.
        // If any hook or effect accesses a state variable before its declaration (TDZ),
        // it will throw a ReferenceError here.
        const { result } = renderHook(() => useDashboardGroups(mockUserData as unknown as { uid: string; groupIds: string[] }, null));
        
        expect(result.current.userGroups).toBeDefined();
        expect(result.current.activeGroupId).toBe('group1');
    });

    it('should populate userGroups and setActiveGroupId when data is fetched', async () => {
        let groupsCallback: (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void;
        vi.mocked(firestore.onSnapshot).mockImplementation((( _q: unknown, callback: (snap: unknown) => void) => {
            // In the hook, the first call is to groupsQuery (collection query)
            // Subsequent calls are to individual doc refs
            if (!groupsCallback) groupsCallback = callback as never;
            return () => {};
        }) as unknown as never);

        const { result } = renderHook(() => useDashboardGroups(mockUserData as unknown as { uid: string; groupIds: string[] }, null));

        // Initial state
        expect(result.current.userGroups).toEqual([]);

        // Simulate snapshot update for groups
        // We use act to ensure the state updates are processed
        await waitFor(() => {
            if (!groupsCallback) throw new Error('Groups callback not captured');
            groupsCallback({
                docs: [
                    {
                        id: 'group1',
                        data: () => ({ 
                            id: 'group1',
                            name: 'Test Group',
                            members: ['user123']
                        })
                    }
                ]
            });
        });

        // Wait for the chain of useEffects to complete
        await waitFor(() => {
            expect(result.current.userGroups.length).toBe(1);
        }, { timeout: 2000 });

        expect(result.current.userGroups[0].name).toBe('Test Group');
        expect(result.current.userGroups[0].unreadCount).toBe(0);
        expect(result.current.activeGroupId).toBe('group1');
    });

    it('should handle missing userData gracefully', () => {
        const { result } = renderHook(() => useDashboardGroups(null, null));
        expect(result.current.userGroups).toEqual([]);
        expect(result.current.activeGroupId).toBeNull();
    });
});
