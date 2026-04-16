import { useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../../../firebase';
import { UserData } from '../../../types/user';
import { Group } from '../../../types/chat';
import { groupMemberConverter } from '../../../utils/firestore-converters';
import { useUnityMidnightReset } from '../../../hooks/use-unity-midnight-reset';

export const useDashboardGroups = (userData: UserData | null, initialGroupId: string | null) => {
    const [rawUserGroups, setRawUserGroups] = useState<Group[]>([]);
    const [activeGroupId, setActiveGroupId] = useState<string | null>(initialGroupId);

    const groupIds = useMemo(() => {
        return userData?.groupIds || (userData?.groupId ? [userData.groupId] : []);
    }, [userData?.groupIds, userData?.groupId]);

    const groupIdsKey = useMemo(() => {
        return JSON.stringify([...groupIds].sort());
    }, [groupIds]);

    // Fetch user groups details
    useEffect(() => {
        if (!userData?.uid || groupIds.length === 0) {
            setRawUserGroups([]);
            return;
        }

        const unsubscribers: (() => void)[] = [];

        // 1. Unified Listener for all Groups
        const groupsQuery = query(
            collection(db, 'groups'),
            where('members', 'array-contains', userData.uid)
        );

        const unsubGroups = onSnapshot(groupsQuery, (snapshot) => {
            const groupsMap: Record<string, Group> = {};
            snapshot.docs.forEach(docSnap => {
                groupsMap[docSnap.id] = { id: docSnap.id, ...docSnap.data() } as Group;
            });

            setRawUserGroups(prev => {
                return groupIds
                    .map(id => {
                        const newGroup = groupsMap[id];
                        if (!newGroup) return prev.find(g => g.id === id);
                        
                        const oldGroup = prev.find(g => g.id === id);
                        return {
                            ...newGroup,
                            myMemberStatus: oldGroup?.myMemberStatus || newGroup.myMemberStatus
                        } as Group;
                    })
                    .filter(Boolean) as Group[];
            });
        }, (err) => {
            if (err.code !== 'permission-denied') console.error("Dashboard groups query listener error:", err);
        });
        unsubscribers.push(unsubGroups);

        // 2. Individual member status listeners
        groupIds.forEach(gid => {
            const memberRef = doc(db, 'groups', gid, 'members', userData.uid).withConverter(groupMemberConverter);
            const unsubMember = onSnapshot(memberRef, (memberSnap) => {
                if (memberSnap.exists()) {
                    const mData = memberSnap.data();
                    setRawUserGroups(prev => {
                        const existing = prev.find(g => g.id === gid);
                        if (!existing || JSON.stringify(existing.myMemberStatus) === JSON.stringify(mData)) return prev;
                        return prev.map(g => g.id === gid ? { ...g, myMemberStatus: mData } : g);
                    });
                }
            }, (err) => {
                if (err.code !== 'permission-denied') console.log(`Member fetch error ${gid}:`, err);
            });
            unsubscribers.push(unsubMember);
        });

        return () => unsubscribers.forEach(unsub => unsub());
    }, [userData?.uid, groupIds, groupIdsKey]);

    // Initialize active group
    useEffect(() => {
        if (!userData?.uid) return;
        if (!activeGroupId && groupIds.length > 0) {
            setActiveGroupId(groupIds[0]);
        }
    }, [activeGroupId, groupIds, userData?.uid]);

    // Construct userGroups (Force unreadCount to 0)
    const [userGroups, setUserGroups] = useState<Group[]>([]);

    useEffect(() => {
        const combined = rawUserGroups.map(group => ({
            ...group,
            unreadCount: 0
        })) as Group[];
        setUserGroups(combined);
    }, [rawUserGroups]);

    // Sync active group
    useEffect(() => {
        if (!userData || userGroups.length === 0) return;
        const isActiveGroupLoaded = userGroups.find(g => g.id === activeGroupId);
        if (!isActiveGroupLoaded) {
            const userGroupIds = userData?.groupIds || (userData?.groupId ? [userData.groupId] : []);
            if (activeGroupId && !userGroupIds.includes(activeGroupId)) {
                setActiveGroupId(userGroups[0].id);
            }
        }
    }, [userGroups, userData, activeGroupId, setActiveGroupId]);

    // Midnight reset for active group
    const activeGroup = userGroups.find(g => g.id === activeGroupId);
    useUnityMidnightReset({
        groupId: activeGroupId,
        groupTimeZone: activeGroup?.timeZone || 'UTC',
        dailyActivityDate: activeGroup?.dailyActivity?.date || null,
        onReset: () => {
            // Data will be refreshed by onSnapshot listener automatically
            console.log('[Dashboard] Midnight reset triggered for active group');
        }
    });

    return { userGroups, activeGroupId, setActiveGroupId };
};
