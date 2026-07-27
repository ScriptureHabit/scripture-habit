import { admin, db } from './firebase-admin.js';
import { GroupDocument, MemberPreview, UserDocument } from '../../types/firestore.js';
import { t } from './i18n.js';
import { getMessageExpireAt } from './ttl-utils.js';
import { MessageService } from '../services/message-service.js';

/**
 * Options for member removal
 */
export interface RemoveMemberOptions {
    /** If true, also removes this groupId from users/{uid}.groupIds array */
    removeFromUserDoc?: boolean;
    /** If true, clears users/{uid}.groupId IF it matches this groupId */
    clearUserGroupId?: boolean;
    /** If true, also deletes the users/{uid}/groupStates/{groupId} document */
    removeGroupState?: boolean;
    /** If true, transfers ownership to the next member if the leaving user is the owner */
    transferOwnership?: boolean;
    /** Language for the system message (defaults to 'en') */
    preferredLanguage?: string;
    /** Optional system message to post upon removal */
    systemMessage?: {
        type: 'leave' | 'kick';
        nickname: string;
    };
    /** Pre-loaded user document snapshot to avoid redundant reads */
    userDoc?: admin.firestore.DocumentSnapshot;
    /** Pre-loaded group document snapshot to avoid redundant reads */
    groupDoc?: admin.firestore.DocumentSnapshot;
}

/**
 * Generates updates for multiple members removal. Optimized for Cron/Bulk cleanup.
 */
export function getGroupUpdatesForMultipleRemovals(
    groupData: GroupDocument,
    userIds: string[]
): Record<string, admin.firestore.FieldValue | string | number | boolean | string[] | object | undefined | null> {
    const groupUpdate: Record<string, admin.firestore.FieldValue | string | number | boolean | string[] | object | undefined | null> = {
        members: admin.firestore.FieldValue.arrayRemove(...userIds),
    };

    for (const uid of userIds) {
        groupUpdate[`memberJoinedAt.${uid}`] = admin.firestore.FieldValue.delete();
        groupUpdate[`memberLastActive.${uid}`] = admin.firestore.FieldValue.delete();
        groupUpdate[`memberLastReadAt.${uid}`] = admin.firestore.FieldValue.delete();
        groupUpdate[`memberKickThresholds.${uid}`] = admin.firestore.FieldValue.delete();
    }

    const members = (groupData.members || []) as string[];
    const nextMembers = members.filter(uid => !userIds.includes(uid));
    groupUpdate.membersCount = nextMembers.length;

    if (nextMembers.length === 0) {
        // TRUTH: Mark as deleted so cron can safely recursiveDelete subcollections outside a transaction
        groupUpdate.isDeleted = true;
    }

    const existingPreviews = (groupData.memberPreviews || []) as MemberPreview[];
    groupUpdate.memberPreviews = existingPreviews.filter(p => !userIds.includes(p.uid));

    if (groupData.dailyActivity?.activeMembers) {
        const remainingActive = (groupData.dailyActivity.activeMembers as string[]).filter(id => !userIds.includes(id));
        if (remainingActive.length !== groupData.dailyActivity.activeMembers.length) {
            groupUpdate['dailyActivity.activeMembers'] = remainingActive;
        }
    }

    return groupUpdate;
}

/**
 * Generates the update object for the group document when removing a member.
 */
export function getGroupUpdateForRemoval(
    groupData: GroupDocument,
    userId: string
): Record<string, admin.firestore.FieldValue | string | number | boolean | string[] | object | undefined | null> {
    return getGroupUpdatesForMultipleRemovals(groupData, [userId]);
}

/**
 * Robustly removes a member from a group, cleaning up ALL denormalized data
 * across the group document, subcollection, and activity maps.
 * 
 * MUST be called within a transaction.
 */
