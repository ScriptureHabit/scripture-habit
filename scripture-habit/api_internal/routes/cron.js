import express from 'express';
import { admin, db } from '../lib/firebase-admin.js';

const router = express.Router();

// Middleware to check CRON_SECRET
const verifyCronSecret = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        console.warn('Unauthorized access attempt to Cron endpoint');
        return res.status(401).send('Unauthorized');
    }
    next();
};

// Check Inactive Users
router.all('/check-inactive-users', verifyCronSecret, async (req, res) => {
    console.log('Starting inactivity check...');
    try {
        const groupsRef = db.collection('groups');
        const snapshot = await groupsRef.get();

        let processedCount = 0;
        let removedCount = 0;
        let transferCount = 0;
        let deletedGroupCount = 0;
        let initializedCount = 0;

        let batch = db.batch();
        let batchOpCount = 0;

        const now = new Date();

        for (const docSnapshot of snapshot.docs) {
            const groupData = docSnapshot.data();
            const groupId = docSnapshot.id;
            const members = groupData.members || [];
            const memberLastActive = groupData.memberLastActive || {};
            let ownerUserId = groupData.ownerUserId;

            if (members.length === 0) continue;

            let groupChanged = false;
            let groupUpdates = {};
            let isGroupDeleted = false;

            const activeMembers = [];
            const inactiveMembers = [];
            const membersToInitialize = [];

            const memberKickThresholds = groupData.memberKickThresholds || {};

            for (const memberId of members) {
                const lastActiveTimestamp = memberLastActive[memberId];
                const individualThresholdDays = memberKickThresholds[memberId] || 3;
                const individualThresholdMs = individualThresholdDays * 24 * 60 * 60 * 1000;

                if (!lastActiveTimestamp) {
                    membersToInitialize.push(memberId);
                    activeMembers.push(memberId);
                } else {
                    let lastActiveDate = lastActiveTimestamp.toDate ? lastActiveTimestamp.toDate() : new Date(lastActiveTimestamp.seconds * 1000 || lastActiveTimestamp);
                    const diff = now - lastActiveDate;

                    if (diff > individualThresholdMs) {
                        inactiveMembers.push(memberId);
                    } else {
                        activeMembers.push(memberId);
                    }
                }
            }

            // Check if Owner is Inactive
            if (inactiveMembers.includes(ownerUserId)) {
                if (activeMembers.length > 0) {
                    const newOwnerId = activeMembers[0];
                    groupUpdates['ownerUserId'] = newOwnerId;
                    ownerUserId = newOwnerId;
                    groupChanged = true;
                    transferCount++;

                    const transferMsgRef = groupsRef.doc(groupId).collection('messages').doc();
                    batch.set(transferMsgRef, {
                        text: `👑 **Ownership Transferred**\nThe previous owner was inactive. Ownership has been transferred to a verified active member.`,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        senderId: 'system',
                        isSystemMessage: true,
                        type: 'system'
                    });
                    batchOpCount++;
                } else {
                    await db.recursiveDelete(groupsRef.doc(groupId));
                    deletedGroupCount++;
                    isGroupDeleted = true;

                    for (const uid of members) {
                        const userRef = db.collection('users').doc(uid);
                        batch.update(userRef, { groupIds: admin.firestore.FieldValue.arrayRemove(groupId) });
                        batch.delete(userRef.collection('groupStates').doc(groupId));
                        batchOpCount += 2;
                    }
                }
            }

            if (isGroupDeleted) {
                processedCount++;
                if (batchOpCount > 400) { await batch.commit(); batch = db.batch(); batchOpCount = 0; }
                continue;
            }

            if (membersToInitialize.length > 0) {
                membersToInitialize.forEach(uid => { groupUpdates[`memberLastActive.${uid}`] = admin.firestore.FieldValue.serverTimestamp(); });
                groupChanged = true;
                initializedCount += membersToInitialize.length;
            }

            const finalMembersToRemove = inactiveMembers.filter(uid => uid !== ownerUserId);
            if (finalMembersToRemove.length > 0) {
                const remainingMembers = members.filter(m => !finalMembersToRemove.includes(m));
                const updatedPreviews = (groupData.memberPreviews || []).filter(p => !finalMembersToRemove.includes(p.uid));
                
                groupUpdates['members'] = admin.firestore.FieldValue.arrayRemove(...finalMembersToRemove);
                groupUpdates['membersCount'] = admin.firestore.FieldValue.increment(-finalMembersToRemove.length);
                groupUpdates['memberPreviews'] = updatedPreviews;
                
                finalMembersToRemove.forEach(uid => { 
                    groupUpdates[`memberLastActive.${uid}`] = admin.firestore.FieldValue.delete(); 
                    groupUpdates[`memberLastReadAt.${uid}`] = admin.firestore.FieldValue.delete();
                });
                groupChanged = true;
                removedCount += finalMembersToRemove.length;

                const messageRef = groupsRef.doc(groupId).collection('messages').doc();
                batch.set(messageRef, {
                    text: `👋 **${finalMembersToRemove.length} member(s)** were removed due to inactivity.`,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    senderId: 'system',
                    isSystemMessage: true,
                    type: 'leave'
                });
                batchOpCount++;

                for (const uid of finalMembersToRemove) {
                    const userRef = db.collection('users').doc(uid);
                    batch.update(userRef, { groupIds: admin.firestore.FieldValue.arrayRemove(groupId) });
                    batch.delete(userRef.collection('groupStates').doc(groupId));
                    batchOpCount += 2;
                }
            }

            if (groupChanged) {
                batch.update(groupsRef.doc(groupId), groupUpdates);
                batchOpCount++;
            }

            if (batchOpCount > 400) { await batch.commit(); batch = db.batch(); batchOpCount = 0; }
            processedCount++;
        }

        if (batchOpCount > 0) await batch.commit();

        res.json({
            message: 'Inactivity check complete.',
            stats: { processedGroups: processedCount, removedUsers: removedCount, initializedTracking: initializedCount, transferredOwnerships: transferCount, deletedGroups: deletedGroupCount }
        });
    } catch (error) {
        console.error('Error in inactivity check:', error);
        res.status(500).send('Error checking inactivity: ' + error.message);
    }
});

