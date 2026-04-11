import { buildNoteSearchTokens } from '../lib/search-utils.js';
import { db } from '../lib/firebase-admin.js';
import { MessageDocument, ReactionPreview, GroupDocument, MemberPreview, PersonalNoteDocument } from '../../types/firestore.js';

export class ProfileService {
    /**
     * Propagates user profile changes (nickname, photoURL) to recent messages and reactions.
     * This ensures that when a user updates their look, it reflects in active chats without
     * needing to update thousands of historical records (saving costs!).
     */
    static async syncProfileToChats(uid: string, updates: { nickname?: string; photoURL?: string }) {
        if (!updates.nickname && !updates.photoURL) return;

        console.log(`[ProfileSync] Starting sync for user ${uid}...`);

        try {
            // 1. Get the user's active groups
            const userRef = db.collection('users').doc(uid);
            const userSnap = await userRef.get();
            if (!userSnap.exists) return;

            const userData = userSnap.data() || {};
            const groupIds: string[] = userData.groupIds || (userData.groupId ? [userData.groupId] : []);
            
            if (groupIds.length === 0) return;

            let currentBatch = db.batch();
            let totalOps = 0;
            let currentBatchSize = 0;

            // 2. Fetch all group metadata in a single call (Speed Boost)
            const groupRefs = groupIds.map(gid => db.collection('groups').doc(gid));
            const groupSnaps = groupRefs.length > 0 ? await db.getAll(...groupRefs) : [];

            for (const gSnap of groupSnaps) {
                if (!gSnap.exists) continue;
                const gid = gSnap.id;
                const gData = gSnap.data() || {};
                const groupUpdates: Partial<GroupDocument> = {};
                
                const memberUpdate: Record<string, string | undefined> = {};
                if (updates.nickname) memberUpdate.nickname = updates.nickname;
                if (updates.photoURL) memberUpdate.photoURL = updates.photoURL;

                if (Object.keys(memberUpdate).length > 0) {
                    currentBatch.set(gSnap.ref.collection('members').doc(uid), memberUpdate, { merge: true });
                    currentBatchSize++;
                }
                    
                // B. Update memberPreviews array if user is in it
                const previews = gData.memberPreviews || [];
                const userIdx = previews.findIndex((p: MemberPreview) => p.uid === uid);
                if (userIdx !== -1) {
                    const newPreviews = [...previews];
                    if (updates.nickname) newPreviews[userIdx].nickname = updates.nickname;
                    if (updates.photoURL) newPreviews[userIdx].photoURL = updates.photoURL;
                    groupUpdates.memberPreviews = newPreviews;
                }

                // C. Update 'lastNoteByNickname' if this user was the last poster
                if (updates.nickname && gData.lastNoteByUid === uid) {
                    groupUpdates.lastNoteByNickname = updates.nickname;
                }
                if (updates.nickname && gData.lastMessageByUid === uid) {
                    groupUpdates.lastMessageByNickname = updates.nickname;
                }

                if (Object.keys(groupUpdates).length > 0) {
                    currentBatch.update(gSnap.ref, groupUpdates);
                    currentBatchSize++;
                }

                // D. Update individual messages (Exhaustive Batching)
                let messagesProcessed = 0;
                let lastMsgDoc = null;
                const MAX_MESSAGES_PER_GROUP = 500; 

                while (messagesProcessed < MAX_MESSAGES_PER_GROUP) {
                    let query = db.collection('groups').doc(gid).collection('messages')
                        .where('senderId', '==', uid)
                        .orderBy('createdAt', 'desc')
                        .limit(100);
                    
                    if (lastMsgDoc) {
                        query = query.startAfter(lastMsgDoc);
                    }

                    const messagesSnap = await query.get();
                    if (messagesSnap.empty) break;

                    for (const mDoc of messagesSnap.docs) {
                        const mData = mDoc.data() as MessageDocument;
                        const msgUpdate: Partial<MessageDocument> = {};
                        if (updates.nickname) msgUpdate.senderNickname = updates.nickname;
                        if (updates.photoURL) msgUpdate.senderPhotoURL = updates.photoURL;
                        
                        // TRUTH: If the user has reacted to this message, update their identity in the previews
                        if (mData.reactionPreviews) {
                            const rp = { ...mData.reactionPreviews };
                            let rpChanged = false;
                            for (const emoji of Object.keys(rp)) {
                                const previews = (rp[emoji] || []) as ReactionPreview[];
                                const myIdx = previews.findIndex(p => p.uid === uid);
                                if (myIdx !== -1) {
                                    if (updates.nickname) previews[myIdx].nickname = updates.nickname;
                                    if (updates.photoURL) previews[myIdx].photoURL = updates.photoURL;
                                    rp[emoji] = previews;
                                    rpChanged = true;
                                }
                            }
                            if (rpChanged) msgUpdate.reactionPreviews = rp;
                        }

                        currentBatch.update(mDoc.ref, msgUpdate);
                        currentBatchSize++;
                        totalOps++;

                        if (currentBatchSize >= 450) {
                            await currentBatch.commit();
                            currentBatch = db.batch();
                            currentBatchSize = 0;
                        }
                    }
                    
                    messagesProcessed += messagesSnap.size;
                    lastMsgDoc = messagesSnap.docs[messagesSnap.size - 1];
                }
            }

            // 3. Sync Identity to archived Notes (Search Truth)
            if (updates.nickname) {
                const oldNickname = userData.nickname || 'Member';
                
                // TRUTH: Exhaustive sync for notes as well (background safe)
                let lastNoteDoc = null;
                while (true) {
                    let query = userRef.collection('notes')
                        .orderBy('createdAt', 'desc')
                        .limit(100);
                    
                    if (lastNoteDoc) query = query.startAfter(lastNoteDoc);

                    const notesSnap = await query.get();
                    if (notesSnap.empty) break;

                    for (const nDoc of notesSnap.docs) {
                        const nData = nDoc.data() as PersonalNoteDocument;
                        
                        if (nData.speaker !== oldNickname) continue;

                        const updatedTokens = buildNoteSearchTokens({
                            scripture: nData.scripture || '',
                            chapter: nData.chapter || '',
                            comment: nData.comment || '',
                            title: nData.title || '',
                            speaker: updates.nickname
                        });

                        currentBatch.update(nDoc.ref, {
                            speaker: updates.nickname,
                            searchTokens: updatedTokens
                        });
                        currentBatchSize++;

                        if (currentBatchSize >= 450) {
                            await currentBatch.commit();
                            currentBatch = db.batch();
                            currentBatchSize = 0;
                        }
                    }
                    lastNoteDoc = notesSnap.docs[notesSnap.size - 1];
                }
            }

            if (currentBatchSize > 0) {
                await currentBatch.commit();
            }
            console.log(`[ProfileSync] Successfully completed sync for user ${uid}. Total updates: ${totalOps}`);
        } catch (error) {
            console.error(`[ProfileSync] Error syncing profile for ${uid}:`, error);
        }
    }

