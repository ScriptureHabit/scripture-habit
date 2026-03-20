import { useState, useEffect } from 'react';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { db } from '../../../firebase';
import { UserData } from '../../../types/user';
import { Group } from '../../../types/chat';

export const useDashboardGroups = (userData: UserData | null, initialGroupId: string | null) => {
    const [userGroups, setUserGroups] = useState<Group[]>([]);
    const [rawUserGroups, setRawUserGroups] = useState<Group[]>([]);
    const [groupStates, setGroupStates] = useState<Record<string, any>>({});
    const [loadingGroupStates, setLoadingGroupStates] = useState<boolean>(true);
    const [activeGroupId, setActiveGroupId] = useState<string | null>(initialGroupId);

    // Fetch user groups details
    useEffect(() => {
        if (!userData) return;

        const groupIds: string[] = userData.groupIds || (userData.groupId ? [userData.groupId] : []);

        if (groupIds.length === 0) {
            setRawUserGroups([]);
            return;
        }

        // Set active group if not set
        if (!activeGroupId && groupIds.length > 0) {
            setActiveGroupId(groupIds[0]);
        }

        const fetchGroups = async () => {
            const unsubscribers: (() => void)[] = [];
            const groupsData: Record<string, any> = {};

            groupIds.forEach(gid => {
                const unsub = onSnapshot(doc(db, 'groups', gid), (docSnap) => {
                    if (docSnap.exists()) {
                        groupsData[gid] = { id: gid, ...docSnap.data() };
                        setRawUserGroups(prev => {
                            const newGroups = groupIds
                                .map(id => groupsData[id] || prev.find(g => g.id === id))
                                .filter(Boolean);
                            return newGroups as Group[];
                        });
                    }
                }, (err: any) => {
                    if (err.code !== 'permission-denied') {
                        console.log(`Error fetching group ${gid}:`, err);
                    }
                });
                unsubscribers.push(unsub);
            });

            return () => {
                unsubscribers.forEach(unsub => unsub());
            };
        };

        const cleanupPromise = fetchGroups();
        return () => {
            cleanupPromise.then(cleanup => cleanup && cleanup());
        };
    }, [userData?.groupIds, userData?.groupId]);

    // Fetch user group states (read counts)
    useEffect(() => {
        if (!userData?.uid) return;

        setLoadingGroupStates(true);
        const groupStatesRef = collection(db, 'users', userData.uid, 'groupStates');
        const unsubscribe = onSnapshot(groupStatesRef, (snapshot) => {
            const states: Record<string, any> = {};
            snapshot.forEach(doc => {
                states[doc.id] = doc.data();
            });
            setGroupStates(states);
            setLoadingGroupStates(false);
        }, (err: any) => {
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
