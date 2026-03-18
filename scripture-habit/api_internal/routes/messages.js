import express from 'express';
import { admin, db } from '../lib/firebase-admin.js';
import { verifyAppCheck, authenticate, requireEmailVerified } from '../lib/middleware.js';
import { postNoteSchema, postMessageSchema, sendCheerSchema } from '../lib/schemas.js';
import { notifyGroupMembers, sendPushNotification, getUserFcmTokens, STREAK_ANNOUNCEMENT_TEMPLATES, CHEER_NOTIFICATION_TEMPLATES } from '../lib/notifications.js';

const router = express.Router();

// Helper: Escape markdown for nickname
const escapeMarkdown = (text) => text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');

// Post Note
router.post('/post-note', authenticate, requireEmailVerified, verifyAppCheck, async (req, res) => {
    const validation = postNoteSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });
    }
    
    const uid = req.user.uid;
    const {
        messageText,
        scripture,
        chapter,
        comment,
        title,
        speaker,
        shareOption,
        selectedShareGroups,
        language,
        timeZone: clientTimeZone
    } = validation.data;

    try {

        const result = await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(uid);
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) throw new Error('User not found.');

            const userData = userDoc.data();
            const userGroupIds = userData.groupIds || (userData.groupId ? [userData.groupId] : []);

            // 1. Identify target groups (Move READs up)
            let groupsToPostTo = [];
            if (shareOption === 'all') groupsToPostTo = userGroupIds;
            else if (shareOption === 'specific') groupsToPostTo = selectedShareGroups || [];
            else if (shareOption === 'current' && userData.groupId) groupsToPostTo = [userData.groupId];

            const groupRefs = groupsToPostTo.map(gid => db.collection('groups').doc(gid));
            const groupDocs = groupRefs.length > 0 ? await transaction.getAll(...groupRefs) : [];

            // 2. Calculate Streak
            const now = new Date();
            const timeZone = userData.timeZone || 'UTC';
            const today = now.toLocaleDateString('sv-SE', { timeZone });
            const yesterdayDate = new Date(now);
            yesterdayDate.setDate(yesterdayDate.getDate() - 1);
            const yesterday = yesterdayDate.toLocaleDateString('sv-SE', { timeZone });

            let newStreak = userData.streakCount || userData.streak || 0;
            let currentHighest = userData.highestStreak || newStreak;
            let streakUpdated = false;

            // Accurate time calculation (UTC)
            const lastPostAt = userData.lastPostAt ? (userData.lastPostAt.toDate ? userData.lastPostAt.toDate() : new Date(userData.lastPostAt)) : new Date(0);
            const hoursSinceLastPost = (now.getTime() - lastPostAt.getTime()) / (1000 * 60 * 60);

            const userUpdate = {
                totalNotes: admin.firestore.FieldValue.increment(1),
                lastPostAt: admin.firestore.Timestamp.fromDate(now) // Store exact time for future checks
            };

            // Cleanup legacy field if present
            if (userData.streak !== undefined) {
                userUpdate.streak = admin.firestore.FieldValue.delete();
            }

            // Streak Logic: 
            // 1. If it's a different day in user's home timezone
            // 2. AND it's not a future date (which could happen if traveling west)
            if (userData.lastPostDate !== today) {
                if (userData.lastPostDate > today) {
                    // Future guard: if user posted while in a later time zone,
                    // we don't increment, but we definitely don't reset.
                    // Just skip updating streak-specific fields.
                } else if (!userData.lastPostDate || userData.lastPostDate === "") {
                    // First time/Migration fallback
                    newStreak = (newStreak > 0) ? newStreak + 1 : 1;
                    streakUpdated = true;
                } else {
                    const isConsecutiveDay = userData.lastPostDate === yesterday;
                    const isTraveling = clientTimeZone && clientTimeZone !== timeZone;
                    const withinGracePeriod = isTraveling && hoursSinceLastPost < 45; // 45h only if traveling

                    if (isConsecutiveDay || withinGracePeriod) {
                        // It's either the next calendar day, OR within travel grace period.
                        // Removed 12h restriction for traveling to support fast timezone jumps (e.g. crossing dateline east).
                        newStreak += 1;
                    } else {
                        // Gap is too large or not consecutive
                        newStreak = 1;
                    }
                    streakUpdated = true;
                }

                if (streakUpdated) {
                    userUpdate.streakCount = newStreak;
                    userUpdate.lastPostDate = today;

                    if (newStreak > currentHighest) {
                        userUpdate.highestStreak = newStreak;
                    }

                    // Proactively save timezone if it's missing or different from what they just sent
                    // (Self-healing for existing users or if they permanently moved)
                    if (clientTimeZone && (!userData.timeZone || userData.timeZone === 'UTC')) {
                        userUpdate.timeZone = clientTimeZone;
                    }
                }
            }

            transaction.update(userRef, userUpdate);

            const userToGroupMap = new Map();
            const validatedGroupsToPostTo = [];

            groupDocs.forEach(gDoc => {
                if (!gDoc.exists) return;
                const gid = gDoc.id;
                const members = gDoc.data().members || [];
                if (!members.includes(uid)) return;

                validatedGroupsToPostTo.push(gid);
                members.forEach(mUid => {
                    if (mUid !== uid && !userToGroupMap.has(mUid)) {
                        userToGroupMap.set(mUid, gid);
                    }
                });
            });

            // 3. Create Note
            const noteRef = userRef.collection('notes').doc();
            const noteTimestamp = admin.firestore.Timestamp.now();
            const sharedMessageIds = {};

            // 4. Post to groups
            groupDocs.forEach((gDoc, idx) => {
                const gid = gDoc.id;
                if (!validatedGroupsToPostTo.includes(gid)) return;
                
                const gData = gDoc.data();
                const msgRef = db.collection('groups').doc(gid).collection('messages').doc();
                sharedMessageIds[gid] = msgRef.id;

                transaction.set(msgRef, {
                    text: messageText,
                    senderId: uid,
                    senderNickname: userData.nickname,
                    createdAt: noteTimestamp,
                    isNote: true,
                    originalNoteId: noteRef.id,
                    scripture: scripture || "",
                    chapter: chapter || ""
                });

                // Group Activity Date: Use the group's specific timezone if available,
                // otherwise fallback to the poster's timezone or UTC.
                const groupTimeZone = gData.timeZone || timeZone || 'UTC';
                const groupToday = now.toLocaleDateString('sv-SE', { timeZone: groupTimeZone });
                const updatePayload = {
                    messageCount: admin.firestore.FieldValue.increment(1),
                    noteCount: admin.firestore.FieldValue.increment(1),
                    lastMessageAt: noteTimestamp,
                    lastNoteAt: noteTimestamp,
                    lastNoteByNickname: userData.nickname,
                    lastNoteByUid: uid,
                    lastMessageByNickname: userData.nickname,
                    lastMessageByUid: uid,
                    [`memberLastActive.${uid}`]: admin.firestore.FieldValue.serverTimestamp()
                };

                if (gData.dailyActivity?.date !== groupToday) {
                    updatePayload.dailyActivity = { date: groupToday, activeMembers: [uid] };
                } else {
                    updatePayload['dailyActivity.activeMembers'] = admin.firestore.FieldValue.arrayUnion(uid);
                }
                transaction.update(groupRefs[idx], updatePayload);
                
                const userGS = userRef.collection('groupStates').doc(gid);
                transaction.set(userGS, { readMessageCount: admin.firestore.FieldValue.increment(1), lastReadAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            });

            transaction.set(noteRef, {
                text: messageText,
                createdAt: noteTimestamp,
                scripture,
                chapter,
                title: title || null,
                speaker: speaker || null,
                comment,
                shareOption,
                sharedWithGroups: validatedGroupsToPostTo,
                sharedMessageIds
            });

            // 5. Streak Announcements
            if (streakUpdated && newStreak > 0) {
                const safeNickname = escapeMarkdown(userData.nickname || 'Member');
                const announceMsg = (STREAK_ANNOUNCEMENT_TEMPLATES[language] || STREAK_ANNOUNCEMENT_TEMPLATES.en)
                    .replace('{nickname}', safeNickname)
                    .replace('{streak}', newStreak);
                
                const distinctGroupIds = [...new Set(userGroupIds)];
                distinctGroupIds.forEach(gid => {
                    const announceRef = db.collection('groups').doc(gid).collection('messages').doc();
                    transaction.set(announceRef, {
                        text: announceMsg,
                        senderId: 'system',
                        senderNickname: 'Scripture Habit Bot',
                        createdAt: admin.firestore.Timestamp.fromMillis(noteTimestamp.toMillis() + 2000),
                        isSystemMessage: true,
                        messageType: 'streakAnnouncement',
                        messageData: { nickname: userData.nickname, userId: uid, streakCount: newStreak }
                    });
                });
            }

            return { personalNoteId: noteRef.id, newStreak, streakUpdated, nickname: userData.nickname, userToGroupMapEntries: Array.from(userToGroupMap.entries()) };
        });

        // Push Notifications
        try {
            const lang = language || 'ja';
            const titleMap = {
                'ja': '📖 聖典学習', 'en': '📖 Scripture Study', 'es': '📖 Estudio de las escrituras',
                'pt': '📖 Estudo das escrituras', 'ko': '📖 성경 공부', 'zho': '📖 聖經學習',
                'vi': '📖 Học thánh thư', 'th': '📖 การศึกษาพระคัมภีร์', 'tl': '📖 Pag-aaral ng Banal na Kasulatan',
                'sw': '📖 Funzo la Maandiko'
            };
            const bodyTemplateMap = {
                'ja': '{nickname}さんがノートを投稿しました！✨', 'en': '{nickname} posted a note! ✨',
                'es': '¡{nickname} publicó una nota! ✨', 'pt': '{nickname} postou uma nota! ✨',
                'ko': '{nickname}님이 노트를 게시했습니다! ✨', 'zho': '{nickname} 發布了筆記！✨',
                'vi': '{nickname} đã đăng một ghi chú! ✨', 'th': '{nickname} โพสต์บันทึกแล้ว! ✨',
                'tl': '{nickname} ay nag-post ng note! ✨', 'sw': '{nickname} ameweka kumbukumbu! ✨'
            };

            const title = titleMap[lang] || titleMap['en'];
            const body = (bodyTemplateMap[lang] || bodyTemplateMap['en']).replace('{nickname}', result.nickname || 'Member');

            const groupsToNotifyMap = new Map();
            result.userToGroupMapEntries.forEach(([memberUid, gid]) => {
                if (!groupsToNotifyMap.has(gid)) groupsToNotifyMap.set(gid, []);
                groupsToNotifyMap.get(gid).push(memberUid);
            });

            await Promise.all(Array.from(groupsToNotifyMap.entries()).map(([gid, membersList]) => 
                notifyGroupMembers(gid, uid, { title, body, data: { type: 'note', groupId: gid } }, membersList)
            ));
        } catch (err) { console.error('Note notification error:', err); }

        res.status(200).json({ message: 'Note posted successfully.', ...result });
    } catch (error) {
        console.error('Error posting note:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

// Post Message
router.post('/post-message', authenticate, verifyAppCheck, async (req, res) => {
    const validation = postMessageSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: 'Invalid input' });

    const { groupId, text, replyTo } = validation.data;
    const uid = req.user.uid;

    try {

        const result = await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(uid);
            const groupRef = db.collection('groups').doc(groupId);
            const uSnap = await transaction.get(userRef);
            const gSnap = await transaction.get(groupRef);

            if (!uSnap.exists || !gSnap.exists) throw new Error('Not found.');
            const gData = gSnap.data();
            if (!(gData.members || []).includes(uid)) throw new Error('Forbidden.');

            const msgRef = groupRef.collection('messages').doc();
            const msgData = {
                text,
                senderId: uid,
                senderNickname: uSnap.data().nickname || 'Member',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                isNote: false,
                isEntry: false
            };
            if (replyTo) msgData.replyTo = replyTo;

            transaction.set(msgRef, msgData);
            transaction.update(groupRef, {
                messageCount: admin.firestore.FieldValue.increment(1),
                lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
                lastMessageByNickname: uSnap.data().nickname || 'Member',
                lastMessageByUid: uid,
                [`memberLastReadAt.${uid}`]: admin.firestore.FieldValue.serverTimestamp()
            });
            
            const userGS = userRef.collection('groupStates').doc(groupId);
            transaction.set(userGS, { readMessageCount: admin.firestore.FieldValue.increment(1), lastReadAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

            return { messageId: msgRef.id, nickname: uSnap.data().nickname, members: gData.members };
        });

        // Notifications
        try {
            await notifyGroupMembers(groupId, uid, {
                title: result.nickname,
                body: text.length > 100 ? text.substring(0, 97) + '...' : text,
                data: { type: 'chat', groupId }
            }, result.members);
        } catch (err) { console.error('Chat notification error:', err); }

        res.json({ messageId: result.messageId });
    } catch (error) {
        console.error('Error posting message:', error);
        res.status(500).json({ error: 'Request failed.' });
    }
});