    /**
     * Anonymize user identity in recent reaction previews when account is deleted.
     */
    static async purgeSocialIdentity(uid: string) {
        try {
            const userSnap = await db.collection('users').doc(uid).get();
            if (!userSnap.exists) return;
            const userData = userSnap.data() || {};
            const groupIds: string[] = userData.groupIds || (userData.groupId ? [userData.groupId] : []);

            for (const gid of groupIds) {
                let lastMsgDoc = null;
                while (true) {
                    let query = db.collection('groups').doc(gid).collection('messages')
                        .orderBy('createdAt', 'desc')
                        .limit(100);
                    
                    if (lastMsgDoc) query = query.startAfter(lastMsgDoc);
                    const recentMsgs = await query.get();
                    if (recentMsgs.empty) break;

                    const batch = db.batch();
                    let hasChanges = false;
                    let opsInBatch = 0;

                    for (const mDoc of recentMsgs.docs) {
                        const mData = mDoc.data() as MessageDocument;
                        if (mData.reactionPreviews) {
                            const rp = { ...mData.reactionPreviews };
                            let rpChanged = false;

                            for (const emoji of Object.keys(rp)) {
                                const previews = (rp[emoji] || []) as ReactionPreview[];
                                const myIdx = previews.findIndex(p => p.uid === uid);
                                if (myIdx !== -1) {
                                    previews[myIdx].nickname = '...';
                                    previews[myIdx].photoURL = '';
                                    rp[emoji] = previews;
                                    rpChanged = true;
                                }
                            }

                            if (rpChanged) {
                                batch.update(mDoc.ref, { reactionPreviews: rp });
                                hasChanges = true;
                                opsInBatch++;
                            }
                        }
                        
                        if (opsInBatch >= 450) {
                            await batch.commit();
                            // Reset batch if needed, but we typically commit one batch per query chunk for simplicity
                        }
                    }
                    if (hasChanges && opsInBatch < 450) await batch.commit();
                    
                    lastMsgDoc = recentMsgs.docs[recentMsgs.size - 1];
                }
            }
        } catch (err) {
            console.error('[ProfileService] Purge failed:', err);
        }
    }
}
