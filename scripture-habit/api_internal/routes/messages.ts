import express, { Response } from 'express';
import { admin, db } from '../lib/firebase-admin.js';
import { verifyAppCheck, authenticate, requireEmailVerified, AuthenticatedRequest } from '../lib/middleware.js';
import { postNoteSchema, postMessageSchema, sendCheerSchema, deleteNoteSchema, deleteMessageSchema } from '../lib/schemas.js';
import { notifyGroupMembers, getUserFcmTokens, sendPushNotification, cleanupTokens } from '../lib/notifications.js';
import { t } from '../lib/i18n.js';
import { GroupDocument, MessageDocument } from '../../types/firestore.js';
import { waitUntil } from '@vercel/functions';

const router = express.Router();

// Remove redundant logic here as it's being moved or is unused

import { MessageService } from '../services/message-service.js';
import { NoteService } from '../services/note-service.js';

// TRUTH: We leverage Firestore's native caching and Edge CDN. 
// In-memory caching in multi-instance environments led to stale data risks.

/**
 * Get Firestore Bundle for group messages
 * This allows the client to load the last 50 messages in 1 Read instead of 50.
 */
router.get('/bundle/:groupId', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response, next) => {
    const groupId = req.params.groupId as string;
    const uid = req.user!.uid;

    try {
        // 1. Check permissions first
        const groupRef = db.collection('groups').doc(groupId);
        const gSnap = await groupRef.get();
        if (!gSnap.exists) return res.status(404).json({ error: 'Group not found' });
        
        const gData = gSnap.data()!;
        if (!(gData.members || []).includes(uid)) return res.status(403).json({ error: 'Forbidden' });

        // 3. Generate Bundle (Fresh from Truth)
        console.log(`[Bundle] Generating new bundle for ${groupId}`);
        const messagesRef = groupRef.collection('messages');
        const q = messagesRef.orderBy('createdAt', 'desc').limit(50);
        const querySnap = await q.get();

        const bundle = db.bundle(`group-messages-${groupId}`);
        bundle.add(`latest-messages-${groupId}`, querySnap);

        // TRUTH: If we have fewer than 20 messages in individual docs, 
        // include the latest Bucket to prevent a "History Gap" in the UI.
        if (querySnap.size < 20) {
            const bucketsSnap = await groupRef.collection('message_buckets')
                .orderBy('endTime', 'desc')
                .limit(1)
                .get();
            
            if (!bucketsSnap.empty) {
                console.log(`[Bundle] Including latest bucket for ${groupId} to fill history gap`);
                bundle.add(`previous-bucket-${groupId}`, bucketsSnap);
            }
        }

        const bundleBuffer = bundle.build();

        // 4. Send with Edge Cache instructions (Fast & Consistent)
        const cacheHeader = 'public, s-maxage=30, stale-while-revalidate=60';
        
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Cache-Control', cacheHeader);
        res.send(bundleBuffer);

    } catch (error) {
        next(error);
    }
});

// Post Note
router.post(['/post-note', '/post-note/'], authenticate, requireEmailVerified, verifyAppCheck, async (req: AuthenticatedRequest, res: Response, next) => {
    const validation = postNoteSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });
    }
    
    try {
        const uid = req.user!.uid;
        const result = await NoteService.postNote({
            uid,
            ...validation.data
        });

        res.status(200).json({ 
            success: true, 
            message: 'Note posted successfully.', 
            ...result 
        });
    } catch (error) {
        // Now using global error handler via next()
        next(error);
    }
});

// Post Message
router.post('/post-message', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response, next) => {
    const validation = postMessageSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: 'Invalid input' });

    const { groupId, text, replyTo, optimisticId } = validation.data;
    try {
        const uid = req.user!.uid;
        const result = await MessageService.postMessage({
            uid,
            groupId,
            text,
            replyTo: replyTo ? {
                id: replyTo.id,
                senderNickname: replyTo.senderNickname,
                text: replyTo.text,
                isNote: !!replyTo.isNote
            } : undefined,
            optimisticId
        });

        // Notifications: waitUntil() keeps the function alive after response
        // to ensure notifications are reliably sent without blocking the client.
        waitUntil(
            notifyGroupMembers(groupId, uid, {
                title: result.nickname || 'Member',
                body: text.length > 100 ? text.substring(0, 97) + '...' : text,
                data: { type: 'chat', groupId }
            }, result.members).catch(err => console.error('Chat notification error:', err))
        );

        res.json({ success: true, messageId: result.messageId });

    } catch (error) {
        next(error);
    }
});

