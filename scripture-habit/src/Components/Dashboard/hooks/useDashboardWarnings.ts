import { useState, useEffect } from 'react';
import { UserData } from '../../../types/user';
import { Group } from '../../../types/chat';

interface WarningInfo {
  name: string;
  days: number;
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
                const lastActiveDate = (lastActiveTimestamp as any).toDate ? (lastActiveTimestamp as any).toDate() : new Date((lastActiveTimestamp as any).seconds * 1000);
                const diffMs = now.getTime() - lastActiveDate.getTime();
                const diffDays = diffMs / (1000 * 60 * 60 * 24);

                const threshold = (group.memberKickThresholds && group.memberKickThresholds[userData.uid]) || userData.kickThreshold || 3;
                if (diffDays >= threshold - 1) {
                    newWarnings.push({ name: group.name || 'Group', days: Math.floor(diffDays) });
                }
            }
        });

        setWarnings(newWarnings);
    }, [userGroups, userData]);

    return { warnings };
};
