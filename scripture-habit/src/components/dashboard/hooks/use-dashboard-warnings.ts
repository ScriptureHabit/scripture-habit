import { useState, useEffect } from 'react';
import { UserData } from '../../../types/user';
import { FirebaseTimestamp, Group } from '../../../types/chat';
import { parseTimestampToDate } from '../../../utils/time-utils';

interface WarningInfo {
  name: string;
  hoursRemaining: number;
}

export const useDashboardWarnings = (userData: UserData | null, userGroups: Group[]) => {
    const [warnings, setWarnings] = useState<WarningInfo[]>([]);

    useEffect(() => {
        if (!userData || userGroups.length === 0) return;

        const newWarnings: WarningInfo[] = [];
        const now = new Date();

        userGroups.forEach(group => {
            const myStatus = group.myMemberStatus;
            
            // TRUTH: Only consider WRITING activity (notes/posts) as valid participation.
            // ROM (Read-only) users who do not contribute are considered inactive here.
            const candidateTimestamps: (FirebaseTimestamp | null | undefined)[] = [
                userData.lastPostAt,
                myStatus?.lastNoteAt,
                // Only count the group's last note if the user themselves was the poster
                (group.lastMessageByUid === userData.uid ? (group.lastNoteAt || group.lastMessageAt) : null)
            ];

            if (candidateTimestamps.length > 0) {
                // Convert all candidates to Date objects and find the newest valid one
                // parseTimestampToDate handles various Firestore timestamp formats safely
                const dates = candidateTimestamps
                    .map(t => parseTimestampToDate(t))
                    .filter(d => !isNaN(d.getTime()));

                if (dates.length === 0) return;

                const lastActiveDate = new Date(Math.max(...dates.map(d => d.getTime())));
                const diffMs = now.getTime() - lastActiveDate.getTime();
                
                // Use the threshold from myStatus if available
                const threshold = myStatus?.kickThreshold || (group.memberKickThresholds && group.memberKickThresholds[userData.uid]) || userData.kickThreshold || 3;
                const thresholdMs = threshold * 24 * 60 * 60 * 1000;
                
                const remainingMs = thresholdMs - diffMs;
                const hoursRemaining = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60)));

                // Avoid false positives: Warning shows only if less than 24 hours remain 
                // and it's strictly smaller than the full threshold period.
                if (hoursRemaining <= 24 && hoursRemaining < threshold * 24 - 1) {
                    newWarnings.push({ name: group.name || 'Group', hoursRemaining });
                }
            }
        });

        setWarnings(newWarnings);
    }, [userGroups, userData]);

    return { warnings };
};
