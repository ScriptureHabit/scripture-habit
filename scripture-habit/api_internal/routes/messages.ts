import express, { Response } from 'express';
import { admin, db } from '../lib/firebase-admin.js';
import { verifyAppCheck, authenticate, requireEmailVerified, AuthenticatedRequest } from '../lib/middleware.js';
import { postNoteSchema, postMessageSchema, sendCheerSchema, deleteNoteSchema, deleteMessageSchema } from '../lib/schemas.js';
import { notifyGroupMembers, sendPushNotification, getUserFcmTokens } from '../lib/notifications.js';
import { tArray } from '../lib/i18n.js';

const router = express.Router();

// Remove redundant logic here as it's being moved or is unused

import { NoteService } from '../services/note-service.js';

// Simple in-memory cache for bundles to prevent redundant Firestore reads
const bundleCache = new Map<string, { data: Buffer; expiresAt: number }>();
const BUNDLE_TTL_MS = 60 * 1000; // 1 minute

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

        // 2. Check cache
        const now = Date.now();
        const cached = bundleCache.get(groupId);
        if (cached && cached.expiresAt > now) {
            console.log(`[Bundle] Serving cached bundle for ${groupId}`);
            res.setHeader('Content-Type', 'application/octet-stream');
            return res.send(cached.data);
        }

        // 3. Generate Bundle
        console.log(`[Bundle] Generating new bundle for ${groupId}`);
        const messagesRef = groupRef.collection('messages');
        const q = messagesRef.orderBy('createdAt', 'desc').limit(50);
        const querySnap = await q.get();

        // Create the bundle
        const bundle = db.bundle(`group-messages-${groupId}`);
        const bundleBuffer = bundle
            .add(`latest-messages-${groupId}`, querySnap)
            .build();

        // 4. Cache and Send
        bundleCache.set(groupId, { data: bundleBuffer, expiresAt: now + BUNDLE_TTL_MS });
        res.setHeader('Content-Type', 'application/octet-stream');
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

    const { groupId, text, replyTo } = validation.data;
    const uid = req.user!.uid;

    try {

        const result = await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(uid);
            const groupRef = db.collection('groups').doc(groupId);
            const uSnap = await transaction.get(userRef);
            const gSnap = await transaction.get(groupRef);

            if (!uSnap.exists || !gSnap.exists) throw new Error('Not found.');
            const gData = gSnap.data()!;
            if (!(gData.members || []).includes(uid)) throw new Error('Forbidden.');

            const msgRef = groupRef.collection('messages').doc();
            const msgData = {
                text,
                senderId: uid,
                senderNickname: uSnap.data()?.nickname || 'Member',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                isNote: false,
                isEntry: false,
                ...(replyTo ? { replyTo } : {})
            };

            transaction.set(msgRef, msgData);

            transaction.update(groupRef, {
                messageCount: admin.firestore.FieldValue.increment(1),
                lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
                lastMessageByNickname: uSnap.data()?.nickname || 'Member',
                lastMessageByUid: uid,
                [`memberLastReadAt.${uid}`]: admin.firestore.FieldValue.serverTimestamp()
            });
            
            const userGS = userRef.collection('groupStates').doc(groupId);
            transaction.set(userGS, { readMessageCount: admin.firestore.FieldValue.increment(1), lastReadAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

            return { messageId: msgRef.id, nickname: uSnap.data()?.nickname, members: gData.members };
        });

        // Notifications
        try {
            await notifyGroupMembers(groupId, uid, {
                title: result.nickname,
                body: text.length > 100 ? text.substring(0, 97) + '...' : text,
                data: { type: 'chat', groupId }
            }, result.members);
        } catch (err) { console.error('Chat notification error:', err); }

        res.json({ success: true, messageId: result.messageId });
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
        const noteRef = db.collection('users').doc(uid).collection('notes').doc(noteId);
        const noteSnap = await noteRef.get();
        if (!noteSnap.exists) return res.status(404).json({ error: 'Note not found' });

        const noteData = noteSnap.data() || {};
        const sharedMessageIds: Record<string, string> = typeof noteData.sharedMessageIds === 'object' && noteData.sharedMessageIds !== null
            ? noteData.sharedMessageIds
            : {};

        const batch = db.batch();
        batch.delete(noteRef);
        batch.update(db.collection('users').doc(uid), {
            totalNotes: admin.firestore.FieldValue.increment(-1)
        });

        Object.entries(sharedMessageIds).forEach(([groupId, messageId]) => {
            batch.delete(db.collection('groups').doc(groupId).collection('messages').doc(String(messageId)));
            batch.update(db.collection('groups').doc(groupId), {
                messageCount: admin.firestore.FieldValue.increment(-1),
                noteCount: admin.firestore.FieldValue.increment(-1)
            });
        });

        await batch.commit();
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
        const groupRef = db.collection('groups').doc(groupId);
        const messageRef = groupRef.collection('messages').doc(messageId);

        const [groupSnap, messageSnap] = await Promise.all([groupRef.get(), messageRef.get()]);
        if (!groupSnap.exists) return res.status(404).json({ error: 'Group not found' });
        if (!messageSnap.exists) return res.status(404).json({ error: 'Message not found' });

        const groupData = groupSnap.data()!;
        const messageData = messageSnap.data()!;

        if (messageData.isSystemMessage === true) {
            return res.status(403).json({ error: 'Cannot delete system messages' });
        }
        if (messageData.senderId !== uid && groupData.ownerUserId !== uid) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const updatePayload: admin.firestore.UpdateData<admin.firestore.DocumentData> = {
            messageCount: admin.firestore.FieldValue.increment(-1)
        };


        if (messageData.isNote === true) {
            updatePayload.noteCount = admin.firestore.FieldValue.increment(-1);
        }

        const batch = db.batch();
        batch.delete(messageRef);
        batch.update(groupRef, updatePayload);
        await batch.commit();

        res.json({ success: true });
    } catch (error: unknown) {
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

        const senderDoc = await db.collection('users').doc(senderUid).get();
        const senderData = senderDoc.data() || {};
        const senderNickname = senderData.nickname || 'Member';

        const timeZone = senderData.timeZone || 'UTC';
        const today = new Date().toLocaleDateString('en-CA', { timeZone });
        const cheerDocId = `cheer_${senderUid}_${targetUid}_${today}`;
        const cheerRef = db.collection('cheers').doc(cheerDocId);

        const result = await db.runTransaction(async (transaction) => {
            const groupRef = db.collection('groups').doc(groupId);
            const gSnap = await transaction.get(groupRef);
            if (!gSnap.exists) throw new Error('Group not found.');
            const gData = gSnap.data()!;
            const gMembers: string[] = gData.members || [];

            if (!gMembers.includes(senderUid) || !gMembers.includes(targetUid)) throw new Error('Forbidden.');

            const existing = await transaction.get(cheerRef);
            if (existing.exists) return { alreadySent: true, targetData: null };

            const targetUserDoc = await transaction.get(db.collection('users').doc(targetUid));
            if (!targetUserDoc.exists) throw new Error('Target not found.');

            transaction.set(cheerRef, { 
                senderUid, 
                targetUid, 
                groupId, 
                date: today, 
                timestamp: admin.firestore.FieldValue.serverTimestamp() 
            });
            return { alreadySent: false, targetData: targetUserDoc.data() };
        });

        if (result.alreadySent) return res.status(429).json({ error: 'alreadySent' });

        // Notification
        try {
            const tokens = await getUserFcmTokens(targetUid);
            if (tokens.length > 0) {
                const targetLang = (result.targetData?.language as string) || 'en';
                const lang = (language as string) || targetLang || 'en';
                const templates = tArray(lang, 'notifications.cheer_options');
                const body = templates[Math.floor(Math.random() * templates.length)].replace('{nickname}', senderNickname);

                await sendPushNotification(tokens, { 
                    title: '💪 Cheer received!', 
                    body, 
                    data: { type: 'cheer', groupId } 
                });
            }
        } catch (err) { console.error('Cheer notification error:', err); }

        res.json({ success: true });
    } catch (error: unknown) {
        next(error);
    }

});

export default router;
