import express, { Response } from 'express';
import { db } from '../lib/firebase-admin.js';
import { authenticate, AuthenticatedRequest } from '../lib/middleware.js';
import { AuthenticationError, ValidationError, NotFoundError, ForbiddenError, sendErrorResponse } from '../lib/errors.js';
import { formatDateInTimeZone, normalizeDateString } from '../../src/utils/time-utils.js';
import { runPhasedTransaction } from '../lib/phased-transaction.js';

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
        
        const result = await runPhasedTransaction(db, {
            read: async (transaction) => {
                const groupSnap = await transaction.get(groupRef);
                
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
                
                const needsReset = normalizedActivityDate !== normalizedToday;
                return {
                    needsReset,
                    todayStr,
                    activityDate
                };
            },
            write: (transaction, readResult) => {
                // If already today, no reset needed
                if (!readResult.needsReset) {
                    return { 
                        reset: false, 
                        reason: 'Already reset for today',
                        today: readResult.todayStr,
                        currentActivityDate: readResult.activityDate
                    };
                }
                
                // Reset dailyActivity and unityPercentage (safely handles missing or null dailyActivity field)
                transaction.set(groupRef, {
                    dailyActivity: {
                        date: readResult.todayStr,
                        activeMembers: []
                    },
                    unityPercentage: 0
                }, { merge: true });

                return {
                    reset: true,
                    today: readResult.todayStr,
                    previousActivityDate: readResult.activityDate,
                    unityPercentage: 0
                };
            }
        });
        
        if (result.reset) {
            console.log(`[ResetUnity] Group ${groupId}: Reset unity to 0% for ${result.today} (was ${result.previousActivityDate})`);
        }
        
        res.json(result);
        
    } catch (error) {
        console.error('[ResetUnity] Error:', error);
        sendErrorResponse(res, error, 'Reset unity failed');
    }
});

export default router;
