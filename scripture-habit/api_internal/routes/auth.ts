import express, { Response } from 'express';
import { admin, db } from '../lib/firebase-admin.js';
import { verifyAppCheck, authenticate, AuthenticatedRequest } from '../lib/middleware.js';
import { verifyLoginSchema } from '../lib/schemas.js';
import { AuthenticationError, ForbiddenError } from '../lib/errors.js';
import { ProfileService } from '../services/profile-service.js';
import { UserDocument } from '../../types/firestore.js';
import { removeMemberFromGroup } from '../lib/membership-utils.js';

const router = express.Router();

/**
 * Update User Profile and Sync to Chats
 */
router.post('/update-profile', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response, next) => {
    const { nickname, photoURL, stake, ward, bio } = req.body;
    const uid = req.user!.uid;

    try {
        const userRef = db.collection('users').doc(uid);
        
        const updates: Partial<UserDocument> = {};
        if (nickname !== undefined) updates.nickname = nickname;
        if (photoURL !== undefined) updates.photoURL = photoURL;
        if (stake !== undefined) updates.stake = stake;
        if (ward !== undefined) updates.ward = ward;
        if (bio !== undefined) updates.bio = bio;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        await userRef.update(updates);

        // SYNC: Propagate identity changes to recent messages (no await required for response)
        if (nickname || photoURL) {
            ProfileService.syncProfileToChats(uid, { nickname, photoURL }).catch(err => {
                console.error('[ProfileSync] Error in background sync:', err);
            });
        }

        res.status(200).json({ success: true, message: 'Profile updated and synced.' });
    } catch (err) {
        next(err);
    }
});


/**
 * Verify Login
 */
router.post('/verify-login', verifyAppCheck, async (req, res: Response, next) => {
    const validation = verifyLoginSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });
    }

    const { token } = validation.data;

    try {
        // use token from body for verification
        const decodedToken = await admin.auth().verifyIdToken(token);
        const uid = decodedToken.uid;
        
        // Check if email is verified - use latest snapshot from Auth server for login check
        const userRecord = await admin.auth().getUser(uid);
        if (!userRecord.emailVerified) {
            console.warn(`[Auth] Login rejected: Email not verified for ${decodedToken.email}`);
            throw new ForbiddenError('Email not verified.', 'auth/email-not-verified');
        }

        console.log('[Auth] Verified user login:', { uid, email: decodedToken.email });
        res.status(200).json({ 
            message: 'Login verified.', 
            uid, 
            email: decodedToken.email 
        });
    } catch (err: unknown) {
        if (err instanceof ForbiddenError) return next(err);
        next(new AuthenticationError('Authentication failed.'));
    }
});

/**
 * Delete account
 */
router.post('/delete-account', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const uid = req.user.uid;
    
    try {
        console.log(`Starting account deletion for UID: ${uid}`);

        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();

        if (userDoc.exists) {
            const userData = userDoc.data()!;
            const groupIds: string[] = userData.groupIds || (userData.groupId ? [userData.groupId] : []);
            const groupStates = await db.collection(`users/${uid}/groupStates`).get();
            const uniqueGroupIds = Array.from(new Set([...groupIds, ...groupStates.docs.map(doc => doc.id)]));

            // --- STEP 1: Exit Groups Properly ---
            for (const gid of uniqueGroupIds) {
                try {
                    await db.runTransaction(async (transaction) => {
                        await removeMemberFromGroup(transaction, gid, uid, {
                            transferOwnership: true,
                            systemMessage: { type: 'leave', nickname: userData.nickname || 'Someone' },
                            preferredLanguage: userData.language || 'en',
                            removeGroupState: true
                        });
                    });
                } catch (groupErr) {
                    console.error(`[AccountDelete] Group cleanup failed for ${gid}:`, groupErr);
                }
            }

            // --- STEP 2: Social Identity Purge (Anonymize Recent Reactions) ---
            ProfileService.purgeSocialIdentity(uid).catch(err => {
                console.error('[AccountDelete] Social identity purge failed:', err);
            });

            // --- STEP 3: Recursive Delete All User Data ---
            // This handles notes, groupStates, letters, private collections etc. efficiently.
            await db.recursiveDelete(userRef);
        }

        // --- STEP 3: Delete from Firebase Auth ---
        await admin.auth().deleteUser(uid);

        console.log(`Successfully deleted account and data for UID: ${uid}`);
        res.status(200).json({ message: 'Account and all data deleted successfully.' });

    } catch (err: unknown) {
        const error = err as Error;
        console.error(`Critical error in /api/delete-account for UID ${uid}:`, error.message);
        res.status(500).json({ error: 'Failed to delete account.' });
    }
});

export default router;
