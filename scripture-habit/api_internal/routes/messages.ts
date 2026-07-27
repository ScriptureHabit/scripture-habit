import express, { Response } from 'express';
import { admin, db } from '../lib/firebase-admin.js';
import { verifyAppCheck, authenticate, requireEmailVerified, AuthenticatedRequest } from '../lib/middleware.js';
import { postNoteSchema, postMessageSchema, sendCheerSchema, deleteNoteSchema, deleteMessageSchema } from '../lib/schemas.js';
import { notifyGroupMembers, sendPushNotification, cleanupTokens, getUserFcmTokensAndLanguage } from '../lib/notifications.js';
import { t } from '../lib/i18n.js';
import { waitUntil } from '@vercel/functions';
import { AppError, ValidationError, NotFoundError, ForbiddenError, sendErrorResponse } from '../lib/errors.js';

const router = express.Router();

// Remove redundant logic here as it's being moved or is unused

import { MessageService } from '../services/message-service.js';
import { NoteService } from '../services/note-service.js';

// TRUTH: We leverage Firestore's native caching and Edge CDN. 
// In-memory caching in multi-instance environments is used safely for read-only bundle boosts.
interface BundleCacheEntry {
    buffer: Buffer;
    expiresAt: number;
}
const bundleCache = new Map<string, BundleCacheEntry>();

/**
 * Get Firestore Bundle for group messages
 * This allows the client to load the last 50 messages in 1 Read instead of 50.
 */
router.get('/bundle/:groupId', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response, next) => {
    const groupId = req.params.groupId as string;
    const uid = req.user!.uid;

    try {
        // 1. Check permissions with robust polling for consistency
        // This is critical for E2E tests where the bundle request might arrive 
        // before the Firestore write from the 'setup-test-group' call has fully propagated.
        const groupRef = db.collection('groups').doc(groupId);
        let gSnap = await groupRef.get();
        let gData = gSnap.data();
        
        let attempts = 0;
        const maxAttempts = 3;
        const delays = [800, 1500, 2500]; // Increasing backoff
        
        while (attempts < maxAttempts) {
            const inMembers = (gData?.members || []).includes(uid);
            const isOwner = gData?.ownerUserId === uid;
            
            if (gSnap.exists && (inMembers || isOwner)) {
                // Success - document is found and user has access
                break;
            }
            
            attempts++;
            if (attempts >= maxAttempts) break;
            
            console.warn(`[Bundle] Consistency check failed (Attempt ${attempts}/${maxAttempts}). exists=${gSnap.exists}, inMembers=${inMembers}, isOwner=${isOwner}. Retrying in ${delays[attempts-1]}ms...`);
            await new Promise(resolve => setTimeout(resolve, delays[attempts-1]));
            
            gSnap = await groupRef.get();
            gData = gSnap.data();
        }

        if (!gSnap.exists) {
            console.error(`[Bundle] 404: Group ${groupId} not found after ${attempts} attempts.`);
            throw new NotFoundError('Group not found');
        }
        
        const members = gData?.members || [];
        const isOwner = gData?.ownerUserId === uid;
        
        if (!members.includes(uid) && !isOwner) {
            console.error(`[Bundle] 403 Forbidden: uid=${uid} not in members and not owner. Members=[${members.join(', ')}].`);
            throw new ForbiddenError('Forbidden');
        }

        // HEALING: If user is owner but not in members array (emulator race condition), heal it
        if (isOwner && !members.includes(uid)) {
            console.warn(`[Bundle] Healing stale membership for owner ${uid} in group ${groupId}`);
            try {
                await groupRef.update({
                    members: admin.firestore.FieldValue.arrayUnion(uid),
                    membersCount: admin.firestore.FieldValue.increment(members.length === 0 ? 1 : 0)
                });
                
                // Ensure local copy is correct for bundle generation
                if (!gData!.members) gData!.members = [];
                if (!gData!.members.includes(uid)) {
                    gData!.members.push(uid);
                    gData!.membersCount = (gData!.membersCount || 0) + 1;
                }
            } catch (err) {
                console.error('[Bundle] Failed to heal membership:', err);
                // We still continue as the user IS the owner, but the bundle might be slightly stale
            }
        }

        // 3. Check authorized memory cache first
        const cached = bundleCache.get(groupId);
        if (cached && cached.expiresAt > Date.now()) {
            console.log(`[Bundle] Serving authorized in-memory cache for group ${groupId}`);
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
            return res.send(cached.buffer);
        }

        // 4. Generate Bundle (Fresh from Truth)
        console.log(`[Bundle] Generating new bundle for ${groupId}`);
        const bundle = db.bundle(`group-messages-${groupId}`);

        const latestRef = groupRef.collection('messages_latest').doc('latest');
        const latestSnap = await latestRef.get();

        if (latestSnap.exists) {
            console.log(`[Bundle] Including messages_latest/latest document for ${groupId}`);
            bundle.add(latestSnap);
        } else {
            // Fallback: If latest aggregate does not exist, query the messages subcollection directly
            console.warn(`[Bundle] messages_latest/latest not found for ${groupId}. Querying messages collection directly...`);
            const messagesRef = groupRef.collection('messages');
            const q = messagesRef.orderBy('createdAt', 'desc').limit(25);
            const querySnap = await q.get();

            bundle.add(`latest-messages-${groupId}`, querySnap);

            // Trigger self-healing in the background
            waitUntil(
                MessageService.reconcileLatestMessages(groupId)
                    .then(res => console.log(`[Bundle Self-Healing] Reconciled latest messages for ${groupId}: healed=${res.healed}, count=${res.count}`))
                    .catch(err => console.error(`[Bundle Self-Healing] Failed to reconcile for ${groupId}:`, err)) as Promise<unknown>
            );
        }

        const bundleBuffer = bundle.build();

        // Save to in-memory cache for 120 seconds (2 minutes)
        bundleCache.set(groupId, {
            buffer: bundleBuffer,
            expiresAt: Date.now() + 120000
        });

        // 5. Send with Edge Cache instructions (Fast & Consistent)
        const cacheHeader = 'public, s-maxage=60, stale-while-revalidate=120';
        
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Cache-Control', cacheHeader);
        res.send(bundleBuffer);

    } catch (error) {
        if (error instanceof NotFoundError || error instanceof ForbiddenError) {
            sendErrorResponse(res, error);
            return;
        }
        next(error);
    }
});

