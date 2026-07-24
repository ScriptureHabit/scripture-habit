/* eslint-disable no-restricted-properties */
import { admin, db } from '../lib/firebase-admin.js';
import { GroupDocument, MessageDocument, UserDocument, ReactionPreview, PersonalNoteDocument, FirestoreTimestamp } from '../../types/firestore.js';
import { formatDateInTimeZone, normalizeDateString } from '../../src/utils/time-utils.js';
import { buildNoteSearchTokens } from '../lib/search-utils.js';
import { getMessageExpireAt } from '../lib/ttl-utils.js';

export interface PostMessageParams {
    uid: string;
    groupId: string;
    text: string;
    replyTo?: {
        id: string;
        senderNickname: string;
        text: string;
        isNote: boolean;
    } | string | null;
    optimisticId?: string;
    nickname?: string;
    photoURL?: string | null;
    clientTimestamp?: number;
}

export interface ToggleReactionParams {
    uid: string;
    groupId: string;
    messageId: string;
    emoji?: string;
    nickname?: string;
    photoURL?: string | null;
    skipGroupCheck?: boolean;
}

export interface EditMessageParams {
    uid: string;
    groupId: string;
    messageId: string;
    text: string;
}

export interface DeleteMessageParams {
    uid: string;
    groupId: string;
    messageId: string;
}

export interface SendCheerParams {
    senderUid: string;
    targetUid: string;
    groupId: string;
    senderNickname?: string;
    senderTimeZone?: string;
    skipGroupCheck?: boolean;
    skipTargetUserCheck?: boolean;
}

