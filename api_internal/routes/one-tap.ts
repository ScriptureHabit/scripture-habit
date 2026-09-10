import express, { Response } from 'express';
import { z } from 'zod';
import { authenticate, requireEmailVerified, verifyAppCheck, AuthenticatedRequest } from '../lib/middleware.js';
import { OneTapService, VALID_THEMES } from '../services/one-tap-service.js';
import { ValidationError, sendErrorResponse } from '../lib/errors.js';

const router = express.Router();

const oneTapSchema = z.object({
    themeId: z.enum(VALID_THEMES)
});

/**
 * Complete today's scripture study in one tap
 * POST /api/study/one-tap
 */
router.post(
    '/one-tap',
    authenticate,
    requireEmailVerified,
    verifyAppCheck,
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const uid = req.user?.uid;
            if (!uid) throw new ValidationError('Unauthorized');

            const validation = oneTapSchema.safeParse(req.body);
            if (!validation.success) {
                throw new ValidationError(`Invalid theme. Allowed values: ${VALID_THEMES.join(', ')}`);
            }

            const { themeId } = validation.data;
            const clientTimeZone = (req.headers['x-timezone'] as string) || null;

            const result = await OneTapService.completeStudy({
                uid,
                themeId,
                clientTimeZone
            });

            return res.json(result);
        } catch (error) {
            return sendErrorResponse(res, error);
        }
    }
);

export default router;