// Toggle Reaction (Atomic & Scalable)
router.post('/toggle-reaction', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response, next) => {
    const { groupId, messageId, emoji = '👍' } = req.body;
    const uid = req.user!.uid;

    if (!groupId || !messageId) return res.status(400).json({ error: 'Missing params' });

    try {
        const result = await MessageService.toggleReaction({
            uid,
            groupId,
            messageId,
            emoji
        });

        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

router.post('/delete-note', authenticate, requireEmailVerified, verifyAppCheck, async (req: AuthenticatedRequest, res: Response, next) => {

    const validation = deleteNoteSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });

    try {
        const uid = req.user!.uid;
        const { noteId } = validation.data;
        const userRef = db.collection('users').doc(uid);
        const noteRef = userRef.collection('notes').doc(noteId);

        await db.runTransaction(async (transaction) => {
            const noteSnap = await transaction.get(noteRef);
            if (!noteSnap.exists) throw new Error('Note not found');

            const noteData = noteSnap.data() || {};
            const sharedMessageIds: Record<string, string> = typeof noteData.sharedMessageIds === 'object' && noteData.sharedMessageIds !== null
                ? noteData.sharedMessageIds
                : {};

            transaction.delete(noteRef);
            transaction.update(userRef, {
                totalNotes: admin.firestore.FieldValue.increment(-1)
            });

            for (const [groupId, messageId] of Object.entries(sharedMessageIds)) {
                const groupRef = db.collection('groups').doc(groupId);
                const msgRef = groupRef.collection('messages').doc(String(messageId));
                
                const groupSnap = await transaction.get(groupRef);
                const msgSnap = await transaction.get(msgRef);
                if (!groupSnap.exists || !msgSnap.exists) continue;

                const gData = groupSnap.data() as GroupDocument;
                const updatePayload: admin.firestore.UpdateData<GroupDocument> = {};

                // TRUTH: High-Water Mark Logic (Sequence Integrity)
                if (gData.noteCount && gData.noteCount > 0) {
                    updatePayload.noteCount = admin.firestore.FieldValue.increment(-1);
                }

                // TRUTH: Revert metadata if this was the last note
                if (gData.lastNoteByUid === uid) {
                    // TRUTH: Scan deeper (20) to find the next valid note if previous deletes were frequent.
                    const recentNotesSnap = await transaction.get(
                        db.collection('groups').doc(groupId).collection('messages')
                            .where('isNote', '==', true)
                            .orderBy('createdAt', 'desc')
                            .limit(50)
                    );
                    const candidates = recentNotesSnap.docs
                        .map(d => ({ id: d.id, ...d.data() as MessageDocument }))
                        .filter(n => n.id !== messageId);
                    
                    const next = candidates[0];
                    if (next) {
                        updatePayload.lastNoteAt = next.createdAt;
                        updatePayload.lastNoteByNickname = next.senderNickname || 'Member';
                        updatePayload.lastNoteByUid = next.senderId;
                    } else {
                        updatePayload.lastNoteAt = admin.firestore.FieldValue.delete();
                        updatePayload.lastNoteByNickname = admin.firestore.FieldValue.delete();
                        updatePayload.lastNoteByUid = admin.firestore.FieldValue.delete();
                    }
                }

                // TRUTH: If this was the user's only note today, remove them from activeMembers to keep Unity honest
                const now = new Date();
                const groupTimeZone = gData.timeZone || 'UTC';
                let groupToday;
                try {
                    groupToday = now.toLocaleDateString('sv-SE', { timeZone: groupTimeZone });
                } catch {
                    groupToday = now.toLocaleDateString('sv-SE', { timeZone: 'UTC' });
                }

                if (gData.dailyActivity?.date === groupToday && gData.dailyActivity?.activeMembers?.includes(uid)) {
                    const todayNotesSnap = await transaction.get(
                        groupRef.collection('messages')
                            .where('senderId', '==', uid)
                            .where('isNote', '==', true)
                            .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(new Date(now.setHours(0,0,0,0))))
                            .limit(2)
                    );
                    const otherNotesToday = todayNotesSnap.docs.filter(d => d.id !== messageId);
                    if (otherNotesToday.length === 0) {
                        updatePayload['dailyActivity.activeMembers'] = admin.firestore.FieldValue.arrayRemove(uid);
                    }
                }

                transaction.delete(msgRef);

                if (Object.keys(updatePayload).length > 0) {
                    transaction.update(groupRef, updatePayload);
                }
            }
        });

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// Edit Message
router.post('/edit-message', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response, next) => {
    const { groupId, messageId, text } = req.body;
    const uid = req.user!.uid;

    if (!groupId || !messageId || !text) return res.status(400).json({ error: 'Missing params' });

    try {
        await MessageService.editMessage({
            uid,
            groupId,
            messageId,
            text
        });

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

router.post('/delete-message', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response, next) => {
    const validation = deleteMessageSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });

    try {
        const { groupId, messageId } = validation.data;
        const uid = req.user!.uid;

        await MessageService.deleteMessage({
            uid,
            groupId,
            messageId
        });

        res.json({ success: true });
    } catch (error: unknown) {
        if (error instanceof Error) {
            if (error.message === 'Forbidden' || error.message.includes('own messages')) return res.status(403).json({ error: error.message });
            if (error.message === 'Group not found' || error.message === 'Message not found') return res.status(404).json({ error: error.message });
        }
        next(error);
    }
});

// Send Cheer
router.post('/send-cheer', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response, next) => {
    const validation = sendCheerSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: 'Invalid input' });

    try {
        const { targetUid, groupId, language } = validation.data;
        const senderUid = req.user!.uid;

        if (senderUid === targetUid) return res.status(400).json({ error: 'Self cheer' });

        const result = await MessageService.sendCheer({
            senderUid,
            targetUid,
            groupId
        });

        if (result.alreadySent) return res.status(429).json({ error: 'alreadySent' });

        // Notification: waitUntil() ensures this runs after the response
        // without blocking the client and without being killed by Vercel.
        waitUntil(
            (async () => {
                try {
                    const tokens = await getUserFcmTokens(targetUid);
                    if (tokens.length > 0) {
                        const targetLang = (result.targetData?.language as string) || 'en';
                        const lang = (language as string) || targetLang || 'en';

                        const resultNotification = await sendPushNotification(tokens, {
                            title: result.senderNickname || 'Member',
                            body: t(lang, 'notifications.cheer_body'),
                            data: { type: 'cheer', groupId }
                        });

                        if (resultNotification.failedTokens.length > 0) {
                            cleanupTokens(targetUid, resultNotification.failedTokens).catch(err => {
                                console.error('[NotificationSync] Failed to cleanup cheer tokens:', err);
                            });
                        }
                    }
                } catch (err) { console.error('Cheer notification error:', err); }
            })()
        );

        res.json({ success: true });
    } catch (error: unknown) {
        next(error);
    }

});

export default router;

