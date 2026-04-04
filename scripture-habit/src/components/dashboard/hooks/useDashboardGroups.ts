import { useState, useEffect } from 'react';
import { doc, onSnapshot, collection, FirestoreError, query, where } from 'firebase/firestore';
import { db } from '../../../firebase';
import { UserData } from '../../../types/user';
import { Group } from '../../../types/chat';
import { groupMemberConverter } from '../../../utils/firestoreConverters';

export const useDashboardGroups = (userData: UserData | null, initialGroupId: string | null) => {
    const [userGroups, setUserGroups] = useState<Group[]>([]);
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

        // Set active group if not set
        if (!activeGroupId && groupIds.length > 0) {
            setActiveGroupId(groupIds[0]);
        }

        const unsubscribers: (() => void)[] = [];

        // 1. Unified Listener for all Groups (up to 30)
        const groupsQuery = query(
            collection(db, 'groups'),
            where('members', 'array-contains', userData.uid)
        );

        const unsubGroups = onSnapshot(groupsQuery, { includeMetadataChanges: true }, (snapshot) => {
            const groupsMap: Record<string, Group> = {};
            snapshot.docs.forEach(docSnap => {
                groupsMap[docSnap.id] = { id: docSnap.id, ...docSnap.data() } as Group;
            });

            setRawUserGroups(prev => {
                // Maintain original order from groupIds list
                return groupIds
                    .map(id => groupsMap[id] || prev.find(g => g.id === id))
                    .filter(Boolean) as Group[];
            });
        }, (err) => {
            if (err.code !== 'permission-denied') console.error("Dashboard groups query listener error:", err);
        });
        unsubscribers.push(unsubGroups);

        // 2. Specialized Listeners for Member specific data in each group
        groupIds.forEach(gid => {
            const memberRef = doc(db, 'groups', gid, 'members', userData.uid).withConverter(groupMemberConverter);
            const unsubMember = onSnapshot(memberRef, (memberSnap) => {
                if (memberSnap.exists()) {
                    const mData = memberSnap.data();
                    setRawUserGroups(prev => prev.map(g => 
                        g.id === gid ? { ...g, myMemberStatus: mData } : g
                    ));
                }
            }, (err) => {
                if (err.code !== 'permission-denied') console.log(`Member fetch error ${gid}:`, err);
            });
            unsubscribers.push(unsubMember);
        });

        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }, [userData?.uid, groupIdsKey, activeGroupId === null]);



    // Fetch user group states (read counts)
    useEffect(() => {
        if (!userData?.uid) return;

        setLoadingGroupStates(true);
        const groupStatesRef = collection(db, 'users', userData.uid, 'groupStates');
        const unsubscribe = onSnapshot(groupStatesRef, (snapshot) => {
            const states: Record<string, { readMessageCount?: number }> = {};
            snapshot.forEach(doc => {
                states[doc.id] = doc.data();
            });
            setGroupStates(states);
            setLoadingGroupStates(false);
        }, (err: FirestoreError) => {
            if (err.code !== 'permission-denied') {
                console.log("Error fetching group states:", err);
            }
            setLoadingGroupStates(false);
        });

        return () => unsubscribe();
    }, [userData?.uid]);

    // Combine raw groups with unread counts
    useEffect(() => {
        const combinedGroups = rawUserGroups.map(group => {
            const state = groupStates[group.id];
            const readCount = loadingGroupStates ? (group.messageCount || 0) : (state?.readMessageCount || 0);
            const totalCount = group.messageCount || 0;
            const unreadCount = Math.max(0, totalCount - readCount);

            return {
                ...group,
                unreadCount
            };
        });
        setUserGroups(combinedGroups as Group[]);
    }, [rawUserGroups, groupStates, loadingGroupStates]);

    // Update activeGroupId if it needs to be updated based on memberships
    useEffect(() => {
        if (!userData) return;

        if (userGroups.length > 0) {
            const isActiveGroupLoaded = userGroups.find(g => g.id === activeGroupId);
            if (!isActiveGroupLoaded) {
                const userGroupIds = userData?.groupIds || (userData?.groupId ? [userData.groupId] : []);
                const isMemberOfActiveGroup = activeGroupId && userGroupIds.includes(activeGroupId);

                if (!isMemberOfActiveGroup) {
                    setActiveGroupId(userGroups[0].id);
                }
            }
        } else {
            const hasGroups = (userData.groupIds && userData.groupIds.length > 0) || userData.groupId;
            if (!hasGroups) {
                setActiveGroupId(null);
            }
        }
    }, [userGroups, userData, activeGroupId]);

    return { userGroups, activeGroupId, setActiveGroupId, loadingGroupStates };
};
