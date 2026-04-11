/**
 * Utility for determining user inactivity in group chats.
 * 
 * Logic Summary:
 * 1. Activity is primarily determined by POSTING (lastNoteAt, lastPostAt).
 * 2. JOINING counts as activity.
 * 3. READING (lastReadAt, lastActiveAt) ONLY counts as activity for the first 3 days after joining.
 * 4. A member is INACTIVE if the most recent qualifying activity is older than their threshold (default 3 days).
 */

export interface InactivityMemberData {
    joinedAt?: unknown;
    lastNoteAt?: unknown;
    lastPostAt?: unknown;
    lastReadAt?: unknown;
    lastActiveAt?: unknown;
    kickThreshold?: number;
}

export interface InactivityGroupData {
    memberLastActive?: Record<string, unknown>;
    memberLastReadAt?: Record<string, unknown>;
    memberKickThresholds?: Record<string, number>;
}

export type InactivityStatus = 'active' | 'inactive' | 'needs_initialization';

export interface InactivityResult {
    status: InactivityStatus;
    lastActiveTime: number;
    thresholdMs: number;
    diffMs: number;
    reason: string;
    isNewMember: boolean;
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
    const tsObj = ts as { seconds?: number; _seconds?: number };
    if (tsObj.seconds !== undefined) return tsObj.seconds * 1000;
    if (tsObj._seconds !== undefined) return tsObj._seconds * 1000;
    return 0;
}

export function calculateMemberStatus(
    memberId: string,
    memberData: InactivityMemberData,
    groupData: InactivityGroupData,
    now: Date = new Date(),
    gracePeriodMs: number = 3 * 24 * 60 * 60 * 1000
): InactivityResult {
    const nowTime = now.getTime();

    // 1. Determine Timestamps
    const tJoined = toMillis(memberData.joinedAt);
    const tLastNote = toMillis(memberData.lastNoteAt);
    const tLastPost = toMillis(memberData.lastPostAt);
    const tGroupLastActive = toMillis(groupData.memberLastActive?.[memberId]);
    
    const tLastRead = toMillis(memberData.lastReadAt);
    const tLastActiveAt = toMillis(memberData.lastActiveAt);
    const tGroupLastRead = toMillis(groupData.memberLastReadAt?.[memberId]);

    // 2. Identify "Posting" Activity (includes joining)
    const lastPostAtTime = Math.max(tLastNote, tLastPost, tGroupLastActive, tJoined);
    
    // 3. Identify "Reading" Activity
    const lastReadAtTime = Math.max(tLastRead, tLastActiveAt, tGroupLastRead);

    // 4. Grace Period Logic
    const isNewMember = tJoined > 0 && (nowTime - tJoined < gracePeriodMs);
    
    const candidates: number[] = [];
    if (lastPostAtTime > 0) candidates.push(lastPostAtTime);
    
    let usedReading = false;
    if (lastReadAtTime > 0 && isNewMember) {
        candidates.push(lastReadAtTime);
        usedReading = true;
    }

    // 5. Threshold Calculation
    const thresholdDays = memberData.kickThreshold || groupData.memberKickThresholds?.[memberId] || 3;
    const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;

    if (candidates.length === 0) {
        return {
            status: 'needs_initialization',
            lastActiveTime: 0,
            thresholdMs,
            diffMs: 0,
            reason: 'No activity timestamps found. Requires joinedAt initialization.',
            isNewMember: false
        };
    }

    const lastActiveTime = Math.max(...candidates);
    const diffMs = nowTime - lastActiveTime;
    const status: InactivityStatus = diffMs > thresholdMs ? 'inactive' : 'active';

    // Construct Reason
    let description = '';
    if (status === 'active') {
        description = 'Recent activity within threshold.';
    } else {
        const days = (diffMs / (24 * 60 * 60 * 1000)).toFixed(1);
        description = `Inactive for ${days} days (Threshold: ${thresholdDays} days).`;
    }

    if (usedReading && lastActiveTime === lastReadAtTime && lastActiveTime > lastPostAtTime) {
        description = 'Active via Reading grace period.';
    }

    return {
        status,
        lastActiveTime,
        thresholdMs,
        diffMs,
        reason: description,
        isNewMember
    };
}
