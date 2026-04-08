import { useState, useEffect } from 'react';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../../../firebase';
import { UserData } from '../../../types/user';
import { Group } from '../../../types/chat';
import { groupMemberConverter } from '../../../utils/firestoreConverters';

export const useDashboardGroups = (userData: UserData | null, initialGroupId: string | null) => {
    const [rawUserGroups, setRawUserGroups] = useState<Group[]>([]);
    const [groupStates, setGroupStates] = useState<Record<string, { readMessageCount?: number }>>({});
    const [loadingGroupStates, setLoadingGroupStates] = useState<boolean>(true);
    const [activeGroupId, setActiveGroupId] = useState<string | null>(initialGroupId);

    const groupIds: string[] = userData?.groupIds || (userData?.groupId ? [userData.groupId] : []);
    const groupIdsKey = JSON.stringify([...groupIds].sort());

    // Fetch user groups details
    useEffect(() => {
        if (!userData?.uid || groupIds.length === 0) {
            setRawUserGroups([]);
            return;
        }

        if (!activeGroupId && groupIds.length > 0) {
            setActiveGroupId(groupIds[0]);
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
            // Log but don't crash, might be transient during auth state changes
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
                        if (!existing || existing.myMemberStatus === mData) return prev;
                        return prev.map(g => g.id === gid ? { ...g, myMemberStatus: mData } : g);
                    });
                }
            }, (err) => {
                if (err.code !== 'permission-denied') console.log(`Member fetch error ${gid}:`, err);
            });
            unsubscribers.push(unsubMember);
        });

        return () => unsubscribers.forEach(unsub => unsub());
    }, [userData?.uid, groupIdsKey]);

    // Fetch user group states
    useEffect(() => {
        if (!userData?.uid) {
            setGroupStates({});
            setLoadingGroupStates(false);
            return;
        }

        const groupStatesRef = collection(db, 'users', userData.uid, 'groupStates');
        const unsubscribe = onSnapshot(groupStatesRef, (snapshot) => {
            const states: Record<string, { readMessageCount?: number }> = {};
            snapshot.forEach(docSnap => {
                states[docSnap.id] = docSnap.data();
            });
            setGroupStates(states);
            setLoadingGroupStates(false);
        }, (err) => {
            if (err.code !== 'permission-denied') console.error("Error fetching group states:", err);
            setLoadingGroupStates(false);
        });

        return () => unsubscribe();
    }, [userData?.uid]);

    // Use state-based userGroups to ensure we don't break Dashboard expectation
    const [userGroups, setUserGroups] = useState<Group[]>([]);

    useEffect(() => {
        const combined = rawUserGroups.map(group => {
            const state = groupStates[group.id];
            const readCount = Number(state?.readMessageCount || 0);
            const totalCount = Number(group.messageCount || 0);
            const unreadCount = Math.max(0, totalCount - readCount);

            return {
                ...group,
                unreadCount
            };
        }) as Group[];
        setUserGroups(combined);
    }, [rawUserGroups, groupStates]);

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
    }, [userGroups, userData, activeGroupId]);

    return { userGroups, activeGroupId, setActiveGroupId, loadingGroupStates };
};