// Post Note
router.post(['/post-note', '/post-note/'], authenticate, requireEmailVerified, verifyAppCheck, async (req: AuthenticatedRequest, res: Response, next) => {
    try {
        const validation = postNoteSchema.safeParse(req.body);
        if (!validation.success) {
            throw new ValidationError('Invalid input');
        }

        const uid = req.user!.uid;
        const result = await NoteService.postNote({
            uid,
            ...validation.data
        });

        // Ensure background operations (notifications, stats, unity) are kept alive on serverless environments
        if (result.backgroundPromise) {
            waitUntil(result.backgroundPromise);
        }

        res.status(200).json({ 
            success: true, 
            message: 'Note posted successfully.', 
            ...result 
        });
    } catch (error) {
        if (error instanceof ValidationError) {
            sendErrorResponse(res, error);
            return;
        }
        // Now using global error handler via next()
        next(error);
    }
});

// Post Message
router.post('/post-message', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response, next) => {
    try {
        const validation = postMessageSchema.safeParse(req.body);
        if (!validation.success) throw new ValidationError('Invalid input');

        const { groupId, text, replyTo, optimisticId, nickname, photoURL, clientTimestamp } = validation.data;
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
            optimisticId,
            nickname,
            photoURL,
            clientTimestamp
        });

        // Notifications: waitUntil() keeps the function alive after response
        // to ensure notifications are reliably sent without blocking the client.
        waitUntil(
            notifyGroupMembers(groupId, uid, {
                title: result.nickname || 'Member',
                body: text.length > 100 ? text.substring(0, 97) + '...' : text,
                data: { type: 'chat', groupId }
            }, result.members).catch(err => console.error('Chat notification error:', err)) as Promise<unknown>
        );

        res.json({ success: true, messageId: result.messageId });

    } catch (error) {
        if (error instanceof ValidationError) {
            sendErrorResponse(res, error);
            return;
        }
        next(error);
    }
});

