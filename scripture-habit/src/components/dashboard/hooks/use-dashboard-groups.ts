import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { UserData } from '../../../types/user';
import { Group } from '../../../types/chat';
import { useUnityMidnightReset } from '../../../hooks/use-unity-midnight-reset';
import { GroupService } from '../../../services/group-service';

export const useDashboardGroups = (userData: UserData | null, initialGroupId: string | null) => {
    const [rawUserGroups, setRawUserGroups] = useState<Group[]>([]);
    const [activeGroupId, setActiveGroupId] = useState<string | null>(initialGroupId);
    const [isLoading, setIsLoading] = useState(true);

    const userGroupIds = useMemo(() => {
        return userData?.groupIds || (userData?.groupId ? [userData.groupId] : []);
    }, [userData?.groupIds, userData?.groupId]);
    const userGroupIdsKey = useMemo(() => JSON.stringify(userGroupIds), [userGroupIds]);

    const groupIds = useMemo(() => {
        const ids = JSON.parse(userGroupIdsKey) as string[];
        if (activeGroupId && !ids.includes(activeGroupId)) {
            return Array.from(new Set([...ids, activeGroupId]));
        }
        return ids;
    }, [userGroupIdsKey, activeGroupId]);

    const groupIdsKey = useMemo(() => {
        return JSON.stringify([...groupIds].sort());
    }, [groupIds]);

    // Reset loading state when user changes
    useEffect(() => {
        if (userData?.uid) {
            setIsLoading(true);
        }
    }, [userData?.uid]);

    // Fetch user groups details
    useEffect(() => {
        if (!userData?.uid) {
            setRawUserGroups([]);
            setIsLoading(false);
            return;
        }

        // 1. Unified Listener for all Groups via GroupService
        const unsubGroups = GroupService.subscribeUserGroups(
            userData.uid,
            (fetchedGroups) => {
                setRawUserGroups(prev => {
                    // TRUTH: Merge fresh Firestore data with existing "decorations" 
                    const mergeWithDecorations = (newG: Group) => {
                        const existing = prev.find(p => p.id === newG.id);
                        if (!existing) return newG;
                        return {
                            ...newG,
                            myMemberStatus: existing.myMemberStatus
                        };
                    };

                    const mergedFetched = fetchedGroups.map(mergeWithDecorations);
                    
                    // We'll deduplicate in the useMemo result, but let's keep raw unique too
                    const uniqueMap = new Map<string, Group>();
                    mergedFetched.forEach(g => uniqueMap.set(g.id, g));
                    return Array.from(uniqueMap.values());
                });
                setIsLoading(false);
            },
            (err) => {
                console.error("Dashboard groups query listener error:", err);
                const firestoreError = err as { code?: string; message?: string };
                toast.error(`Groups Error: ${firestoreError.code || 'unknown'} - ${firestoreError.message}`);
                setIsLoading(false);
            }
        );

        // 2. Individual member status listeners removed to save read costs.
        // memberJoinedAt, memberLastActive, memberKickThresholds are already denormalized inside Group.

        return unsubGroups;
    }, [userData?.uid, groupIdsKey, groupIds, isLoading]);

    // Construct userGroups (Force unreadCount to 0 and ensure uniqueness)
    const userGroups = useMemo(() => {
        // 1. Deduplicate raw data
        const uniqueRawMap = new Map<string, Group>();
        rawUserGroups.forEach(g => {
            if (g.id) uniqueRawMap.set(g.id, g);
        });
        const uniqueRaw = Array.from(uniqueRawMap.values());
        
        const combined = uniqueRaw.map(group => ({
            ...group,
            unreadCount: 0
        })) as Group[];

        // 2. Final sort/filter by groupIds (which is already deduplicated)
        const finalOrdered = groupIds.length > 0 
            ? groupIds.map(id => combined.find(g => g.id === id)).filter(Boolean) as Group[]
            : combined;

        // 3. Final safety deduplication
        const finalMap = new Map<string, Group>();
        finalOrdered.forEach(g => {
            if (g.id) finalMap.set(g.id, g);
        });
        
        return Array.from(finalMap.values());
    }, [rawUserGroups, groupIds]);

    // Initialize active group
    useEffect(() => {
        if (!userData?.uid) return;
        if (!activeGroupId) {
            if (groupIds.length > 0) {
                setActiveGroupId(groupIds[0]);
            } else if (userGroups.length > 0) {
                setActiveGroupId(userGroups[0].id);
            }
        }
    }, [activeGroupId, groupIds, userGroups, userData?.uid]);


    // Sync active group - only reset if NOT loading and group is truly missing
    useEffect(() => {
        if (isLoading || !userData || userGroups.length === 0) return;
        
        const isActiveGroupLoaded = userGroups.find(g => g.id === activeGroupId);
        if (!isActiveGroupLoaded && activeGroupId) {
            // Only switch if the group is definitely not in our userGroupIds list anymore
            // (meaning the user left or was kicked)
            if (!userGroupIds.includes(activeGroupId)) {
                console.log(`[useDashboardGroups] Active group ${activeGroupId} not in userGroupIds, resetting to ${userGroups[0].id}`);
                setActiveGroupId(userGroups[0].id);
            }
        }
    }, [userGroups, userData, activeGroupId, userGroupIds, isLoading]);

    // Midnight reset for active group
    const activeGroup = userGroups.find(g => g.id === activeGroupId);
    useUnityMidnightReset({
        groupId: activeGroupId,
        groupTimeZone: activeGroup?.timeZone || 'UTC',
        dailyActivityDate: activeGroup?.dailyActivity?.date || null,
        onReset: () => {
            // Data will be refreshed by onSnapshot listener automatically
        }
    });

    return { userGroups, activeGroupId, setActiveGroupId, isLoading };
};
