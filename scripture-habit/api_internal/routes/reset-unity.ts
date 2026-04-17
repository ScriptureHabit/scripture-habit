import express, { Response } from 'express';
import { db } from '../lib/firebase-admin.js';
import { authenticate, AuthenticatedRequest } from '../lib/middleware.js';

import { formatDateInTimeZone, normalizeDateString } from '../../src/utils/time-utils.js';

const router = express.Router();

/**
 * Reset Unity Percentage for a specific group if midnight has passed
 * This endpoint is called by frontend when it detects date change
 */
router.post('/reset-unity-if-midnight', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    const uid = req.user?.uid;
    const { groupId } = req.body;
    
    if (!uid) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!groupId) {
        return res.status(400).json({ error: 'groupId is required' });
    }

    try {
        const groupRef = db.collection('groups').doc(groupId);
        const groupSnap = await groupRef.get();
        
        if (!groupSnap.exists) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        const groupData = groupSnap.data()!;
        
        // Check if user is a member of the group
        if (!groupData.members?.includes(uid)) {
            return res.status(403).json({ error: 'Not a group member' });
        }
        
        const groupTimeZone = groupData.timeZone || 'UTC';
        const now = new Date();
        
        // Calculate "today" in the group's timezone robustly
        const todayStr = formatDateInTimeZone(now, groupTimeZone);
        const normalizedToday = normalizeDateString(todayStr);
        
        // Check if dailyActivity is from a different day (or empty/needs initialization)
        const activityDate = groupData.dailyActivity?.date;
        const normalizedActivityDate = activityDate ? normalizeDateString(activityDate) : null;
        
        // If already today, no reset needed
        if (normalizedActivityDate === normalizedToday) {
            return res.json({ 
                reset: false, 
                reason: 'Already reset for today',
                today: todayStr,
                currentActivityDate: activityDate
            });
        }
        
        // Reset dailyActivity and unityPercentage (also handles empty date for new groups)
        await groupRef.update({
            'dailyActivity.date': todayStr,
            'dailyActivity.activeMembers': [],
            'unityPercentage': 0
        });
        
        console.log(`[ResetUnity] Group ${groupId}: Reset unity to 0% for ${todayStr} (was ${activityDate})`);
        
        res.json({
            reset: true,
            today: todayStr,
            previousActivityDate: activityDate,
            unityPercentage: 0
        });
        
    } catch (error) {
        console.error('[ResetUnity] Error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router;
