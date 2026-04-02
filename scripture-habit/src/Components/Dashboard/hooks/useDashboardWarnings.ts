import { useState, useEffect } from 'react';
import { UserData } from '../../../types/user';
import { Group } from '../../../types/chat';
import { parseTimestampToDate } from '../../../Utils/timeUtils';

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
            const memberLastActive = group.memberLastActive || {};
            const lastActiveTimestamp = memberLastActive[userData.uid];

            if (lastActiveTimestamp) {
                const lastActiveDate = parseTimestampToDate(lastActiveTimestamp);
                const diffMs = now.getTime() - lastActiveDate.getTime();
                
                const threshold = (group.memberKickThresholds && group.memberKickThresholds[userData.uid]) || userData.kickThreshold || 3;
                const thresholdMs = threshold * 24 * 60 * 60 * 1000;
                
                const remainingMs = thresholdMs - diffMs;
                const hoursRemaining = Math.ceil(remainingMs / (1000 * 60 * 60));

                // Warn if less than 24 hours remain (or if already overdue but still in group)
                if (hoursRemaining <= 24) {
                    newWarnings.push({ name: group.name || 'Group', hoursRemaining: Math.max(0, hoursRemaining) });
                }
            }
        });

        setWarnings(newWarnings);
    }, [userGroups, userData]);

    return { warnings };
};
