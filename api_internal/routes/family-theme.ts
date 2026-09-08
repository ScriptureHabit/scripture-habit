import express, { Response } from 'express';
import { z } from 'zod';
import { authenticate, requireEmailVerified, verifyAppCheck, AuthenticatedRequest } from '../lib/middleware.js';
import { FamilyThemeService } from '../services/family-theme-service.js';
import { ValidationError, sendErrorResponse } from '../lib/errors.js';
import { db, admin } from '../lib/firebase-admin.js';

const router = express.Router();

const selectThemeSchema = z.object({
    themeId: z.string().min(1)
});

const toggleFamilySyncSchema = z.object({
    enabled: z.boolean()
});

/**
 * Select / sync today's family study theme
 * POST /api/groups/:groupId/family-theme/select
 */
router.post(
    '/:groupId/family-theme/select',
    authenticate,
    requireEmailVerified,
    verifyAppCheck,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const groupId = req.params.groupId as string;
            const uid = req.user?.uid;
            if (!uid) throw new ValidationError('Unauthorized');

            const validation = selectThemeSchema.safeParse(req.body);
            if (!validation.success) {
                throw new ValidationError('Invalid themeId');
            }

            const { themeId } = validation.data;
            const clientTimeZone = (req.headers['x-timezone'] as string) || null;

            const result = await FamilyThemeService.selectTheme({
                groupId,
                uid,
                themeId,
                clientTimeZone
            });

            return res.json({
                success: true,
                ...result
            });
        } catch (error) {
            return sendErrorResponse(res, error);
        }
    }
);

/**
 * Toggle family sync mode on/off for a group
 * POST /api/groups/:groupId/family-theme/toggle
 */
router.post(
    '/:groupId/family-theme/toggle',
    authenticate,
    requireEmailVerified,
    verifyAppCheck,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const groupId = req.params.groupId as string;
            const uid = req.user?.uid;
            if (!uid) throw new ValidationError('Unauthorized');

            const validation = toggleFamilySyncSchema.safeParse(req.body);
            if (!validation.success) {
                throw new ValidationError('Invalid enabled boolean');
            }

            const { enabled } = validation.data;

            const isEnabled = await FamilyThemeService.toggleFamilySync(groupId, uid, enabled);

            return res.json({
                success: true,
                isFamilySyncEnabled: isEnabled
            });
        } catch (error) {
            return sendErrorResponse(res, error);
        }
    }
);

/**
 * [DEV ONLY] Simulate partner selection or reset session
 * POST /api/groups/:groupId/family-theme/dev-simulate
 */
router.post(
    '/:groupId/family-theme/dev-simulate',
    authenticate,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            if (process.env.NODE_ENV === 'production') {
                return res.status(403).json({ error: 'Not available in production' });
            }

            const groupId = req.params.groupId as string;
            const currentUid = req.user?.uid;
            if (!currentUid) throw new ValidationError('Unauthorized');

            const { partnerTheme, reset } = req.body;
            const groupRef = db.collection('groups').doc(groupId);
            const groupSnap = await groupRef.get();
            if (!groupSnap.exists) throw new ValidationError('Group not found');

            const groupData = groupSnap.data();
            const members = (groupData?.members as string[]) || [];
            const partnerUid = members.find(m => m !== currentUid) || 'seeder-partner';
            const todayStr = new Date().toLocaleDateString('sv-SE');

            if (reset) {
                await groupRef.update({
                    familyThemeSession: {
                        date: todayStr,
                        selections: {}
                    }
                });
                return res.json({ success: true, reset: true });
            }

            const currentSession = groupData?.familyThemeSession || {};
            const currentSelections = (currentSession.date === todayStr ? currentSession.selections : {}) || {};

            const updatePayload: Record<string, unknown> = {
                'familyThemeSession.date': todayStr,
                'familyThemeSession.selections': {
                    ...currentSelections,
                    [partnerUid]: partnerTheme
                }
            };

            if (currentSession.matchedTheme) {
                updatePayload['familyThemeSession.matchedTheme'] = admin.firestore.FieldValue.delete();
                updatePayload['familyThemeSession.completedAt'] = admin.firestore.FieldValue.delete();
            }

            await groupRef.update(updatePayload);

            return res.json({ success: true, partnerTheme, partnerUid });
        } catch (error) {
            return sendErrorResponse(res, error);
        }
    }
);

export default router;