// Purge Initialized Users (Ghost buster)
router.get('/purge-initialized-users', verifyCronSecret, async (req, res) => {
    console.log('Starting ghost purge...');
    try {
        const groupsRef = db.collection('groups');
        const snapshot = await groupsRef.get();
        let totalRemoved = 0;
        let batch = db.batch();
        let batchOpCount = 0;
        const now = new Date();
        const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

        for (const groupDoc of snapshot.docs) {
            const groupId = groupDoc.id;
            const groupData = groupDoc.data();
            const members = groupData.members || [];
            const memberLastActive = groupData.memberLastActive || {};

            if (members.length === 0) continue;

            const messagesRef = groupsRef.doc(groupId).collection('messages');
            const msgsSnap = await messagesRef.orderBy('createdAt', 'desc').limit(200).get();
            const activeUserIds = new Set();
            msgsSnap.forEach(m => { if (m.data().senderId) activeUserIds.add(m.data().senderId); });

            const ghostsToRemove = [];
            for (const uid of members) {
                if (activeUserIds.has(uid)) continue;
                if (uid === groupData.ownerUserId) continue;

                const lastActive = memberLastActive[uid];
                if (lastActive) {
                    const lastActiveDate = lastActive.toDate();
                    if ((now - lastActiveDate) < TWO_HOURS_MS) {
                        ghostsToRemove.push(uid);
                    }
                }
            }

            if (ghostsToRemove.length > 0) {
                totalRemoved += ghostsToRemove.length;
                const updatedPreviews = (groupData.memberPreviews || []).filter(p => !ghostsToRemove.includes(p.uid));
                
                batch.update(groupsRef.doc(groupId), {
                    members: admin.firestore.FieldValue.arrayRemove(...ghostsToRemove),
                    membersCount: admin.firestore.FieldValue.increment(-ghostsToRemove.length),
                    memberPreviews: updatedPreviews
                });
                
                ghostsToRemove.forEach(uid => { 
                    batch.update(groupsRef.doc(groupId), { 
                        [`memberLastActive.${uid}`]: admin.firestore.FieldValue.delete(),
                        [`memberLastReadAt.${uid}`]: admin.firestore.FieldValue.delete()
                    }); 
                });
                
                const msgRef = messagesRef.doc();
                batch.set(msgRef, {
                    text: `👋 **${ghostsToRemove.length} inactive member(s)** were removed.`,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    senderId: 'system',
                    isSystemMessage: true,
                    type: 'leave'
                });
                batchOpCount += 2;

                for (const uid of ghostsToRemove) {
                    const userRef = db.collection('users').doc(uid);
                    batch.update(userRef, { groupIds: admin.firestore.FieldValue.arrayRemove(groupId) });
                    batch.delete(userRef.collection('groupStates').doc(groupId));
                    batchOpCount += 2;
                }
            }

            if (batchOpCount > 300) { await batch.commit(); batch = db.batch(); batchOpCount = 0; }
        }
        if (batchOpCount > 0) await batch.commit();
        res.json({ message: `Purge complete. Removed ${totalRemoved} ghost users.` });
    } catch (error) {
        console.error('Error purging:', error);
        res.status(500).json({ error: error.message });
    }
});

// Manual Test Endpoint
router.get('/test-inactive-check/:groupId', verifyCronSecret, async (req, res) => {
    const { groupId } = req.params;
    try {
        const groupRef = db.collection('groups').doc(groupId);
        const groupDoc = await groupRef.get();
        if (!groupDoc.exists) return res.status(404).json({ error: 'Not Found' });

        const groupData = groupDoc.data();
        const members = groupData.members || [];
        const memberLastActive = groupData.memberLastActive || {};
        const ownerUserId = groupData.ownerUserId;
        const now = new Date();
        const report = { groupId, groupName: groupData.name, totalMembers: members.length, ownerUserId, checkTime: now.toISOString(), members: [] };
        const memberKickThresholds = groupData.memberKickThresholds || {};

        for (const memberId of members) {
            const threshold = memberKickThresholds[memberId] || 3;
            const thresholdMs = threshold * 24 * 60 * 60 * 1000;
            const info = { memberId, isOwner: memberId === ownerUserId, threshold };

            if (memberId === ownerUserId) {
                info.status = 'Owner (skipped)';
                info.action = 'none';
            } else {
                const lastTs = memberLastActive[memberId];
                if (!lastTs) {
                    info.status = 'No tracking data';
                    info.action = 'would initialize';
                } else {
                    const lastDate = lastTs.toDate();
                    const diff = now - lastDate;
                    info.lastActive = lastDate.toISOString();
                    info.daysSinceActive = Math.floor(diff / (24 * 60 * 60 * 1000));
                    info.status = diff > thresholdMs ? '⚠️ Inactive' : '✅ Active';
                    info.action = diff > thresholdMs ? 'would remove' : 'keep';
                }
            }
            report.members.push(info);
        }
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
