import express, { Response } from 'express';
import { admin, db } from '../lib/firebase-admin.js';
import { verifyAppCheck, authenticate, requireEmailVerified, AuthenticatedRequest } from '../lib/middleware.js';
import { postNoteSchema, postMessageSchema, sendCheerSchema, deleteNoteSchema, deleteMessageSchema } from '../lib/schemas.js';
import { notifyGroupMembers, sendPushNotification, cleanupTokens, getUserFcmTokensAndLanguage } from '../lib/notifications.js';
import { t } from '../lib/i18n.js';
import { waitUntil } from '@vercel/functions';

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
            return res.status(404).json({ error: 'Group not found' });
        }
        
        const members = gData?.members || [];
        const isOwner = gData?.ownerUserId === uid;
        
        if (!members.includes(uid) && !isOwner) {
            console.error(`[Bundle] 403 Forbidden: uid=${uid} not in members and not owner. Members=[${members.join(', ')}].`);
            return res.status(403).json({ error: 'Forbidden' });
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
            res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
            return res.send(cached.buffer);
        }

        // 4. Generate Bundle (Fresh from Truth)
        console.log(`[Bundle] Generating new bundle for ${groupId}`);
        const messagesRef = groupRef.collection('messages');
        const q = messagesRef.orderBy('createdAt', 'desc').limit(25);
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

        // Save to in-memory cache for 60 seconds
        bundleCache.set(groupId, {
            buffer: bundleBuffer,
            expiresAt: Date.now() + 60000
        });

        // 5. Send with Edge Cache instructions (Fast & Consistent)
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

    const { groupId, text, replyTo, optimisticId, nickname, photoURL, clientTimestamp } = validation.data;
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
            }, result.members).catch(err => console.error('Chat notification error:', err))
        );

        res.json({ success: true, messageId: result.messageId });

    } catch (error) {
        next(error);
    }
});

// Toggle Reaction (Atomic & Scalable)
router.post('/toggle-reaction', authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response, next) => {
    const { groupId, messageId, emoji = '👍', nickname, photoURL } = req.body;
    const uid = req.user!.uid;

    if (!groupId || !messageId) return res.status(400).json({ error: 'Missing params' });

    try {
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
        next(error);
    }
});

router.post('/delete-note', authenticate, requireEmailVerified, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {

    const validation = deleteNoteSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });
    try {
        const uid = req.user!.uid;
        const { noteId } = validation.data;

        await NoteService.deleteNote(uid, noteId);
        res.json({ success: true });
    } catch (error: unknown) {
        const err = error as Error;
        console.error('Error deleting note:', err);
        res.status(500).json({ 
            error: 'InternalServerError', 
            message: err.message || 'An unexpected error occurred' 
        });
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
        const { targetUid, groupId, language, senderNickname, senderTimeZone } = validation.data;
        const senderUid = req.user!.uid;

        if (senderUid === targetUid) return res.status(400).json({ error: 'Self cheer' });

        const result = await MessageService.sendCheer({
            senderUid,
            targetUid,
            groupId,
            senderNickname,
            senderTimeZone,
            skipGroupCheck: true,
            skipTargetUserCheck: true
        });

        if (result.alreadySent) return res.status(429).json({ error: 'alreadySent' });

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
            })()
        );

        res.json({ success: true });
    } catch (error: unknown) {
        next(error);
    }

});

export default router;