// Send Cheer
router.post('/send-cheer', authenticate, verifyAppCheck, async (req, res) => {
    const validation = sendCheerSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: 'Invalid input' });

    const { targetUid, groupId, language } = validation.data;
    const senderUid = req.user.uid;

    try {

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
            const gData = gSnap.data();
            const gMembers = gData.members || [];

            if (!gMembers.includes(senderUid) || !gMembers.includes(targetUid)) throw new Error('Forbidden.');

            const existing = await transaction.get(cheerRef);
            if (existing.exists) return { alreadySent: true };

            const targetUserDoc = await transaction.get(db.collection('users').doc(targetUid));
            if (!targetUserDoc.exists) throw new Error('Target not found.');

            transaction.set(cheerRef, { 
                senderUid, 
                targetUid, 
                groupId, 
                date: today, 
                timestamp: admin.firestore.FieldValue.serverTimestamp() 
            });
            return { targetData: targetUserDoc.data() };
        });

        if (result.alreadySent) return res.status(429).json({ error: 'alreadySent' });

        // Notification
        try {
            const tokens = await getUserFcmTokens(targetUid);
            if (tokens.length > 0) {
                const lang = language || result.targetData.language || 'en';
                const templates = CHEER_NOTIFICATION_TEMPLATES[lang] || CHEER_NOTIFICATION_TEMPLATES['en'];
                const body = templates[Math.floor(Math.random() * templates.length)].replace('{nickname}', senderNickname);
                await sendPushNotification(tokens, { 
                    title: '💪 Cheer received!', 
                    body, 
                    data: { type: 'cheer', groupId } 
                });
            }
        } catch (err) { console.error('Cheer notification error:', err); }

        res.json({ success: true });
    } catch (error) {
        console.error('Cheer failed:', error.message);
        res.status(500).json({ error: 'Request failed.' });
    }
});

export default router;