export async function removeMemberFromGroup(
    transaction: admin.firestore.Transaction,
    groupId: string,
    userId: string,
    options: RemoveMemberOptions = {}
) {
    const groupRef = db.collection('groups').doc(groupId);
    const memberDocRef = groupRef.collection('members').doc(userId);
    const userRef = db.collection('users').doc(userId);

    const latestRef = groupRef.collection('messages_latest').doc('latest');

    // 1. Get current data (Reads must come BEFORE any writes)
    let groupSnap = options.groupDoc;
    let userSnap = options.userDoc;

    const refsToGet: admin.firestore.DocumentReference[] = [];
    if (!groupSnap) refsToGet.push(groupRef);
    if (!userSnap) refsToGet.push(userRef);

    if (refsToGet.length > 0) {
        const snaps = typeof transaction.getAll === 'function'
            ? await transaction.getAll(...refsToGet)
            : await Promise.all(refsToGet.map(ref => transaction.get(ref)));
        let snapIdx = 0;
        if (!groupSnap) groupSnap = snaps[snapIdx++];
        if (!userSnap) userSnap = snaps[snapIdx++];
    }

    if (!groupSnap || !userSnap) return;

    if (!groupSnap.exists) return;
    const groupData = groupSnap.data() as GroupDocument || {};

    // 2. Prepare group updates
    const groupUpdate = getGroupUpdateForRemoval(groupData, userId);

    // 3. Handle Ownership Transfer
    const members = (groupData.members || []) as string[];
    const remainingMembers = members.filter(m => m !== userId);

    if (groupData.ownerUserId === userId && options.transferOwnership) {
        if (remainingMembers.length > 0) {
            const joinedAtMap = groupData.memberJoinedAt || {};
            let oldestUid = remainingMembers[0];
            let oldestTime = Number.MAX_SAFE_INTEGER;

            for (const mUid of remainingMembers) {
                const rawTs = joinedAtMap[mUid];
                let tsMillis = Number.MAX_SAFE_INTEGER;
                if (rawTs) {
                    if (typeof rawTs === 'object' && 'seconds' in rawTs && typeof (rawTs as { seconds: number }).seconds === 'number') {
                        tsMillis = (rawTs as { seconds: number }).seconds * 1000;
                    } else if (typeof rawTs === 'object' && 'toDate' in rawTs && typeof (rawTs as { toDate: () => Date }).toDate === 'function') {
                        tsMillis = (rawTs as { toDate: () => Date }).toDate().getTime();
                    } else if (typeof rawTs === 'number') {
                        tsMillis = rawTs;
                    } else if (typeof rawTs === 'string') {
                        const parsed = Date.parse(rawTs);
                        if (!isNaN(parsed)) tsMillis = parsed;
                    }
                }
                if (tsMillis < oldestTime) {
                    oldestTime = tsMillis;
                    oldestUid = mUid;
                } else if (tsMillis === oldestTime) {
                    // Tie-breaker: Deterministic string comparison of UID if timestamps match or are missing
                    if (mUid.localeCompare(oldestUid) < 0) {
                        oldestUid = mUid;
                    }
                }
            }

            const newOwnerId = oldestUid;
            groupUpdate.ownerUserId = newOwnerId;
        }
    }

    // 3.5. Read latestSnap conditionally (must come before execution phase / writes start)
    let latestSnap: admin.firestore.DocumentSnapshot | undefined;
    if (options.systemMessage) {
        latestSnap = await transaction.get(latestRef);
    }

    // 4. Execution Phase (WRITES ONLY from here on)
    transaction.update(groupRef, groupUpdate);
    transaction.delete(memberDocRef);

    if (options.removeFromUserDoc) {
        transaction.update(userRef, {
            groupIds: admin.firestore.FieldValue.arrayRemove(groupId)
        });
    }

    if (options.clearUserGroupId) {
        if (userSnap.exists && (userSnap.data() as UserDocument)?.groupId === groupId) {
            transaction.update(userRef, {
                groupId: admin.firestore.FieldValue.delete()
            });
        }
    }

    if (options.removeGroupState) {
        const gsRef = userRef.collection('groupStates').doc(groupId);
        transaction.delete(gsRef);
    }

    // 6. Post System Message if requested
    if (options.systemMessage) {
        const msgRef = groupRef.collection('messages').doc();
        const lang = options.preferredLanguage || 'en';
        
        const text = options.systemMessage.type === 'leave' 
            ? t(lang, 'notifications.member_leave_message', { nickname: options.systemMessage.nickname })
            : t(lang, 'notifications.member_kick_message', { nickname: options.systemMessage.nickname });
        
        const leaveMsg = {
            text,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            senderId: 'system',
            isSystemMessage: true,
            type: options.systemMessage.type,
            messageType: options.systemMessage.type,
            expireAt: getMessageExpireAt()
        };
        transaction.set(msgRef, leaveMsg);
        await MessageService.appendToLatest(transaction, groupId, { id: msgRef.id, ...leaveMsg, createdAt: admin.firestore.Timestamp.now() }, latestSnap);
    }

    console.log(`[MembershipUtils] Successfully removed user ${userId} from group ${groupId}`);
}

