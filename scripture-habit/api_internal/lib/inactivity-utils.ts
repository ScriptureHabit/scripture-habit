/**
 * Utility for determining user inactivity in group chats.
 * 
 * Logic Summary:
 * 1. Activity is determined by ANY interaction: Posting, Reading, or Joining.
 * 2. A member is INACTIVE if the most recent activity is older than their threshold (default 3 days).
 * 3. Simplified: Removed the "new member" grace period. All activity counts equally.
 */

import { FirestoreTimestamp } from '../../types/firestore';

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
    memberLastActive?: Record<string, FirestoreTimestamp>;
    memberLastReadAt?: Record<string, FirestoreTimestamp>;
    memberKickThresholds?: Record<string, number>;
    memberJoinedAt?: Record<string, FirestoreTimestamp>;
    pace?: number;
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

    // 1. Collect All Timestamps
    const timestamps = [
        toMillis(memberData.joinedAt),
        toMillis(memberData.lastNoteAt),
        toMillis(memberData.lastPostAt),
        toMillis(memberData.lastReadAt),
        toMillis(memberData.lastActiveAt)
    ];

    if (groupData) {
        if (groupData.memberJoinedAt?.[memberId]) timestamps.push(toMillis(groupData.memberJoinedAt[memberId]));
        if (groupData.memberLastActive?.[memberId]) timestamps.push(toMillis(groupData.memberLastActive[memberId]));
        if (groupData.memberLastReadAt?.[memberId]) timestamps.push(toMillis(groupData.memberLastReadAt[memberId]));
    }

    // 2. Determine Most Recent Activity
    const lastActiveTime = Math.max(...timestamps);
    // 3. Threshold Calculation
    let thresholdDays = 3;
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
            lastActiveAt: lastActiveTime,
            thresholdMs: 0,
            diffMs: 0,
            reason: 'Auto-kick is disabled (Never).'
        };
    }

    const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;

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
