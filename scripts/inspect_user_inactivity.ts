import { db } from '../api_internal/lib/firebase-admin.js';
import { calculateMemberStatus } from '../api_internal/lib/inactivity-utils.js';

async function diagnose() {
    console.log('🔍 Starting diagnostics for group "桐生ステーク" and user "アキ"...');

    // 1. Find the group document
    const groupQuery = await db.collection('groups').where('name', '==', '桐生ステーク').limit(1).get();
    if (groupQuery.empty) {
        console.error('❌ Group "桐生ステーク" not found in Firestore!');
        return;
    }
    const groupDoc = groupQuery.docs[0];
    const groupId = groupDoc.id;
    const groupData = groupDoc.data();
    console.log(`✅ Found Group: "${groupData.name}" (ID: ${groupId})`);
    console.log('Group Data Maps:');
    console.log(`- ownerUserId: ${groupData.ownerUserId}`);
    console.log(`- memberLastActive:`, JSON.stringify(groupData.memberLastActive || {}));
    console.log(`- memberLastReadAt:`, JSON.stringify(groupData.memberLastReadAt || {}));
    console.log(`- memberJoinedAt:`, JSON.stringify(groupData.memberJoinedAt || {}));
    console.log(`- memberKickThresholds:`, JSON.stringify(groupData.memberKickThresholds || {}));

    // 2. Find the user "アキ"
    const userQuery = await db.collection('users').where('nickname', '==', 'アキ').limit(1).get();
    if (userQuery.empty) {
        console.error('❌ User with nickname "アキ" not found in Firestore!');
        return;
    }
    const userDoc = userQuery.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();
    console.log(`✅ Found User: "${userData.nickname}" (UID: ${userId})`);
    console.log(`- user.groupIds:`, JSON.stringify(userData.groupIds || []));
    console.log(`- user.groupId:`, userData.groupId);
    console.log(`- user.kickThreshold:`, userData.kickThreshold);

    // 3. Find the member document in subcollection
    const memberDoc = await db.collection('groups').doc(groupId).collection('members').doc(userId).get();
    if (!memberDoc.exists) {
        console.warn(`⚠️ Warning: No member document found in subcollection /groups/${groupId}/members/${userId}!`);
    } else {
        const memberData = memberDoc.data()!;
        console.log(`✅ Found Member Subdocument:`);
        console.log(`- joinedAt:`, memberData.joinedAt?.toDate?.()?.toISOString() || memberData.joinedAt);
        console.log(`- lastActiveAt:`, memberData.lastActiveAt?.toDate?.()?.toISOString() || memberData.lastActiveAt);
        console.log(`- lastReadAt:`, memberData.lastReadAt?.toDate?.()?.toISOString() || memberData.lastReadAt);
        console.log(`- kickThreshold:`, memberData.kickThreshold);
    }

    // 4. Run standard Inactivity status check logic
    const mockMemberData = memberDoc.exists ? memberDoc.data()! : {};
    const result = calculateMemberStatus(userId, mockMemberData, groupData, new Date());
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 【自動退室シミュレーション結果】');
    console.log(`👤 ユーザー: ${userData.nickname}`);
    console.log(`🏢 グループ: ${groupData.name}`);
    console.log(`⏰ ステータス: ${result.status.toUpperCase()}`);
    console.log(`⏰ 最後のアクティブ日時: ${new Date(result.lastActiveTime).toLocaleString()}`);
    console.log(`⏰ 現在の経過日数: ${(result.diffMs / (24 * 60 * 60 * 1000)).toFixed(2)} 日`);
    console.log(`⏰ 退室しきい値日数: ${result.thresholdMs / (24 * 60 * 60 * 1000)} 日`);
    console.log(`📝 判定理由 (Reason): ${result.reason}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

diagnose().catch(console.error);
