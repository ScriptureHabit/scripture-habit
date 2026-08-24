import express, { Response } from 'express';
import { db } from '../lib/firebase-admin.js';
import { authenticate, AuthenticatedRequest } from '../lib/middleware.js';
import { AuthenticationError, ValidationError, NotFoundError, ForbiddenError, sendErrorResponse } from '../lib/errors.js';
import { formatDateInTimeZone, normalizeDateString } from '../../src/utils/time-utils.js';

const router = express.Router();

/**
 * Reset Unity Percentage for a specific group if midnight has passed
 * This endpoint is called by frontend when it detects date change
 */
router.post('/reset-unity-if-midnight', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const uid = req.user?.uid;
        const { groupId } = req.body;
        
        if (!uid) {
            throw new AuthenticationError('Unauthorized');
        }
        
        if (!groupId) {
            throw new ValidationError('groupId is required');
        }

        const groupRef = db.collection('groups').doc(groupId);
        const groupSnap = await groupRef.get();
        
        if (!groupSnap.exists) {
            throw new NotFoundError('Group not found');
        }
        
        const groupData = groupSnap.data()!;
        
        // Check if user is a member of the group
        if (!groupData.members?.includes(uid)) {
            throw new ForbiddenError('Not a group member');
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
        
        // Reset dailyActivity and unityPercentage (safely handles missing or null dailyActivity field)
        await groupRef.set({
            dailyActivity: {
                date: todayStr,
                activeMembers: []
            },
            unityPercentage: 0
        }, { merge: true });
        
        console.log(`[ResetUnity] Group ${groupId}: Reset unity to 0% for ${todayStr} (was ${activityDate})`);
        
        res.json({
            reset: true,
            today: todayStr,
            previousActivityDate: activityDate,
            unityPercentage: 0
        });
        
    } catch (error) {
        console.error('[ResetUnity] Error:', error);
        sendErrorResponse(res, error, 'Reset unity failed');
    }
});

export default router;