export class MessageService {
    static async appendToLatest(
        transaction: admin.firestore.Transaction, 
        groupId: string, 
        messageData: Record<string, unknown>,
        preReadLatestSnap?: admin.firestore.DocumentSnapshot
    ) {
        const groupRef = db.collection('groups').doc(groupId);
        const latestRef = groupRef.collection('messages_latest').doc('latest');
        
        let latestSnap = preReadLatestSnap;
        if (!latestSnap) {
            latestSnap = await transaction.get(latestRef);
        }

        let currentMessages: Record<string, unknown>[] = [];
        if (latestSnap.exists) {
            currentMessages = latestSnap.data()?.messages || [];
        } else {
            // If the latest cache document does not exist, we cannot perform transaction.get()
            // because this function is called inside the write phase of transactions, which would
            // cause a Read-after-Write violation. We fallback to an empty array.
            currentMessages = [];
        }

        const updatedMessages = [...currentMessages, messageData].slice(-25);

        transaction.set(latestRef, {
            groupId,
            messages: updatedMessages,
            lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }

    static async postMessage(params: PostMessageParams) {
        const { uid, groupId, text, replyTo, optimisticId, clientTimestamp } = params;

        return await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(uid);
            const groupRef = db.collection('groups').doc(groupId);
            const latestRef = groupRef.collection('messages_latest').doc('latest');
            
            let nickname = params.nickname;
            let photoURL = params.photoURL;

            const needsUserRead = !nickname || photoURL === undefined;
            
            // --- PHASE 1: READ PHASE (Strict Read-before-Write) ---
            const { userSnap, groupSnap, currentMessages } = await (async () => {
                const promises = [transaction.get(latestRef), transaction.get(groupRef)];
                if (needsUserRead) {
                    promises.push(transaction.get(userRef));
                }
                
                const snaps = await Promise.all(promises);
                const latestSnap = snaps[0];
                const groupSnap = snaps[1];
                const uSnapResult = needsUserRead ? snaps[2] : null;

                if (!groupSnap.exists) throw new Error('Group not found');
                const gData = groupSnap.data() as GroupDocument;
                const members = gData.members || [];
                if (!members.includes(uid) && gData.ownerUserId !== uid) {
                    throw new Error('Forbidden');
                }

                if (needsUserRead && (!uSnapResult || !uSnapResult.exists)) throw new Error('Not found.');

                let messagesList: Record<string, unknown>[] = [];
                if (latestSnap && latestSnap.exists) {
                    messagesList = latestSnap.data()?.messages || [];
                } else {
                    const bootSnap = await transaction.get(
                        groupRef.collection('messages')
                            .orderBy('createdAt', 'desc')
                            .limit(24)
                    );
                    messagesList = bootSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse();
                }

                return {
                    userSnap: uSnapResult,
                    groupSnap,
                    currentMessages: messagesList
                };
            })();

            // --- PHASE 2: WRITE PHASE ---
            const msgRef = groupRef.collection('messages').doc();
            
            if (needsUserRead && userSnap) {
                const userData = userSnap.data() as UserDocument;
                nickname = nickname || userData.nickname || 'Member';
                photoURL = photoURL !== undefined ? photoURL : (userData.photoURL || '');
            } else {
                nickname = nickname || 'Member';
                photoURL = photoURL !== undefined ? photoURL : '';
            }
            
            const msgData: MessageDocument = {
                text,
                senderId: uid,
                senderNickname: nickname,
                senderPhotoURL: photoURL,
                createdAt: admin.firestore.FieldValue.serverTimestamp() as unknown as FirestoreTimestamp,
                isNote: false,
                isEntry: false,
                ...(replyTo ? { 
                    replyTo: typeof replyTo === 'string' ? replyTo : {
                        id: replyTo.id,
                        senderNickname: replyTo.senderNickname,
                        text: replyTo.text,
                        isNote: !!replyTo.isNote
                    }
                } : {}),
                ...(optimisticId ? { optimisticId } : {}),
                ...(clientTimestamp ? { clientTimestamp } : {}),
                expireAt: getMessageExpireAt()
            };

            transaction.set(msgRef, msgData);

            // Create client-friendly message item for array
            const arrayMsg = {
                id: msgRef.id,
                ...msgData,
                createdAt: admin.firestore.Timestamp.now() // Use a resolved Timestamp for immediate client rendering
            };

            const updatedMessages = [...currentMessages, arrayMsg].slice(-25);
            transaction.set(latestRef, {
                groupId,
                messages: updatedMessages,
                lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            const updatePayload = {
                lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
                lastMessageByNickname: nickname,
                lastMessageByUid: uid,
                [`memberLastReadAt.${uid}`]: admin.firestore.FieldValue.serverTimestamp(),
                [`memberLastActive.${uid}`]: admin.firestore.FieldValue.serverTimestamp()
            } as unknown as admin.firestore.UpdateData<GroupDocument>;

            transaction.update(groupRef, updatePayload);
            
            const memberRef = groupRef.collection('members').doc(uid);
            transaction.set(memberRef, {
                uid,
                nickname: nickname,
                photoURL: photoURL,
                lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
                lastPostAt: admin.firestore.FieldValue.serverTimestamp(),
                lastReadAt: admin.firestore.FieldValue.serverTimestamp(),
                readMessageCount: admin.firestore.FieldValue.increment(1)
            }, { merge: true });

            const userGS = userRef.collection('groupStates').doc(groupId);
            transaction.set(userGS, { 
                readMessageCount: admin.firestore.FieldValue.increment(1), 
                lastReadAt: admin.firestore.FieldValue.serverTimestamp(), 
                lastActiveAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            const members = (groupSnap.data() as GroupDocument)?.members || [];

            return { messageId: msgRef.id, nickname: nickname, members };
        });
    }

    static async toggleReaction(params: ToggleReactionParams) {
        const { uid, groupId, messageId, emoji = '👍' } = params;

        return await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(uid);
            const messageRef = db.collection('groups').doc(groupId).collection('messages').doc(messageId);
            const groupRef = db.collection('groups').doc(groupId);
            const latestRef = groupRef.collection('messages_latest').doc('latest');

            let nickname = params.nickname;
            let photoURL = params.photoURL;

            const refsToGet = [messageRef, latestRef];
            const needsUserRead = !nickname || photoURL === undefined;
            const needsGroupRead = !params.skipGroupCheck;

            if (needsGroupRead) {
                refsToGet.push(groupRef);
            }
            if (needsUserRead) {
                refsToGet.push(userRef);
            }

            const snaps = await transaction.getAll(...refsToGet);
            const mSnap = snaps[0];
            const latestSnap = snaps[1];
            
            let snapIdx = 2;
            const gSnap = needsGroupRead ? snaps[snapIdx++] : null;
            const uSnap = needsUserRead ? snaps[snapIdx++] : null;

            if (!mSnap.exists || (needsGroupRead && !gSnap?.exists) || (needsUserRead && !uSnap?.exists)) {
                if (!mSnap.exists) {
                    throw new Error('Message not found');
                }
                throw new Error('Not found');
            }

            if (needsGroupRead && gSnap) {
                const gData = gSnap.data() as GroupDocument;
                if (!gData || !(gData.members || []).includes(uid)) throw new Error('Forbidden');
            }

            const mData = mSnap.data() as MessageDocument;
            const reactions = mData.reactions || {};
            const uids: string[] = reactions[emoji] || [];
            const hasReacted = uids.includes(uid);

            if (needsUserRead && uSnap) {
                const uData = uSnap.data() as UserDocument;
                nickname = nickname || uData?.nickname || 'Member';
                photoURL = photoURL !== undefined ? photoURL : (uData?.photoURL || null);
            } else {
                nickname = nickname || 'Member';
                photoURL = photoURL !== undefined ? photoURL : null;
            }

            const newUids = hasReacted 
                ? uids.filter(id => id !== uid) 
                : [...uids, uid];
            
            let newPreviews = mData.reactionPreviews?.[emoji] || [];
            if (hasReacted) {
                newPreviews = newPreviews.filter((p: ReactionPreview) => p.uid !== uid);
            } else {
                const myPreview = { uid, nickname: nickname || 'Member', photoURL: photoURL || null };
                newPreviews = [myPreview, ...newPreviews].slice(0, 20);
            }

            transaction.update(mSnap.ref, {
                [`reactions.${emoji}`]: newUids,
                [`reactionPreviews.${emoji}`]: newPreviews
            });

            // Update in latest aggregate document
            if (latestSnap.exists) {
                const messages = (latestSnap.data()?.messages || []) as Record<string, unknown>[];
                const idx = messages.findIndex(m => m.id === messageId);
                if (idx !== -1) {
                    const msg = { ...messages[idx] };
                    const reactions = (msg['reactions'] || {}) as Record<string, unknown>;
                    reactions[emoji] = newUids;
                    msg['reactions'] = reactions;

                    const previews = (msg['reactionPreviews'] || {}) as Record<string, unknown>;
                    previews[emoji] = newPreviews;
                    msg['reactionPreviews'] = previews;

                    messages[idx] = msg;
                    transaction.update(latestRef, { messages });
                }
            }

            const now = admin.firestore.FieldValue.serverTimestamp();
            transaction.update(groupRef, {
                [`memberLastReadAt.${uid}`]: now
            });
            transaction.set(groupRef.collection('members').doc(uid), {
                lastReadAt: now
            }, { merge: true });
            transaction.set(userRef.collection('groupStates').doc(groupId), {
                lastReadAt: now
            }, { merge: true });

            return { hasReacted: !hasReacted, newUids, newPreviews };
        });
    }

    static async editMessage(params: EditMessageParams) {
        const { uid, groupId, messageId, text } = params;

        return await db.runTransaction(async (transaction) => {
            const groupRef = db.collection('groups').doc(groupId);
            const messageRef = groupRef.collection('messages').doc(messageId);
            const latestRef = groupRef.collection('messages_latest').doc('latest');

            const [mSnap, latestSnap] = await Promise.all([
                transaction.get(messageRef),
                transaction.get(latestRef)
            ]);

            if (!mSnap.exists) {
                throw new Error('Message not found');
            }

            const mData = mSnap.data() as MessageDocument;
            if (mData.senderId !== uid) throw new Error('Forbidden');

            // --- 1. GATHER ALL READS ---
            let noteSnap: admin.firestore.DocumentSnapshot | null = null;
            const noteRef = db.collection('users').doc(uid).collection('notes').doc(mData.originalNoteId || 'dummy');
            if (mData.isNote && mData.originalNoteId) {
                noteSnap = await transaction.get(noteRef);
            }

            // --- 2. EXECUTE ALL WRITES ---
            transaction.update(messageRef, {
                text,
                isEdited: true,
                editedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Update latest aggregate document
            if (latestSnap.exists) {
                const messages = (latestSnap.data()?.messages || []) as Record<string, unknown>[];
                const idx = messages.findIndex(m => m.id === messageId);
                if (idx !== -1) {
                    const msg = { ...messages[idx] };
                    msg.text = text;
                    msg.isEdited = true;
                    msg.editedAt = admin.firestore.Timestamp.now();
                    messages[idx] = msg;
                    transaction.update(latestRef, { messages });
                }
            }

            if (noteSnap && noteSnap.exists) {
                const noteData = noteSnap.data() as PersonalNoteDocument;
                const updatedTokens = buildNoteSearchTokens({
                    scripture: noteData.scripture || '',
                    chapter: noteData.chapter || '',
                    comment: text,
                    title: noteData.title || '',
                    speaker: noteData.speaker || ''
                });

                transaction.update(noteRef, {
                    text,
                    isEdited: true,
                    editedAt: admin.firestore.FieldValue.serverTimestamp(),
                    searchTokens: updatedTokens
                });

                const sharedMsgMap: Record<string, string> = noteData.sharedMessageIds || {};
                const targetGids = Object.entries(sharedMsgMap).slice(0, 20);

                for (const [gid, mid] of targetGids) {
                    if (gid === groupId && mid === messageId) continue;
                    const otherRef = db.collection('groups').doc(gid).collection('messages').doc(mid);
                    transaction.update(otherRef, {
                        text,
                        isEdited: true,
                        editedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            }
        });
    }

    static async deleteMessage(params: DeleteMessageParams) {
        const { uid, groupId, messageId } = params;

        return await db.runTransaction(async (transaction) => {
            const groupRef = db.collection('groups').doc(groupId);
            const msgRef = groupRef.collection('messages').doc(messageId);
            const latestRef = groupRef.collection('messages_latest').doc('latest');

            const [gSnap, msgSnap, latestSnap] = await Promise.all([
                transaction.get(groupRef),
                transaction.get(msgRef),
                transaction.get(latestRef)
            ]);

            if (!gSnap.exists) throw new Error('Group not found');
            const gData = gSnap.data() as GroupDocument;

            if (!msgSnap.exists) {
                throw new Error('Message not found');
            }
            const msgData = msgSnap.data() as MessageDocument;

            if (msgData.isSystemMessage === true) throw new Error('Cannot delete system messages');
            if (msgData.senderId !== uid) throw new Error('Forbidden: You can only delete your own messages');

            // --- 1. GATHER ALL READS UPFRONT ---
            const isLastMessage = gData.lastMessageByUid === uid;
            const isLastNote = msgData.isNote && gData.lastNoteByUid === uid;
            
            const now = new Date();
            const groupToday = formatDateInTimeZone(now, gData.timeZone || 'UTC');
            const normalizedToday = normalizeDateString(groupToday);
            const isDailyActive = normalizeDateString(gData.dailyActivity?.date || '') === normalizedToday && gData.dailyActivity?.activeMembers?.includes(uid);
            
            const noteRef = db.collection('users').doc(uid).collection('notes').doc(msgData.originalNoteId || 'dummy');

            const [
                recentMemberNotesSnap,
                recentMsgsSnap,
                todayNotesSnap,
                streakAnnouncementSnap,
                noteSnap
            ] = await Promise.all([
                msgData.isNote ? transaction.get(
                    groupRef.collection('messages')
                        .where('senderId', '==', uid)
                        .where('isNote', '==', true)
                        .orderBy('createdAt', 'desc')
                        .limit(2)
                ) : Promise.resolve(null),

                (isLastMessage || isLastNote) ? transaction.get(
                    db.collection('groups').doc(groupId).collection('messages')
                        .orderBy('createdAt', 'desc')
                        .limit(25)
                ) : Promise.resolve(null),

                isDailyActive ? transaction.get(
                    groupRef.collection('messages')
                        .where('senderId', '==', uid)
                        .where('isNote', '==', true)
                        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(new Date(now.setHours(0,0,0,0))))
                        .limit(2)
                ) : Promise.resolve(null),

                msgData.isNote ? transaction.get(
                    groupRef.collection('messages')
                        .where('isSystemMessage', '==', true)
                        .where('senderId', '==', 'system')
                        .orderBy('createdAt', 'desc')
                        .limit(10)
                ) : Promise.resolve(null),

                (msgData.isNote && msgData.originalNoteId) ? transaction.get(noteRef) : Promise.resolve(null)
            ]);

            const groupUpdate: admin.firestore.UpdateData<GroupDocument> = {};

            // Update latest aggregate document (recommended shrinkage method)
            if (latestSnap.exists) {
                const messages = (latestSnap.data()?.messages || []) as Record<string, unknown>[];
                const updatedMessages = messages.filter(m => m.id !== messageId);
                transaction.update(latestRef, { messages: updatedMessages });
            }

            if (msgData.isNote) {
                transaction.update(db.collection('users').doc(uid), {
                    totalNotes: admin.firestore.FieldValue.increment(-1)
                });
                
                if (recentMemberNotesSnap) {
                    const nextMemberNote = recentMemberNotesSnap.docs.filter(d => d.id !== messageId)[0];
                    const memberRef = groupRef.collection('members').doc(uid);
                    if (nextMemberNote) {
                        transaction.update(memberRef, { lastNoteAt: nextMemberNote.data().createdAt });
                    } else {
                        transaction.update(memberRef, { lastNoteAt: admin.firestore.FieldValue.delete() });
                    }
                }
            }

            if (recentMsgsSnap) {
                const candidates = recentMsgsSnap.docs
                    .map(d => ({ id: d.id, ...d.data() as MessageDocument }))
                    .filter(m => m.id !== messageId);
                
                if (isLastMessage) {
                    const nextLastMsg = candidates[0];
                    if (nextLastMsg) {
                        groupUpdate.lastMessageAt = nextLastMsg.createdAt;
                        groupUpdate.lastMessageByNickname = nextLastMsg.senderNickname || 'Someone';
                        groupUpdate.lastMessageByUid = nextLastMsg.senderId;
                    } else {
                        groupUpdate.lastMessageAt = admin.firestore.FieldValue.delete();
                        groupUpdate.lastMessageByNickname = admin.firestore.FieldValue.delete();
                        groupUpdate.lastMessageByUid = admin.firestore.FieldValue.delete();
                    }
                }
                
                if (isLastNote) {
                    const nextNotes = candidates.filter(c => c.isNote);
                    const nextLastNote = nextNotes[0];
                    if (nextLastNote) {
                        groupUpdate.lastNoteAt = nextLastNote.createdAt;
                        groupUpdate.lastNoteByNickname = nextLastNote.senderNickname || 'Member';
                        groupUpdate.lastNoteByUid = nextLastNote.senderId;
                    } else {
                        groupUpdate.lastNoteAt = admin.firestore.FieldValue.delete();
                        groupUpdate.lastNoteByNickname = admin.firestore.FieldValue.delete();
                        groupUpdate.lastNoteByUid = admin.firestore.FieldValue.delete();
                    }
                }
            }

            if (isDailyActive && todayNotesSnap) {
                const otherTodayPosts = todayNotesSnap.docs.filter(d => d.id !== messageId);
                if (otherTodayPosts.length === 0) {
                    groupUpdate['dailyActivity.activeMembers'] = admin.firestore.FieldValue.arrayRemove(uid);
                }
            }

            transaction.delete(msgRef);

            if (streakAnnouncementSnap) {
                streakAnnouncementSnap.docs.forEach(doc => {
                    const data = doc.data();
                    const text = (data.text || '').toLowerCase();
                    const nickname = (msgData.senderNickname || '').toLowerCase();
                    if (text.includes(nickname) && (text.includes('streak') || text.includes('連続') || text.includes('日'))) {
                         transaction.delete(doc.ref);
                         console.log(`[MessageService] Cleaned up streak announcement for ${nickname}`);
                    }
                });
            }

            if (Object.keys(groupUpdate).length > 0) {
                transaction.update(groupRef, groupUpdate);
            }

            if (noteSnap && noteSnap.exists) {
                const noteData = noteSnap.data() as PersonalNoteDocument;
                const updatedSharedGroups = (noteData.sharedWithGroups || []).filter((id: string) => id !== groupId);
                const sharedMessageIds = { ...(noteData.sharedMessageIds || {}) };
                delete sharedMessageIds[groupId];

                transaction.update(noteRef, {
                    sharedWithGroups: updatedSharedGroups,
                    sharedMessageIds: sharedMessageIds
                });
            }
        });
    }

    static async sendCheer(params: SendCheerParams) {
        const { senderUid, targetUid, groupId } = params;

        let senderNickname = params.senderNickname;
        let senderTimeZone = params.senderTimeZone;

        if (!senderNickname || !senderTimeZone) {
            const senderDoc = await db.collection('users').doc(senderUid).get();
            const senderData = senderDoc.data() as UserDocument || {};
            senderNickname = senderNickname || senderData.nickname || 'Member';
            senderTimeZone = senderTimeZone || senderData.timeZone || 'UTC';
        }

        let today;
        try {
            today = new Date().toLocaleDateString('sv-SE', { timeZone: senderTimeZone });
        } catch {
            today = new Date().toISOString().split('T')[0];
        }

        const cheerDocId = `cheer_${senderUid}_${targetUid}_${today}`;
        const cheerRef = db.collection('cheers').doc(cheerDocId);

        return await db.runTransaction(async (transaction) => {
            const groupRef = db.collection('groups').doc(groupId);
            const targetUserRef = db.collection('users').doc(targetUid);
            
            const refsToGet = [cheerRef];
            const needsTargetUserRead = !params.skipTargetUserCheck;
            if (needsTargetUserRead) {
                refsToGet.push(targetUserRef);
            }
            const needsGroupRead = !params.skipGroupCheck;
            if (needsGroupRead) {
                refsToGet.push(groupRef);
            }

            const snaps = await transaction.getAll(...refsToGet);
            const existing = snaps[0];
            
            let snapIdx = 1;
            const targetUserDoc = needsTargetUserRead ? snaps[snapIdx++] : null;
            const gSnap = needsGroupRead ? snaps[snapIdx++] : null;

            if (needsGroupRead && gSnap) {
                if (!gSnap.exists) throw new Error('Group not found.');
                const gData = gSnap.data() as GroupDocument;
                const gMembers: string[] = gData.members || [];
                if (!gMembers.includes(senderUid) || !gMembers.includes(targetUid)) throw new Error('Forbidden.');
            }

            if (existing.exists) return { alreadySent: true, targetData: null };
            if (needsTargetUserRead && targetUserDoc) {
                if (!targetUserDoc.exists) throw new Error('Target not found.');
            }

            transaction.set(cheerRef, { 
                senderUid, 
                targetUid, 
                groupId, 
                date: today, 
                timestamp: admin.firestore.FieldValue.serverTimestamp() 
            });

            transaction.update(targetUserRef, {
                cheersReceived: admin.firestore.FieldValue.increment(1)
            });

            return { 
                alreadySent: false, 
                targetData: targetUserDoc ? (targetUserDoc.data() as UserDocument) : null, 
                senderNickname 
            };
        });
    }

    static async reconcileLatestMessages(groupId: string) {
        const groupRef = db.collection('groups').doc(groupId);
        const latestRef = groupRef.collection('messages_latest').doc('latest');

        // PRE-CHECK (to avoid reading all 25 messages if they are already in sync)
        try {
            const [latestSnap, countSnap] = await Promise.all([
                latestRef.get(),
                groupRef.collection('messages').limit(25).count().get()
            ]);

            if (latestSnap.exists) {
                const latestMessages = (latestSnap.data()?.messages || []) as Record<string, unknown>[];
                const actualCount = countSnap.data().count;

                if (latestMessages.length === actualCount) {
                    if (actualCount === 0) {
                        return { healed: false, count: 0 };
                    }

                    // Compare the single newest message ID
                    const newestMsgSnap = await groupRef.collection('messages')
                        .orderBy('createdAt', 'desc')
                        .limit(1)
                        .get();

                    if (!newestMsgSnap.empty) {
                        const newestMsgId = newestMsgSnap.docs[0].id;
                        const lastMsgInLatestDoc = latestMessages[latestMessages.length - 1];

                        if (lastMsgInLatestDoc && lastMsgInLatestDoc.id === newestMsgId) {
                            return { healed: false, count: actualCount };
                        }
                    }
                }
            }
        } catch (err) {
            console.warn(`[reconcileLatestMessages] Pre-check failed, falling back to full transaction:`, err);
        }

        return await db.runTransaction(async (transaction) => {
            const [latestSnap, actualMessagesSnap] = await Promise.all([
                transaction.get(latestRef),
                transaction.get(
                    groupRef.collection('messages')
                        .orderBy('createdAt', 'desc')
                        .limit(25)
                )
            ]);

            const actualMessages = actualMessagesSnap.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .reverse(); // Order chronologically

            let needsHealing = false;

            if (!latestSnap.exists) {
                needsHealing = true;
            } else {
                const latestMessages = (latestSnap.data()?.messages || []) as Record<string, unknown>[];
                
                if (latestMessages.length !== actualMessages.length) {
                    needsHealing = true;
                } else {
                    for (let i = 0; i < actualMessages.length; i++) {
                        if (latestMessages[i].id !== actualMessages[i].id) {
                            needsHealing = true;
                            break;
                        }
                    }
                }
            }

            if (needsHealing) {
                console.log(`[Self-Healing] Healing messages_latest/latest for group: ${groupId}`);
                transaction.set(latestRef, {
                    groupId,
                    messages: actualMessages,
                    lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                return { healed: true, count: actualMessages.length };
            }

            return { healed: false, count: actualMessages.length };
        });
    }
}
