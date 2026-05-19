import { admin, db } from '../lib/firebase-admin.js';
import { decideGroupInactivity, calculateMemberStatus, InactivityMemberData } from '../lib/inactivity-utils.js';
import { getGroupUpdatesForMultipleRemovals } from '../lib/membership-utils.js';
import { UserDocument, GroupDocument } from '../../types/firestore.js';
import { Group } from '../../src/types/chat.js';
import { calculateUnityPercentage } from '../../src/utils/unity-utils.js';
import { t } from '../lib/i18n.js';
import { getUserFcmTokens, sendPushNotification, cleanupTokens } from '../lib/notifications.js';

export class InactivityService {
    /**
     * Scans a batch of groups and processes inactive members.
     * Mimics the rotation logic from the original cron.
     */
    static async batchCheckInactivity(limit: number = 100) {
        const groupsRef = db.collection('groups');
        
        // 1. Rotation - Fetch groups that haven't been checked in the longest time.
        const staleGroupsSnap = await groupsRef
            .orderBy('lastInactivityCheckedAt', 'asc')
            .limit(limit)
            .get();

        // 2. "The Net" - Catch new groups by looking at recently created ones.
        // This ensures groups missing lastInactivityCheckedAt eventually get into the rotation.
        const newGroupsSnap = await groupsRef
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();

        const list = [...staleGroupsSnap.docs];
        
        // Add new groups, but avoid duplicates and only if they haven't been checked yet
        const existingIds = new Set(list.map(d => d.id));
        for (const doc of newGroupsSnap.docs) {
            if (list.length >= limit + 10) break; // Allow a small buffer for new groups
            const data = doc.data() as GroupDocument;
            if (!existingIds.has(doc.id) && !data.lastInactivityCheckedAt) {
                list.push(doc);
            }
        }

        const stats = {
            processedGroups: 0,
            removedUsers: 0,
            initializedTracking: 0,
            transferredOwnerships: 0,
            deletedGroups: 0
        };

        for (const docSnapshot of list) {
            try {
                const result = await this.processGroupInactivity(docSnapshot.id);
                stats.processedGroups++;
                stats.removedUsers += result.removedCount;
                stats.initializedTracking += result.initializedCount;
                stats.transferredOwnerships += result.transferCount;
                if (result.groupDeleted) stats.deletedGroups++;
            } catch (err) {
                console.error(`[InactivityService] Failed to process group ${docSnapshot.id}:`, err);
                throw err;
            }
        }

        return stats;
    }

