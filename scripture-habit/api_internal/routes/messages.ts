import express, { Response } from 'express';
import { admin, db } from '../lib/firebase-admin.js';
import { verifyAppCheck, authenticate, requireEmailVerified, AuthenticatedRequest } from '../lib/middleware.js';
import { postNoteSchema, postMessageSchema, sendCheerSchema, deleteNoteSchema, deleteMessageSchema } from '../lib/schemas.js';
import { notifyGroupMembers, sendPushNotification, getUserFcmTokens } from '../lib/notifications.js';
import { tArray } from '../lib/i18n.js';
import { CounterService } from '../services/counter-service.js';
import { ReactionPreview, GroupDocument, MessageDocument, UserDocument, GroupMemberDocument } from '../../types/firestore.js';
import { buildNoteSearchTokens } from '../lib/search-utils.js';

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
            res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
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

        // 4. Cache and Send (Both in-memory and Edge CDN)
        const cacheHeader = 'public, s-maxage=60, stale-while-revalidate=300';
        bundleCache.set(groupId, { data: bundleBuffer, expiresAt: now + BUNDLE_TTL_MS });
        
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
                ...(replyTo ? { replyTo } : {}),
                ...(optimisticId ? { optimisticId } : {})
            };

            transaction.set(msgRef, msgData);

            // Important: Handle message count shards
            CounterService.increment(transaction, groupRef);
            const totalMessages = (await CounterService.getCountInTransaction(transaction, groupRef)) + 1;
            
            const memberRef = groupRef.collection('members').doc(uid);
            const userData = uSnap.data() as UserDocument;

            const memberData: GroupMemberDocument = {
                uid,
                nickname: userData.nickname || 'Member',
                photoURL: userData.photoURL || '',
                joinedAt: admin.firestore.Timestamp.now(), // admin.Timestamp is compatible with our interface shape
                lastActiveAt: admin.firestore.Timestamp.now(),
                lastReadAt: admin.firestore.Timestamp.now(),
                readMessageCount: totalMessages,
                kickThreshold: userData.kickThreshold || 3
            };
            
            // Single consolidated write
            transaction.set(memberRef, memberData, { merge: true });

            const now = new Date();
            const groupTimeZone = gData.timeZone || 'UTC';
            let groupToday;
            try {
                groupToday = now.toLocaleDateString('sv-SE', { timeZone: groupTimeZone });
            } catch {
                groupToday = now.toLocaleDateString('sv-SE', { timeZone: 'UTC' });
            }

            const updatePayload: Record<string, admin.firestore.FieldValue | string | string[] | number | object | undefined> = {
                lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
                lastMessageByNickname: userData.nickname || 'Member',
                lastMessageByUid: uid,
                [`memberLastReadAt.${uid}`]: admin.firestore.FieldValue.serverTimestamp(),
                [`memberLastActive.${uid}`]: admin.firestore.FieldValue.serverTimestamp()
            };

            // TRUTH: Messages should contribute to daily activity/unity just like notes
            if (gData.dailyActivity?.date !== groupToday) {
                updatePayload.dailyActivity = { date: groupToday, activeMembers: [uid] };
            } else {
                updatePayload['dailyActivity.activeMembers'] = admin.firestore.FieldValue.arrayUnion(uid);
            }

            transaction.update(groupRef, updatePayload);

            // (Removed redundant second set on memberRef)

            
            const userGS = userRef.collection('groupStates').doc(groupId);
            transaction.set(userGS, { 
                readMessageCount: totalMessages, 
                lastReadAt: admin.firestore.FieldValue.serverTimestamp() 
            }, { merge: true });

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

        // Probabilistic Aggregation (Sync shards back to main doc every ~10 messages)
        if (Math.random() < 0.1) {
            CounterService.aggregateAndSync(db.collection('groups').doc(groupId), 'messageCount').catch(err => {
                console.warn(`[API] Aggregation failed for group ${groupId}:`, err);
            });
        }

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
        const result = await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(uid);
            const messageRef = db.collection('groups').doc(groupId).collection('messages').doc(messageId);
            const groupRef = db.collection('groups').doc(groupId);

            const [uSnap, mSnap, gSnap] = await transaction.getAll(userRef, messageRef, groupRef);

            if (!mSnap.exists || !gSnap.exists || !uSnap.exists) throw new Error('Not found');
            const gData = gSnap.data() as GroupDocument;
            if (!gData || !(gData.members || []).includes(uid)) throw new Error('Forbidden');

            const mData = mSnap.data() as MessageDocument;
            if (!mData) throw new Error('Message data not found');

            const reactions = mData.reactions || {};
            const uids: string[] = reactions[emoji] || [];
            const hasReacted = uids.includes(uid);

            const uData = uSnap.data() as UserDocument;
            const newUserNickname = uData?.nickname || 'Member';
            const newUserPhotoURL = uData?.photoURL || null;

            // Update UIDs list
            const newUids = hasReacted 
                ? uids.filter(id => id !== uid) 
                : [...uids, uid];
            
            // Build new Previews (top 3)
            let newPreviews = mData.reactionPreviews?.[emoji] || [];
            if (hasReacted) {
                newPreviews = newPreviews.filter((p: ReactionPreview) => p.uid !== uid);
            } else {
                const myPreview = { uid, nickname: newUserNickname, photoURL: newUserPhotoURL };
                newPreviews = [myPreview, ...newPreviews].slice(0, 3);
            }

            transaction.update(mSnap.ref, {
                [`reactions.${emoji}`]: newUids,
                [`reactionPreviews.${emoji}`]: newPreviews
            });

            return { hasReacted: !hasReacted, newUids, newPreviews };
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
                if (!groupSnap.exists) continue;

                const gData = groupSnap.data() as GroupDocument;
                const updatePayload: admin.firestore.UpdateData<GroupDocument> = {};

                // Use sharded counter for consistency
                CounterService.increment(transaction, groupRef, -1);
                
                if (gData.noteCount !== undefined) {
                    updatePayload.noteCount = admin.firestore.FieldValue.increment(-1);
                }

                transaction.delete(msgRef);

                // TRUTH: If we deleted the message that was currently recorded as lastNote, 
                // we should clear the metadata so the dashboard doesn't show a ghost note.
                if (gData.lastNoteByUid === uid) {
                    const deletedNoteAtMillis = (noteData.createdAt as admin.firestore.Timestamp)?.toMillis?.() || 0;
                    const groupLastNoteAtMillis = (gData.lastNoteAt as admin.firestore.Timestamp)?.toMillis?.() || 0;

                    if (deletedNoteAtMillis > 0 && deletedNoteAtMillis === groupLastNoteAtMillis) {
                        transaction.update(groupRef, {
                            ...updatePayload,
                            lastNoteAt: admin.firestore.FieldValue.delete(),
                            lastNoteByNickname: admin.firestore.FieldValue.delete(),
                            lastNoteByUid: admin.firestore.FieldValue.delete()
                        });
                    } else {
                        transaction.update(groupRef, updatePayload);
                    }
                } else {
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
        const messageRef = db.collection('groups').doc(groupId).collection('messages').doc(messageId);
        const mSnap = await messageRef.get();
        if (!mSnap.exists) return res.status(404).json({ error: 'Message not found' });

        const mData = mSnap.data() as MessageDocument;
        if (mData.senderId !== uid) return res.status(403).json({ error: 'Forbidden' });

        await db.runTransaction(async (transaction) => {
            transaction.update(messageRef, {
                text,
                isEdited: true,
                editedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // TRUTH: If this message is a Note, sync the change back to the personal note原本 
            // AND rebuild search tokens so the index doesn't provide "stale truth".
            if (mData.isNote && mData.originalNoteId) {
                const noteRef = db.collection('users').doc(uid).collection('notes').doc(mData.originalNoteId);
                const noteSnap = await transaction.get(noteRef);
                const noteData = noteSnap.data() || {};
                
                transaction.update(noteRef, {
                    text,
                    isEdited: true,
                    editedAt: admin.firestore.FieldValue.serverTimestamp(),
                    // Rebuild search tokens with new content while preserving other index fields
                    searchTokens: buildNoteSearchTokens({
                        scripture: noteData.scripture || '',
                        chapter: noteData.chapter || '',
                        comment: text, // The edited text is the 'comment' in the original structure
                        title: noteData.title || '',
                        speaker: noteData.speaker || ''
                    })
                });
            }
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
            const groupRef = db.collection('groups').doc(groupId);

        await db.runTransaction(async (transaction) => {
            const gSnap = await transaction.get(groupRef);
            if (!gSnap.exists) throw new Error('Group not found');
            const gData = gSnap.data() as GroupDocument;

            const msgRef = groupRef.collection('messages').doc(messageId);
            const msgSnap = await transaction.get(msgRef);
            if (!msgSnap.exists) throw new Error('Message not found');

            const msgData = msgSnap.data() as MessageDocument;
            if (msgData.isSystemMessage === true) {
                throw new Error('Cannot delete system messages');
            }
            if (msgData.senderId !== uid && gData.ownerUserId !== uid) {
                throw new Error('Forbidden');
            }

            const updatePayload: admin.firestore.UpdateData<GroupDocument> = {};
            
            // Use sharded counter for consistency
            CounterService.increment(transaction, groupRef, -1);

            if (msgData.isNote) {
                updatePayload.noteCount = admin.firestore.FieldValue.increment(-1);
                // TRUTH: Also decrement the user's totalNotes to maintain statistical consistency
                transaction.update(db.collection('users').doc(uid), {
                    totalNotes: admin.firestore.FieldValue.increment(-1)
                });
            }

            // --- LOCAL DELETION ONLY ---
            transaction.delete(msgRef);

            // Cleanup Note Metadata safely if it was a Note
            if (msgData.isNote && msgData.originalNoteId) {
                const noteRef = db.collection('users').doc(uid).collection('notes').doc(msgData.originalNoteId);
                const noteSnap = await transaction.get(noteRef);
                if (noteSnap.exists) {
                    const noteData = noteSnap.data()!;
                    const updatedSharedGroups = (noteData.sharedWithGroups || []).filter((id: string) => id !== groupId);
                    const sharedMessageIds = { ...(noteData.sharedMessageIds || {}) };
                    delete sharedMessageIds[groupId];

                    transaction.update(noteRef, {
                        sharedWithGroups: updatedSharedGroups,
                        sharedMessageIds: sharedMessageIds
                    });
                }
            }

            // --- Metadata Regression: Find new latest if we just deleted it ---
            const currentLastAtMillis = (gData.lastMessageAt as admin.firestore.Timestamp)?.toMillis?.() || 0;
            const deletedAtMillis = (msgData.createdAt as admin.firestore.Timestamp)?.toMillis?.() || 0;

            if (currentLastAtMillis > 0 && currentLastAtMillis === deletedAtMillis) {
                // Try to find the *actual* previous message to restore truth in the dashboard
                const prevMsgSnap = await transaction.get(
                    groupRef.collection('messages')
                        .orderBy('createdAt', 'desc')
                        .limit(2) // Get current (about to be deleted) and the real previous
                );
                
                const realPrev = prevMsgSnap.docs.find(d => d.id !== messageId);
                if (realPrev) {
                    const prevData = realPrev.data() as MessageDocument;
                    updatePayload.lastMessageAt = prevData.createdAt;
                    updatePayload.lastMessageByNickname = prevData.senderNickname;
                    updatePayload.lastMessageByUid = prevData.senderId;
                } else {
                    // Truly the last message in the group
                    updatePayload.lastMessageAt = admin.firestore.FieldValue.delete();
                    updatePayload.lastMessageByNickname = admin.firestore.FieldValue.delete();
                    updatePayload.lastMessageByUid = admin.firestore.FieldValue.delete();
                }
            }

            if (msgData.isNote) {
                const currentLastNoteAtMillis = (gData.lastNoteAt as admin.firestore.Timestamp)?.toMillis?.() || 0;
                if (currentLastNoteAtMillis > 0 && currentLastNoteAtMillis === deletedAtMillis) {
                    const prevNoteSnap = await transaction.get(
                        groupRef.collection('messages')
                            .where('isNote', '==', true)
                            .orderBy('createdAt', 'desc')
                            .limit(2)
                    );
                    const realPrevNote = prevNoteSnap.docs.find(d => d.id !== messageId);
                    if (realPrevNote) {
                        const pnData = realPrevNote.data() as MessageDocument;
                        updatePayload.lastNoteAt = pnData.createdAt;
                        updatePayload.lastNoteByNickname = pnData.senderNickname;
                        updatePayload.lastNoteByUid = pnData.senderId;
                    } else {
                        updatePayload.lastNoteAt = admin.firestore.FieldValue.delete();
                        updatePayload.lastNoteByNickname = admin.firestore.FieldValue.delete();
                        updatePayload.lastNoteByUid = admin.firestore.FieldValue.delete();
                    }
                }
            }

            transaction.update(groupRef, updatePayload);
        });

        res.json({ success: true });
    } catch (error: unknown) {
        if (error instanceof Error) {
            if (error.message === 'Forbidden') return res.status(403).json({ error: 'Forbidden' });
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

        const senderDoc = await db.collection('users').doc(senderUid).get();
        const senderData = senderDoc.data() || {};
        const senderNickname = senderData.nickname || 'Member';

        const today = new Date().toISOString().split('T')[0]; // TRUTH: Constant UTC-based date ID
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

