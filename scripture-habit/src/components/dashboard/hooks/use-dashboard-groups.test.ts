import { renderHook, waitFor } from '@testing-library/react';
import { useDashboardGroups } from './use-dashboard-groups';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as firestore from 'firebase/firestore';
import { toast } from 'react-toastify';

// Shared mock test state
const mockTestState = {
    listeners: [] as any[],
    groupsCallback: null as any
};

// Helper to get the latest registered groups query listener
const getLatestGroupsListener = () => {
    const groupsListeners = mockTestState.listeners.filter(l => 
        l.target && l.target.type === 'groups'
    );
    return groupsListeners[groupsListeners.length - 1];
};

// Mock firestore
vi.mock('firebase/firestore', () => {
    return {
        doc: vi.fn(),
        collection: vi.fn(),
        query: vi.fn(),
        where: vi.fn(),
        onSnapshot: vi.fn(),
        getDocs: vi.fn(),
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
        vi.restoreAllMocks();
        vi.clearAllMocks();
        mockTestState.listeners = [];
        mockTestState.groupsCallback = null;

        // Reset firestore mocked implementations explicitly to avoid leaks!
        vi.mocked(firestore.doc).mockImplementation(((_db: any, col: any, ...paths: any[]) => {
            const mockRef = {
                type: 'doc',
                col,
                paths,
                withConverter: vi.fn().mockReturnThis(),
            };
            if (col === 'groups' && paths.includes('members')) {
                (mockRef as any).type = 'member';
                (mockRef as any).gid = paths[0];
            }
            return mockRef as any;
        }) as any);

        vi.mocked(firestore.collection).mockImplementation(((_db: any, col: any, ...paths: any[]) => {
            const mockCol = {
                type: 'groups',
                col,
                paths,
            };
            if (col === 'groups' && paths.includes('messages')) {
                (mockCol as any).type = 'messages';
                (mockCol as any).gid = paths[0];
            }
            return mockCol as any;
        }) as any);

        vi.mocked(firestore.query).mockImplementation(((q: any) => q) as any);

        vi.mocked(firestore.getDocs).mockImplementation((() => Promise.resolve({ docs: [] })) as any);

        vi.mocked(firestore.onSnapshot).mockImplementation(((target: any, callback: any, onError: any) => {
            const listener = { target, callback, onError };
            mockTestState.listeners.push(listener);
            if (!mockTestState.groupsCallback && (!target || ((target as any).type !== 'member' && (target as any).type !== 'messages'))) {
                mockTestState.groupsCallback = callback;
            }
            return () => {};
        }) as any);
    });

    it('should initialize without crashing (verifies state initialization order)', () => {
        // Setup mock for onSnapshot to return a dummy unsubscriber
        vi.mocked(firestore.onSnapshot).mockReturnValue(() => { });

        // Rendering the hook will execute the function body.
        // If any hook or effect accesses a state variable before its declaration (TDZ),
        // it will throw a ReferenceError here.
        const { result } = renderHook(() => useDashboardGroups(mockUserData as unknown as { uid: string; groupIds: string[] }, null));

        expect(result.current.userGroups).toBeDefined();
        expect(result.current.activeGroupId).toBe('group1');
        expect(result.current.isLoading).toBe(true);
    });

    it('should populate userGroups and setActiveGroupId when data is fetched', async () => {
        let groupsCallback: (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void;
        vi.mocked(firestore.onSnapshot).mockImplementation(((_q: unknown, callback: (snap: unknown) => void) => {
            // In the hook, the first call is to groupsQuery (collection query)
            // Subsequent calls are to individual doc refs
            if (!groupsCallback) groupsCallback = callback as never;
            return () => { };
        }) as unknown as never);

        const { result } = renderHook(() => useDashboardGroups(mockUserData as unknown as { uid: string; groupIds: string[] }, null));

        // Initial state
        expect(result.current.userGroups).toEqual([]);
        expect(result.current.isLoading).toBe(true);

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
        expect(result.current.isLoading).toBe(false);
    });

    it('should handle missing userData gracefully', () => {
        const { result } = renderHook(() => useDashboardGroups(null, null));
        expect(result.current.userGroups).toEqual([]);
        expect(result.current.activeGroupId).toBeNull();
        expect(result.current.isLoading).toBe(false);
    });

    it('should NOT keep zombie groups if removed from Firestore membership', async () => {
        let groupsCallback: (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void;
        vi.mocked(firestore.onSnapshot).mockImplementation(((_q: unknown, callback: (snap: unknown) => void) => {
            if (!groupsCallback) groupsCallback = callback as never;
            return () => { };
        }) as unknown as never);

        const { result } = renderHook(() => useDashboardGroups(mockUserData as unknown as { uid: string; groupIds: string[] }, null));

        // 1. Initial Load
        await waitFor(() => {
            if (!groupsCallback) throw new Error('Groups callback not captured');
            groupsCallback({
                docs: [{ id: 'group1', data: () => ({ id: 'group1', name: 'Test Group' }) }]
            });
        });
        await waitFor(() => expect(result.current.userGroups.length).toBe(1));

        // 2. Simulate group deletion/removal from membership (empty docs)
        await waitFor(() => {
            groupsCallback({ docs: [] });
        });

        // 3. Ensure group is removed despite being in mockUserData.groupIds
        await waitFor(() => expect(result.current.userGroups.length).toBe(0));
    });

    it('should deduplicate groupIds from userData', async () => {
        let groupsCallback: (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void;
        vi.mocked(firestore.onSnapshot).mockImplementation(((_q: unknown, callback: (snap: unknown) => void) => {
            if (!groupsCallback) groupsCallback = callback as never;
            return () => { };
        }) as unknown as never);

        const duplicatedUserData = {
            uid: 'user123',
            groupIds: ['group1', 'group1', 'group1']
        };

        const { result } = renderHook(() => useDashboardGroups(duplicatedUserData as unknown as { uid: string; groupIds: string[] }, null));

        await waitFor(() => {
            if (!groupsCallback) throw new Error('Groups callback not captured');
            groupsCallback({
                docs: [{ id: 'group1', data: () => ({ id: 'group1', name: 'Test Group' }) }]
            });
        });

        await waitFor(() => {
            expect(result.current.userGroups.length).toBe(1);
        });
    });

    it('should ONLY show groups that are in groupIds (strict filtering)', async () => {
        let groupsCallback: (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void;
        vi.mocked(firestore.onSnapshot).mockImplementation(((_q: unknown, callback: (snap: unknown) => void) => {
            if (!groupsCallback) groupsCallback = callback as never;
            return () => { };
        }) as unknown as never);

        // User is member of group1 and group2, but groupIds only has group1
        const strictUserData = {
            uid: 'user123',
            groupIds: ['group1']
        };

        const { result } = renderHook(() => useDashboardGroups(strictUserData as unknown as { uid: string; groupIds: string[] }, null));

        await waitFor(() => {
            if (!groupsCallback) throw new Error('Groups callback not captured');
            groupsCallback({
                docs: [
                    { id: 'group1', data: () => ({ id: 'group1', name: 'Group 1' }) },
                    { id: 'group2', data: () => ({ id: 'group2', name: 'Ghost Group' }) }
                ]
            });
        });

        // Should only show group1
        await waitFor(() => {
            expect(result.current.userGroups.length).toBe(1);
            expect(result.current.userGroups[0].id).toBe('group1');
        });
    });

    it('should handle groups query error gracefully (lines 80-82)', async () => {
        const toastSpy = vi.spyOn(toast, 'error');

        const { result } = renderHook(() => useDashboardGroups(mockUserData as any, null));

        await waitFor(() => {
            expect(mockTestState.listeners.length).toBeGreaterThan(0);
        });

        const activeListener = getLatestGroupsListener();
        activeListener.onError({ code: 'permission-denied', message: 'Denied' });

        await waitFor(() => {
            expect(toastSpy).toHaveBeenCalledWith('Groups Error: permission-denied - Denied');
            expect(result.current.isLoading).toBe(false);
        });
    });

    it('should handle member status updates and their errors (lines 90-101)', async () => {
        const listeners = {
            member: {} as Record<string, any>
        };

        vi.mocked(firestore.onSnapshot).mockImplementation(((target: any, callback: any, onError: any) => {
            const listenerObj = { target, callback, onError };
            const t = target as any;
            if (t && t.type === 'member') {
                listeners.member[t.gid] = listenerObj;
            } else {
                mockTestState.listeners.push(listenerObj);
            }
            return () => {};
        }) as any);

        const toastSpy = vi.spyOn(toast, 'error');

        const { result } = renderHook(() => useDashboardGroups(mockUserData as any, null));

        // 1. Initial trigger of members/groups
        await waitFor(() => {
            expect(mockTestState.listeners.length).toBeGreaterThan(0);
            expect(listeners.member['group1']).toBeDefined();
        });

        // Trigger member callback
        listeners.member['group1'].callback({
            exists: () => true,
            data: () => ({ role: 'member' })
        });

        const activeGroupsListener = getLatestGroupsListener();
        activeGroupsListener.callback({
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

        // 2. Normal member callback
        listeners.member['group1'].callback({
            exists: () => true,
            data: () => ({
                role: 'admin'
            })
        });

        await waitFor(() => {
            expect(result.current.userGroups[0].myMemberStatus).toBeDefined();
            expect((result.current.userGroups[0].myMemberStatus as any)?.role).toBe('admin');
        });

        listeners.member['group1'].onError({ code: 'unavailable' });
        expect(toastSpy).toHaveBeenCalledWith('Member Status Error (group): unavailable');
    });

    it('should fallback to first userGroup when userData has no groupIds (lines 171-172)', async () => {
        const userDataNoGroups = {
            uid: 'user123',
            groupIds: []
        };

        const { result } = renderHook(() => useDashboardGroups(userDataNoGroups as any, null));

        await waitFor(() => {
            expect(mockTestState.listeners.length).toBeGreaterThan(0);
        });

        const activeListener = getLatestGroupsListener();
        activeListener.callback({
            docs: [
                {
                    id: 'group_from_query',
                    data: () => ({
                        id: 'group_from_query',
                        name: 'Query Group',
                        members: ['user123']
                    })
                }
            ]
        });

        await waitFor(() => {
            expect(result.current.activeGroupId).toBe('group_from_query');
        });
    });

    it('should reset activeGroupId if current active group is no longer in groupIds list (lines 186-188)', async () => {
        const { result, rerender } = renderHook(
            ({ uData }) => useDashboardGroups(uData, 'group2'),
            { initialProps: { uData: { uid: 'user123', groupIds: ['group1', 'group2'] } as any } }
        );

        await waitFor(() => {
            expect(mockTestState.listeners.length).toBeGreaterThan(0);
        });

        let activeListener = getLatestGroupsListener();
        activeListener.callback({
            docs: [
                { id: 'group1', data: () => ({ id: 'group1', name: 'Group 1', members: ['user123'] }) },
                { id: 'group2', data: () => ({ id: 'group2', name: 'Group 2', members: ['user123'] }) }
            ]
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

        await waitFor(() => {
            expect(mockTestState.listeners.length).toBeGreaterThan(0);
        });
        
        activeListener = getLatestGroupsListener();
        activeListener.callback({
            docs: [
                { id: 'group1', data: () => ({ id: 'group1', name: 'Group 1', members: ['user123'] }) }
            ]
        });

        await waitFor(() => {
            expect(result.current.activeGroupId).toBe('group1');
        });
    });
});
