import express from 'express';
import { admin, db } from '../lib/firebase-admin.js';
import { verifyAppCheck } from '../lib/middleware.js';
import { verifyLoginSchema } from '../lib/schemas.js';

const router = express.Router();

// Verify Login
router.post('/verify-login', verifyAppCheck, async (req, res) => {
    const validation = verifyLoginSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });
    }

    const { token } = validation.data;

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        const uid = decodedToken.uid;
        const email = decodedToken.email;

        // Check if email is verified
        const userRecord = await admin.auth().getUser(uid);
        if (!userRecord.emailVerified) {
            console.warn(`Login failed for ${email}: email not verified.`);
            return res.status(403).json({ 
                error: 'Email not verified.', 
                code: 'auth/email-not-verified' 
            });
        }

        console.log('Verified user:', { uid, email });
        res.status(200).json({ 
            message: 'Login verified.', 
            uid, 
            email 
        });
    } catch (error) {
        console.error('Error verifying login:', error.message);
        res.status(401).json({ error: 'Authentication failed.' });
    }
});

// Delete account
router.post('/delete-account', verifyAppCheck, async (req, res) => {
    const authHeader = req.headers.authorization;
    let idToken;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        idToken = authHeader.split('Bearer ')[1];
    } else {
        return res.status(401).send('Unauthorized');
    }

    let uid;
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        uid = decodedToken.uid;

        console.log(`Starting account deletion for UID: ${uid}`);

        // --- STEP 1: Get User Data for Cleanup ---
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();

        if (userDoc.exists) {
            const userData = userDoc.data();
            const groupIds = userData.groupIds || (userData.groupId ? [userData.groupId] : []);

            // --- STEP 2: Exit Groups ---
            for (const gid of groupIds) {
                try {
                    const groupRef = db.collection('groups').doc(gid);
                    await db.runTransaction(async (transaction) => {
                        const gSnap = await transaction.get(groupRef);
                        if (!gSnap.exists) return;

                        const gData = gSnap.data();
                        const members = gData.members || [];
                        const updatedMembers = members.filter(mUid => mUid !== uid);

                        if (gData.ownerUserId === uid) {
                            if (updatedMembers.length > 0) {
                                // Transfer ownership
                                transaction.update(groupRef, {
                                    ownerUserId: updatedMembers[0],
                                    members: updatedMembers,
                                    membersCount: admin.firestore.FieldValue.increment(-1),
                                    [`memberKickThresholds.${uid}`]: admin.firestore.FieldValue.delete()
                                });
                            } else {
                                // Delete group if no one left
                                transaction.delete(groupRef);
                            }
                        } else {
                            // Just leave
                            transaction.update(groupRef, {
                                members: updatedMembers,
                                membersCount: admin.firestore.FieldValue.increment(-1),
                                [`memberKickThresholds.${uid}`]: admin.firestore.FieldValue.delete()
                            });
                        }
                    });
                } catch (groupError) {
                    console.error(`Group cleanup failed for ${gid}:`, groupError.message);
                }
            }

            // --- STEP 3: Delete Subcollections (Notes, etc.) ---
            const subcollections = ['notes', 'groupStates', 'letters'];
            for (const sub of subcollections) {
                let snapshot = await userRef.collection(sub).get();
                while (!snapshot.empty) {
                    const batch = db.batch();
                    const docsToDelete = snapshot.docs.slice(0, 500);
                    docsToDelete.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();

                    if (snapshot.docs.length <= 500) break;
                    snapshot = await userRef.collection(sub).get();
                }
            }

            // --- STEP 3.5: Delete Private Collection (FCM Tokens) ---
            try {
                await userRef.collection('private').doc('tokens').delete();
            } catch (err) { }

            // --- STEP 4: Delete User Profile ---
            await userRef.delete();
        }

        // --- STEP 5: Delete from Firebase Auth ---
        await admin.auth().deleteUser(uid);

        console.log(`Successfully deleted account and data for UID: ${uid}`);
        res.status(200).json({ message: 'Account and all data deleted successfully.' });

    } catch (error) {
        console.error(`Critical error in /api/delete-account for UID ${uid}:`, error.message);
        res.status(500).json({ error: 'Failed to delete account.' });
    }
});

export default router;
