import { useMemo } from 'react';
import { UserData } from '../../../types/user';
import { FirebaseTimestamp, Group } from '../../../types/chat';
import { parseTimestampToDate } from '../../../utils/time-utils';
import { DEFAULT_KICK_THRESHOLD } from '../../../constants';

interface WarningInfo {
  name: string;
  hoursRemaining: number;
}

export const useDashboardWarnings = (
    userData: UserData | null, 
    userGroups: Group[],
    isDataFetching: boolean = false
) => {
    const warnings = useMemo<WarningInfo[]>(() => {
        // Suppress warnings while data is being fetched (e.g. on initial load or live sync)
        // to prevent momentary false positive warnings from stale cached data.
        if (isDataFetching || !userData || userGroups.length === 0) return [];

        const newWarnings: WarningInfo[] = [];
        const now = new Date();

        userGroups.forEach(group => {
            // TRUTH: Only consider WRITING activity (notes/posts) as valid participation.
            // ROM (Read-only) users who do not contribute are considered inactive here.
            const candidateTimestamps: (FirebaseTimestamp | null | undefined)[] = [
                userData.lastPostAt,
                (group.lastNoteByUid === userData.uid ? group.lastNoteAt : null),
                group.memberJoinedAt?.[userData.uid] || group.myMemberStatus?.joinedAt
            ];

            const dates = candidateTimestamps
                .filter((t): t is NonNullable<typeof t> => !!t)
                .map(t => parseTimestampToDate(t))
                .filter(d => !isNaN(d.getTime()));

            if (dates.length === 0) return;

            const lastActiveDate = new Date(Math.max(...dates.map(d => d.getTime())));
            const diffMs = now.getTime() - lastActiveDate.getTime();
            
            // Use the threshold from memberKickThresholds if available
            const threshold = (group.memberKickThresholds && group.memberKickThresholds[userData.uid]) || 
                             group.myMemberStatus?.kickThreshold ||
                             userData.kickThreshold || 
                             DEFAULT_KICK_THRESHOLD;
            const thresholdMs = threshold * 24 * 60 * 60 * 1000;
            
            const remainingMs = thresholdMs - diffMs;
            const hoursRemaining = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60)));

            // Avoid false positives: Warning shows only if less than 24 hours remain 
            // and it's strictly smaller than the full threshold period.
            if (hoursRemaining <= 24 && hoursRemaining < threshold * 24 - 1) {
                newWarnings.push({ name: group.name || 'Group', hoursRemaining });
            }
        });

        return newWarnings;
    }, [userGroups, userData, isDataFetching]);

    return { warnings };
};