    /**
     * Processes inactivity for a single group.
     */
    static async processGroupInactivity(groupId: string) {
        const groupRef = db.collection('groups').doc(groupId);
        const groupSnap = await groupRef.get();
        if (!groupSnap.exists) return { removedCount: 0, initializedCount: 0, transferCount: 0, groupDeleted: false };

        const groupData = groupSnap.data() as GroupDocument;
        const membersArray = groupData.members || [];
        const now = new Date();

        // 1. Self-Healing: Check if subcollection is empty using limit(1) to save reads
        if (membersArray.length > 0) {
            const oneMemberSnap = await groupRef.collection('members').limit(1).get();
            if (oneMemberSnap.empty) {
                console.log(`[InactivityService] Healing uninitialized members subcollection for group: ${groupId}`);
                const healBatch = db.batch();
                for (const uid of membersArray) {
                    const memberRef = groupRef.collection('members').doc(uid);
                    const joinedAt = groupData.memberJoinedAt?.[uid] || groupData.createdAt || admin.firestore.FieldValue.serverTimestamp();
                    healBatch.set(memberRef, {
                        uid, joinedAt,
                        lastActiveAt: groupData.memberLastActive?.[uid] || joinedAt,
                        lastReadAt: groupData.memberLastReadAt?.[uid] || joinedAt,
                        kickThreshold: groupData.memberKickThresholds?.[uid] || 3,
                        readMessageCount: 0
                    });
                }
                await healBatch.commit();
                // After healing, maps are still what they were, but subcollection is populated.
            }
        }

        // 2. Prepare Data for Decision using group maps to save reads
        const allPossibleUids = new Set([
            ...membersArray,
            ...Object.keys(groupData.memberLastActive || {}),
            ...Object.keys(groupData.memberJoinedAt || {})
        ]);

        const activeMemberIds = new Set<string>();
        const potentiallyInactiveUids = new Set<string>();

        for (const uid of allPossibleUids) {
            const joinedAt = groupData.memberJoinedAt?.[uid];
            const lastActive = groupData.memberLastActive?.[uid];
            const lastRead = groupData.memberLastReadAt?.[uid];
            
            // If we lack map data, or they seem inactive based on map data, mark for deep check
            if (!joinedAt && !lastActive && !lastRead) {
                potentiallyInactiveUids.add(uid);
            } else {
                const mockMemberData: InactivityMemberData = {
                    joinedAt: joinedAt,
                    lastActiveAt: lastActive,
                    lastReadAt: lastRead,
                    kickThreshold: groupData.memberKickThresholds?.[uid]
                };
                const result = calculateMemberStatus(uid, mockMemberData, groupData, now);
                if (result.status === 'active') {
                    activeMemberIds.add(uid);
                } else {
                    potentiallyInactiveUids.add(uid);
                }
            }
        }

        const memberList: { uid: string; data: InactivityMemberData; createTime?: admin.firestore.Timestamp }[] = [];

        // Fill firmly active members with mock data
        for (const uid of activeMemberIds) {
            memberList.push({
                uid,
                data: {
                    joinedAt: groupData.memberJoinedAt?.[uid],
                    lastActiveAt: groupData.memberLastActive?.[uid],
                    lastReadAt: groupData.memberLastReadAt?.[uid],
                    kickThreshold: groupData.memberKickThresholds?.[uid]
                } as InactivityMemberData
            });
        }

        // Fetch subcollection docs ONLY for potentially inactive members
        const uidsToFetch = Array.from(potentiallyInactiveUids);
        if (uidsToFetch.length > 0) {
            for (let i = 0; i < uidsToFetch.length; i += 100) {
                const chunk = uidsToFetch.slice(i, i + 100);
                const refs = chunk.map(uid => groupRef.collection('members').doc(uid));
                const docs = await db.getAll(...refs);
                for (let j = 0; j < docs.length; j++) {
                    const doc = docs[j];
                    const uid = chunk[j];
                    if (doc.exists) {
                        memberList.push({
                            uid,
                            data: doc.data() as InactivityMemberData,
                            createTime: doc.createTime
                        });
                    } else {
                        // Ghost!
                        const emptyData: InactivityMemberData = {};
                        memberList.push({ uid, data: emptyData });
                    }
                }
            }
        }

        // 3. Get Decision from Pure Logic
        const decision = decideGroupInactivity(groupData, memberList, now);

        // 4. Execute Decision
        if (decision.shouldDeleteGroup) {
            // Cleanup user refs first
            const batch = db.batch();
            for (const member of memberList) {
                const userRef = db.collection('users').doc(member.uid);
                batch.set(userRef, {
                    groupIds: admin.firestore.FieldValue.arrayRemove(groupId),
                    groupId: admin.firestore.FieldValue.delete()
                }, { merge: true });
                batch.delete(userRef.collection('groupStates').doc(groupId));
            }
            await batch.commit();
            await db.recursiveDelete(groupRef);
            return { removedCount: 0, initializedCount: 0, transferCount: 0, groupDeleted: true };
        }

        const batch = db.batch();
        const groupUpdates: admin.firestore.UpdateData<GroupDocument> = {
            lastInactivityCheckedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // Handle Repairs
        for (const repair of decision.membersToRepair) {
            console.warn(`[InactivityService] Repairing joinedAt for ${repair.uid} in ${groupId}.`);
            const repairTS = admin.firestore.Timestamp.fromMillis(repair.joinedAt);
            batch.update(groupRef.collection('members').doc(repair.uid), { joinedAt: repairTS });
            groupUpdates[`memberJoinedAt.${repair.uid}`] = repairTS;
        }

        // Handle Initializations
        for (const uid of decision.membersToInitialize) {
            const memberObj = memberList.find(m => m.uid === uid);
            const initTime = memberObj?.createTime || admin.firestore.FieldValue.serverTimestamp();
            batch.update(groupRef.collection('members').doc(uid), { joinedAt: initTime });
            groupUpdates[`memberJoinedAt.${uid}`] = initTime;
        }

        // Handle Ownership Transfer
        if (decision.newOwnerId) {
            groupUpdates.ownerUserId = decision.newOwnerId;
            
            // Post transfer message
            const newOwnerUserSnap = await db.collection('users').doc(decision.newOwnerId).get();
            const lang = (newOwnerUserSnap.data() as UserDocument)?.language || 'en';
            batch.set(groupRef.collection('messages').doc(), {
                text: t(lang, 'notifications.ownership_transferred'),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                senderId: 'system', isSystemMessage: true, type: 'system', messageType: 'system'
            });
        }

        // Handle Removals
        if (decision.membersToRemove.length > 0) {
            // Update group-level array and count
            const bulkRemovalUpdates = getGroupUpdatesForMultipleRemovals(groupData, decision.membersToRemove);
            Object.assign(groupUpdates, bulkRemovalUpdates);

            // Recalculate Unity Percentage
            const nextMembers = ((groupData.members || []) as string[]).filter(uid => !decision.membersToRemove.includes(uid));
            const remainingActive = ((groupData.dailyActivity?.activeMembers || []) as string[]).filter(uid => !decision.membersToRemove.includes(uid));
            
            const simulatedGroup = {
                ...groupData,
                members: nextMembers,
                dailyActivity: {
                    ...groupData.dailyActivity,
                    activeMembers: remainingActive
                }
            };
            groupUpdates.unityPercentage = calculateUnityPercentage(simulatedGroup as unknown as Group, [], now);

            // Removal message (sent to the remaining owner)
            const ownerId = decision.newOwnerId || groupData.ownerUserId;
            if (ownerId) {
                const ownerSnap = await db.collection('users').doc(ownerId).get();
                const lang = (ownerSnap.data() as UserDocument)?.language || 'en';
                batch.set(groupRef.collection('messages').doc(), {
                    text: t(lang, 'notifications.members_removed', { count: decision.membersToRemove.length }),
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    senderId: 'system', isSystemMessage: true, type: 'leave', messageType: 'leave'
                });
            }

            for (const uid of decision.membersToRemove) {
                const userRef = db.collection('users').doc(uid);
                // Use set with merge for robustness against missing fields/docs
                batch.set(userRef, { 
                    groupIds: admin.firestore.FieldValue.arrayRemove(groupId),
                    groupId: admin.firestore.FieldValue.delete() 
                }, { merge: true });
                batch.delete(userRef.collection('groupStates').doc(groupId));
                batch.delete(groupRef.collection('members').doc(uid));
                
                this.sendKickNotification(uid, groupId, groupData.name || 'Group').catch(() => {});
            }
        }

        batch.update(groupRef, groupUpdates);
        
        try {
            await batch.commit();
        } catch (err) {
            const error = err as { code?: number | string; message?: string };
            const isNotFound = error.code === 5 || 
                error.code === 'not-found' ||
                error.message?.includes('NOT_FOUND') || 
                error.message?.includes('no entity to update');
                
            if (isNotFound) {
                console.warn(`[InactivityService] Group ${groupId} was deleted or not found during batch commit. Skipping gracefully.`);
                return {
                    removedCount: 0,
                    initializedCount: 0,
                    transferCount: 0,
                    groupDeleted: true
                };
            }
            console.error(`[InactivityService] Batch commit failed for group ${groupId}. Decision:`, JSON.stringify(decision));
            throw err;
        }

        return {
            removedCount: decision.membersToRemove.length,
            initializedCount: decision.membersToInitialize.length,
            transferCount: decision.newOwnerId ? 1 : 0,
            groupDeleted: false
        };
    }

    private static async sendKickNotification(uid: string, groupId: string, groupName: string) {
        try {
            const tokens = await getUserFcmTokens(uid);
            if (tokens.length === 0) return;

            const uSnap = await db.collection('users').doc(uid).get();
            const lang = ((uSnap.data() as UserDocument)?.language || 'en').split('-')[0].toLowerCase();

            const title = t(lang, 'notifications.kick_title');
            const body = t(lang, 'notifications.kick_body', { groupName });

            const result = await sendPushNotification(tokens, {
                title,
                body,
                data: { type: 'kick', groupId, lang }
            });

            if (result.failedTokens.length > 0) {
                await cleanupTokens(uid, result.failedTokens);
            }
        } catch (err) {
            console.error(`[InactivityService] Failed to send kick notification to ${uid}:`, err);
        }
    }
}
