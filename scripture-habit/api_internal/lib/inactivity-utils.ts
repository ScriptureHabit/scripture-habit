/**
 * Utility for determining user inactivity in group chats.
 * 
 * Logic Summary:
 * 1. Activity is determined by note/study postings or join date baseline.
 * 2. A member is INACTIVE if the most recent activity is older than their threshold (default 3 days).
 * 3. Simplified: Removed the "new member" grace period. All activity counts equally.
 */

import { FirestoreTimestamp } from '../../types/firestore.js';
import { DEFAULT_KICK_THRESHOLD } from './constants.js';

export interface InactivityMemberData {
    joinedAt?: FirestoreTimestamp;
    createTime?: FirestoreTimestamp;
    lastNoteAt?: FirestoreTimestamp;
    lastPostAt?: FirestoreTimestamp;
    lastReadAt?: FirestoreTimestamp;
    lastActiveAt?: FirestoreTimestamp;
    kickThreshold?: number;
}

export interface InactivityGroupData {
    ownerUserId?: string;
    isDeleted?: boolean;
    memberLastActive?: Record<string, FirestoreTimestamp>;
    memberLastReadAt?: Record<string, FirestoreTimestamp>;
    memberKickThresholds?: Record<string, number>;
    memberJoinedAt?: Record<string, FirestoreTimestamp>;
    pace?: number;
    createdAt?: FirestoreTimestamp;
    name?: string;
}

export type InactivityStatus = 'active' | 'inactive' | 'needs_initialization';

export interface InactivityResult {
    status: InactivityStatus;
    lastActiveTime: number;
    thresholdMs: number;
    diffMs: number;
    reason: string;
}

/**
 * Standardizes various Firestore timestamp formats to milliseconds.
 */
export function toMillis(ts: unknown): number {
    if (!ts) return 0;
    if (ts && typeof ts === 'object' && 'toMillis' in ts && typeof (ts as { toMillis: unknown }).toMillis === 'function') {
        return (ts as { toMillis: () => number }).toMillis();
    }
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts === 'number') return ts;
    if (typeof ts === 'string') {
        const d = new Date(ts);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    }
    const tsObj = ts as { seconds?: number; _seconds?: number };
    if (tsObj.seconds !== undefined) return tsObj.seconds * 1000;
    if (tsObj._seconds !== undefined) return tsObj._seconds * 1000;
    return 0;
}

export function calculateMemberStatus(
    memberId: string,
    memberData: InactivityMemberData,
    groupData: InactivityGroupData,
    now: Date = new Date()
): InactivityResult {
    const nowTime = now.getTime();

    // 1. Collect All Timestamps (Only note/study postings & join date baseline count for kick determination)
    const timestamps = [
        toMillis(memberData.joinedAt),
        toMillis(memberData.lastNoteAt),
        toMillis(memberData.lastPostAt)
    ];

    if (groupData) {
        if (groupData.memberJoinedAt?.[memberId]) timestamps.push(toMillis(groupData.memberJoinedAt[memberId]));
    }

    // 2. Determine Most Recent Activity
    const lastActiveTime = Math.max(...timestamps);
    // 3. Threshold Calculation
    let thresholdDays = DEFAULT_KICK_THRESHOLD;
    if (memberData.kickThreshold !== undefined) {
        thresholdDays = memberData.kickThreshold;
    } else if (groupData?.memberKickThresholds?.[memberId] !== undefined) {
        thresholdDays = groupData.memberKickThresholds[memberId];
    } else if (groupData?.pace !== undefined) {
        thresholdDays = groupData.pace;
    }

    // 0 threshold means "Never Kick" - always active
    if (thresholdDays === 0) {
        return {
            status: 'active',
            lastActiveTime: lastActiveTime,
            thresholdMs: 0,
            diffMs: 0,
            reason: 'Auto-kick is disabled (Never).'
        };
    }

    const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;

    // 1. Ghost/New Member Detection
    if (!memberData.joinedAt) {
        if (!memberData.createTime && !memberData.lastActiveAt) {
            // This is a "Ghost": member in group list but no subcollection doc
            return { status: 'inactive', lastActiveTime: 0, thresholdMs, diffMs: 0, reason: 'ghost' };
        }
        return { status: 'needs_initialization', lastActiveTime: 0, thresholdMs, diffMs: 0, reason: 'Needs initialization.' };
    }

    if (lastActiveTime === 0) {
        return {
            status: 'needs_initialization',
            lastActiveTime: 0,
            thresholdMs,
            diffMs: 0,
            reason: 'No activity timestamps found. Requires joinedAt initialization.'
        };
    }

    const diffMs = nowTime - lastActiveTime;
    const isInactive = diffMs > thresholdMs;
    const status: InactivityStatus = isInactive ? 'inactive' : 'active';

    let description = 'Recently active.';
    if (isInactive) {
        const days = diffMs / (24 * 60 * 60 * 1000);
        description = `Inactive for ${days.toFixed(1)} days (Threshold: ${thresholdDays} days).`;
    }

    return {
        status,
        lastActiveTime,
        thresholdMs,
        diffMs,
        reason: description
    };
}

