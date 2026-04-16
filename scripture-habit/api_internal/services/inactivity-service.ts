import { admin, db } from '../lib/firebase-admin.js';
import { calculateMemberStatus, InactivityMemberData, toMillis } from '../lib/inactivity-utils.js';
import { getGroupUpdatesForMultipleRemovals } from '../lib/membership-utils.js';
import { UserDocument, GroupDocument } from '../../types/firestore.js';
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

        // 2. "The Net" - Catch new groups that don't have the field yet.
        const newGroupsSnap = await groupsRef
            .where('lastInactivityCheckedAt', '==', null)
            .limit(50)
            .get();

        const list = [...staleGroupsSnap.docs];
        const seenIds = new Set(list.map(d => d.id));
        
        newGroupsSnap.docs.forEach(doc => {
            if (!seenIds.has(doc.id)) {
                list.push(doc);
                seenIds.add(doc.id);
            }
        });

        const stats = {
            processedGroups: 0,
            removedUsers: 0,
            initializedTracking: 0,
            transferredOwnerships: 0,
            deletedGroups: 0
        };

        for (const docSnapshot of list) {
            const result = await this.processGroupInactivity(docSnapshot.id);
            stats.processedGroups++;
            stats.removedUsers += result.removedCount;
            stats.initializedTracking += result.initializedCount;
            stats.transferredOwnerships += result.transferCount;
            if (result.groupDeleted) stats.deletedGroups++;
        }

        return stats;
    }

    /**
     * Processes inactivity for a single group.
     * Contains the core logic for identification and response.
     */
    static async processGroupInactivity(groupId: string) {
        const groupRef = db.collection('groups').doc(groupId);
        const groupSnap = await groupRef.get();
        if (!groupSnap.exists) return { removedCount: 0, initializedCount: 0, transferCount: 0, groupDeleted: false };

        const groupData = groupSnap.data() as GroupDocument;
        const membersSnap = await groupRef.collection('members').get();

        // 1. Ghost Buster: Safe cleanup of groups explicitly marked for deletion.
        if (groupData.isDeleted === true) {
            console.log(`[InactivityService] Purging group marked for deletion: ${groupId}`);
            await db.recursiveDelete(groupRef);
            return { removedCount: 0, initializedCount: 0, transferCount: 0, groupDeleted: true };
        }

        let ownerUserId = groupData.ownerUserId;
        const now = new Date();
        const batch = db.batch();


        const activeMembers: string[] = [];
        const inactiveMembers: string[] = [];
        let initializedCount = 0;
        const processedMemberIds = new Set<string>();

        // 2. Prepare Updates
        const groupUpdates: admin.firestore.UpdateData<GroupDocument> = {
            lastInactivityCheckedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // 3. Identify Status for each member in subcollection
        membersSnap.forEach(memberDoc => {
            const memberId = memberDoc.id;
            const memberData = memberDoc.data() as InactivityMemberData;
            memberData.createTime = memberDoc.createTime;
            processedMemberIds.add(memberId);

            // Guard: Detect joinedAt corrupted by old cron initialization (serverTimestamp bug).
            // Logic:
            // 1. If joinedAt is strictly in the future relative to createTime, it's definitely corrupted.
            // 2. If joinedAt is identical to createTime, it MIGHT be corrupted if we have older activity recorded
            //    in the group maps (proving they were already in the group before this document was created).
            if (memberData.joinedAt && memberDoc.createTime) {
                const joinedMs = (memberDoc.createTime as admin.firestore.Timestamp)?.toMillis?.() || 0;
                const storedJoinedMs = (memberData.joinedAt as admin.firestore.Timestamp)?.toMillis?.() || 0;
                
                let isCorrupted = (storedJoinedMs > joinedMs && joinedMs > 0);

                // Check for "Reset-to-CreateTime" corruption:
                // If they have activity OLDER than the creation time, then createTime is not the real join date.
                if (!isCorrupted && Math.abs(storedJoinedMs - joinedMs) < 10 && joinedMs > 0) {
                    const otherActivityMs = [
                        toMillis(groupData.memberLastActive?.[memberId]),
                        toMillis(groupData.memberLastReadAt?.[memberId]),
                        toMillis(memberData.lastActiveAt),
                        toMillis(memberData.lastPostAt)
                    ].filter(t => t > 0);

                    if (otherActivityMs.length > 0) {
                        const oldestActivity = Math.min(...otherActivityMs);
                        if (oldestActivity < storedJoinedMs - 1000) { // Solidly older
                            isCorrupted = true;
                            console.warn(`[InactivityService] Suspect joinedAt detected for ${memberId} (matches createTime but older activity exists). Repairing.`);
                        }
                    }
                }

                if (isCorrupted) {
                    console.warn(`[InactivityService] Repairing joinedAt for ${memberId} in ${groupId}.`);
                    // Fallback to the oldest recorded activity we found, or at least document creation
                    const fallbackMs = Math.min(...[
                        joinedMs, 
                        ...[toMillis(groupData.memberLastActive?.[memberId]), toMillis(groupData.memberLastReadAt?.[memberId])].filter(t => t > 0)
                    ]);
                    
                    const repairTimestamp = admin.firestore.Timestamp.fromMillis(fallbackMs);
                    memberData.joinedAt = repairTimestamp;
                    batch.update(memberDoc.ref, { joinedAt: repairTimestamp });
                    groupUpdates[`memberJoinedAt.${memberId}`] = repairTimestamp; // Sync repair
                }
            }

            const result = calculateMemberStatus(memberId, memberData, groupData, now);

            if (result.status === 'needs_initialization') {
                // Fix: Use createTime for initialization instead of "now" to avoid clock reset
                const initTime = memberDoc.createTime || admin.firestore.FieldValue.serverTimestamp();
                batch.update(memberDoc.ref, { joinedAt: initTime });
                groupUpdates[`memberJoinedAt.${memberId}`] = initTime; // Fortification: Sync map

                
                // Recalculate with the new initTime to see if they are actually inactive
                const secondLook = calculateMemberStatus(memberId, { ...memberData, joinedAt: initTime }, groupData, now);
                if (secondLook.status === 'inactive') {
                    inactiveMembers.push(memberId);
                } else {
                    activeMembers.push(memberId);
                }
                initializedCount++;
            } else if (result.status === 'inactive') {
                inactiveMembers.push(memberId);
            } else {
                activeMembers.push(memberId);
            }
        });

        // 3. Ghost Cleanup: Identify UIDs in maps/arrays missing from subcollection
        const groupMemberIds = groupData.members || [];
        const mapsToCheck = [
            groupData.memberLastActive,
            groupData.memberLastReadAt,
            groupData.memberKickThresholds,
            groupData.memberJoinedAt
        ];

        for (const map of mapsToCheck) {
            if (!map) continue;
            for (const uid in map) {
                if (!processedMemberIds.has(uid) && !inactiveMembers.includes(uid)) {
                    inactiveMembers.push(uid);
                }
            }
        }

        for (const uid of groupMemberIds) {
            if (!processedMemberIds.has(uid) && !inactiveMembers.includes(uid)) {
                inactiveMembers.push(uid);
            }
        }

        // 4. Handle Owner Inactivity
        let transferCount = 0;
        const groupDeleted = false;
        // groupUpdates already declared and partially populated

        if (ownerUserId && inactiveMembers.includes(ownerUserId)) {
            if (activeMembers.length > 0) {
                // Transfer ownership
                const newOwnerId = activeMembers[0];
                groupUpdates.ownerUserId = newOwnerId;
                ownerUserId = newOwnerId;
                transferCount++;

                // Post transfer message (localization)
                const newOwnerUserSnap = await db.collection('users').doc(newOwnerId).get();
                const transferLang = (newOwnerUserSnap.data() as UserDocument)?.language || 'en';
                
                const transferMsgRef = groupRef.collection('messages').doc();
                batch.set(transferMsgRef, {
                    text: t(transferLang, 'notifications.ownership_transferred'),
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    senderId: 'system',
                    isSystemMessage: true,
                    type: 'system',
                    messageType: 'system'
                });

            } else {
                // NO ACTIVE MEMBERS: Delete group safely
                // Cleanup user refs first
                const allMemberIdsInSub = membersSnap.docs.map(d => d.id);
                for (const uid of allMemberIdsInSub) {
                    const userRef = db.collection('users').doc(uid);
                    batch.update(userRef, {
                        groupIds: admin.firestore.FieldValue.arrayRemove(groupId),
                        groupId: admin.firestore.FieldValue.delete()
                    });
                    batch.delete(userRef.collection('groupStates').doc(groupId));
                }
                
                await batch.commit();
                await db.recursiveDelete(groupRef);
                return { removedCount: 0, initializedCount, transferCount: 0, groupDeleted: true };
            }
        }

        // 5. Final Removals
        const finalMembersToRemove = inactiveMembers.filter(uid => uid !== ownerUserId);
        if (finalMembersToRemove.length > 0 && ownerUserId) {
            const bulkRemovalUpdates = getGroupUpdatesForMultipleRemovals(groupData, finalMembersToRemove);
            Object.assign(groupUpdates, bulkRemovalUpdates);
            
            // Removal message
            const ownerUserSnap = await db.collection('users').doc(ownerUserId).get();
            const removalLang = (ownerUserSnap.data() as UserDocument)?.language || 'en';
            
            const removalMsgRef = groupRef.collection('messages').doc();
            batch.set(removalMsgRef, {
                text: t(removalLang, 'notifications.members_removed', { count: finalMembersToRemove.length }),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                senderId: 'system',
                isSystemMessage: true,
                type: 'leave',
                messageType: 'leave'
            });

            for (const uid of finalMembersToRemove) {
                const userRef = db.collection('users').doc(uid);
                batch.update(userRef, { 
                    groupIds: admin.firestore.FieldValue.arrayRemove(groupId),
                    groupId: admin.firestore.FieldValue.delete() 
                });
                batch.delete(userRef.collection('groupStates').doc(groupId));
                batch.delete(groupRef.collection('members').doc(uid));

                // Fire-and-forget push notification
                this.sendKickNotification(uid, groupId, groupData.name || 'Group').catch(() => {});
            }
        }

        // 6. Commit Updates
        batch.update(groupRef, groupUpdates);
        await batch.commit();

        return {
            removedCount: finalMembersToRemove.length,
            initializedCount,
            transferCount,
            groupDeleted
        };
    }

    private static async sendKickNotification(uid: string, groupId: string, groupName: string) {
        try {
            const tokens = await getUserFcmTokens(uid);
            if (tokens.length === 0) return;

            const uSnap = await db.collection('users').doc(uid).get();
            const lang = (uSnap.data() as UserDocument)?.language || 'en';

            const title = t(lang, 'notifications.kick_title');
            const body = t(lang, 'notifications.kick_body', { groupName });

            const result = await sendPushNotification(tokens, {
                title,
                body,
                data: { type: 'kick', groupId }
            });

            if (result.failedTokens.length > 0) {
                await cleanupTokens(uid, result.failedTokens);
            }
        } catch (err) {
            console.error(`[InactivityService] Failed to send kick notification to ${uid}:`, err);
        }
    }
}
