import express, { Response } from 'express';
import { admin, db } from '../lib/firebase-admin.js';
import { verifyAppCheck, authenticate, AuthenticatedRequest } from '../lib/middleware.js';
import { verifyLoginSchema } from '../lib/schemas.js';
import { AuthenticationError, ForbiddenError } from '../lib/errors.js';
import { ProfileService } from '../services/profile-service.js';
import { UserDocument, MemberPreview, GroupDocument } from '../../types/firestore.js';

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

            // --- STEP 1: Exit Groups Properly ---
            for (const gid of groupIds) {
                try {
                    const groupRef = db.collection('groups').doc(gid);
                    await db.runTransaction(async (transaction) => {
                        const gSnap = await transaction.get(groupRef);
                        if (!gSnap.exists) return;

                        const gData = gSnap.data()! as GroupDocument;
                        const members: string[] = gData.members || [];
                        const updatedMembers = members.filter(mU => mU !== uid);
                        
                        // Update Previews
                        const previews = gData.memberPreviews || [];
                        const updatedPreviews = previews.filter((p: MemberPreview) => p.uid !== uid);

                        const updatePayload: Record<string, admin.firestore.FieldValue | string | number | boolean | string[] | object | undefined> = {
                            members: updatedMembers,
                            membersCount: admin.firestore.FieldValue.increment(-1),
                            memberPreviews: updatedPreviews,
                            [`memberLastActive.${uid}`]: admin.firestore.FieldValue.delete(),
                            [`memberLastReadAt.${uid}`]: admin.firestore.FieldValue.delete()
                        };

                        if (gData.ownerUserId === uid) {
                            if (updatedMembers.length > 0) {
                                updatePayload.ownerUserId = updatedMembers[0];
                                transaction.update(groupRef, updatePayload);
                            } else {
                                transaction.delete(groupRef);
                            }
                        } else {
                            transaction.update(groupRef, updatePayload);
                        }

                        // TRUTH: If the user was an active contributor today, remove them to keep Unity honest
                        if (gData.dailyActivity?.activeMembers?.includes(uid)) {
                            transaction.update(groupRef, {
                                'dailyActivity.activeMembers': admin.firestore.FieldValue.arrayRemove(uid)
                            });
                        }

                        // IMPORTANT: Cleanup member subcollection
                        transaction.delete(groupRef.collection('members').doc(uid));

                        if (updatedMembers.length > 0) {
                            const msgRef = groupRef.collection('messages').doc();
                            transaction.set(msgRef, {
                                text: `👋 **${userData.nickname || 'Someone'}** deleted their account and left the group.`,
                                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                                senderId: 'system',
                                isSystemMessage: true,
                                type: 'leave'
                            });
                        }
                    });
                } catch (groupErr) {
                    console.error(`Group cleanup failed for ${gid}:`, groupErr);
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