/**
 * Results of the group-level inactivity decision.
 */
export interface GroupInactivityDecision {
    shouldDeleteGroup: boolean;         // Whether to delete the entire group
    newOwnerId?: string;                // UID of the new owner if ownership is transferred
    membersToRemove: string[];          // List of UIDs to be removed from the group
    membersToInitialize: string[];      // List of UIDs whose joinedAt needs to be initialized
    membersToRepair: { uid: string, joinedAt: number }[]; // List of UIDs with corrupted joinedAt
}

/**
 * Pure logic function that decides what actions to take for a group based on inactivity.
 * This function does NOT perform any I/O and can be easily unit tested.
 */
export function decideGroupInactivity(
    groupData: InactivityGroupData,
    members: { uid: string, data: InactivityMemberData, createTime?: FirestoreTimestamp }[],
    now: Date = new Date()
): GroupInactivityDecision {
    const decision: GroupInactivityDecision = {
        shouldDeleteGroup: false,
        membersToRemove: [],
        membersToInitialize: [],
        membersToRepair: []
    };

    // 1. Ghost Buster: Check for explicit deletion flag
    if (groupData.isDeleted === true) {
        decision.shouldDeleteGroup = true;
        return decision;
    }

    const activeMemberIds: string[] = [];
    const inactiveMemberIds: string[] = [];
    const ownerUserId = groupData.ownerUserId;

    // 2. Identify Status for each member
    for (const member of members) {
        const memberId = member.uid;
        const memberData = member.data;

        // Guard: Detect joinedAt corrupted by serverTimestamp bug or reset-to-createTime.
        if (memberData.joinedAt && member.createTime) {
            const joinedMs = toMillis(member.createTime);
            const storedJoinedMs = toMillis(memberData.joinedAt);
            
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
                    }
                }
            }

            if (isCorrupted) {
                const fallbackMs = Math.min(...[
                    joinedMs, 
                    ...[toMillis(groupData.memberLastActive?.[memberId]), toMillis(groupData.memberLastReadAt?.[memberId])].filter(t => t > 0)
                ]);
                decision.membersToRepair.push({ uid: memberId, joinedAt: fallbackMs });
                // Use the repaired value for calculation
                memberData.joinedAt = fallbackMs;
            }
        }

        const result = calculateMemberStatus(memberId, memberData, groupData, now);

        if (result.status === 'needs_initialization') {
            decision.membersToInitialize.push(memberId);
            activeMemberIds.push(memberId);
        } else if (result.status === 'inactive') {
            inactiveMemberIds.push(memberId);
        } else {
            activeMemberIds.push(memberId);
        }
    }

    // 3. Handle Owner Inactivity
    if (ownerUserId && inactiveMemberIds.includes(ownerUserId)) {
        const otherActiveMembers = activeMemberIds.filter(id => id !== ownerUserId);

        if (otherActiveMembers.length > 0) {
            decision.newOwnerId = otherActiveMembers[0];
        } else {
            decision.shouldDeleteGroup = true;
            return decision;
        }
    }

    // 4. Finalize Removals
    const finalOwnerId = decision.newOwnerId || ownerUserId;
    decision.membersToRemove = inactiveMemberIds.filter(uid => uid !== finalOwnerId);

    return decision;
}