// Toggle Reaction (Atomic & Scalable)
router.post('/toggle-reaction', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response, next) => {
    const { groupId, messageId, emoji = '👍', nickname, photoURL } = req.body;
    const uid = req.user!.uid;

    try {
        if (!groupId || !messageId) throw new ValidationError('Missing params');

        const result = await MessageService.toggleReaction({
            uid,
            groupId,
            messageId,
            emoji,
            nickname,
            photoURL,
            skipGroupCheck: true
        });

        res.json({ success: true, ...result });
    } catch (error) {
        if (error instanceof ValidationError) {
            sendErrorResponse(res, error);
            return;
        }
        next(error);
    }
});

router.post('/delete-note', authenticate, requireEmailVerified, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const validation = deleteNoteSchema.safeParse(req.body);
        if (!validation.success) throw new ValidationError('Invalid input');

        const uid = req.user!.uid;
        const { noteId } = validation.data;

        await NoteService.deleteNote(uid, noteId);
        res.json({ success: true });
    } catch (error: unknown) {
        if (error instanceof ValidationError) {
            sendErrorResponse(res, error);
            return;
        }
        const err = error as Error;
        console.error('Error deleting note:', err);
        sendErrorResponse(res, err, 'An unexpected error occurred');
    }
});

// Edit Message
router.post('/edit-message', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response, next) => {
    const { groupId, messageId, text } = req.body;
    const uid = req.user!.uid;

    try {
        if (!groupId || !messageId || !text) throw new ValidationError('Missing params');

        await MessageService.editMessage({
            uid,
            groupId,
            messageId,
            text
        });

        res.json({ success: true });
    } catch (error) {
        if (error instanceof ValidationError) {
            sendErrorResponse(res, error);
            return;
        }
        next(error);
    }
});

router.post('/delete-message', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response, next) => {
    try {
        const validation = deleteMessageSchema.safeParse(req.body);
        if (!validation.success) throw new ValidationError('Invalid input');

        const { groupId, messageId } = validation.data;
        const uid = req.user!.uid;

        await MessageService.deleteMessage({
            uid,
            groupId,
            messageId
        });

        res.json({ success: true });
    } catch (error: unknown) {
        if (error instanceof ValidationError) {
            sendErrorResponse(res, error);
            return;
        }
        if (error instanceof Error) {
            if (error.message === 'Forbidden' || error.message.includes('own messages')) {
                sendErrorResponse(res, new ForbiddenError(error.message));
                return;
            }
            if (error.message === 'Group not found' || error.message === 'Message not found') {
                sendErrorResponse(res, new NotFoundError(error.message));
                return;
            }
        }
        next(error);
    }
});

// Send Cheer
router.post('/send-cheer', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response, next) => {
    try {
        const validation = sendCheerSchema.safeParse(req.body);
        if (!validation.success) throw new ValidationError('Invalid input');

        const { targetUid, groupId, language, senderNickname, senderTimeZone } = validation.data;
        const senderUid = req.user!.uid;

        if (senderUid === targetUid) throw new ValidationError('Self cheer');

        const result = await MessageService.sendCheer({
            senderUid,
            targetUid,
            groupId,
            senderNickname,
            senderTimeZone,
            skipGroupCheck: true,
            skipTargetUserCheck: true
        });

        if (result.alreadySent) throw new AppError('alreadySent', 429);

        // Notification: waitUntil() ensures this runs after the response
        // without blocking the client and without being killed by Vercel.
        waitUntil(
            (async () => {
                try {
                    const { tokens, language: targetLangVal } = await getUserFcmTokensAndLanguage(targetUid);
                    if (tokens.length > 0) {
                        const targetLang = (targetLangVal || 'en').split('-')[0].toLowerCase();
                        const lang = ((language as string) || targetLang || 'en').split('-')[0].toLowerCase();

                        const resultNotification = await sendPushNotification(tokens, {
                            title: result.senderNickname || 'Member',
                            body: t(lang, 'notifications.cheer_body'),
                            data: { type: 'cheer', groupId, lang }
                        });

                        if (resultNotification.failedTokens.length > 0) {
                            cleanupTokens(targetUid, resultNotification.failedTokens).catch(err => {
                                console.error('[NotificationSync] Failed to cleanup cheer tokens:', err);
                            });
                        }
                    }
                } catch (err) { console.error('Cheer notification error:', err); }
            })() as Promise<unknown>
        );

        res.json({ success: true });
    } catch (error: unknown) {
        if (error instanceof ValidationError) {
            sendErrorResponse(res, error);
            return;
        }
        next(error);
    }
});

export default router;

