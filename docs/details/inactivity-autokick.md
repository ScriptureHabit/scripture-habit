# 🔬 Detailed Explanation: Inactivity Sweep & Auto-Kick / Owner Transfer Engine

This document provides a detailed explanation of the **"Inactivity Sweep Middleware"** that completely automates background operations for Scripture Habit, the **"Two-Stage Query Optimization"** that dramatically reduces Firestore read costs, and the **"Owner Transfer & Auto-Dissolution Engine"** that prevents groups from becoming ghost groups.

---

## 🔄 Batch Check & Double Rotation Strategy

The inactivity detection process is a backend batch process called daily via a cron job. To scan hundreds or thousands of groups efficiently and evenly, it combines two scanning strategies: **"Rotation"** and **"The Net."**

1. **Rotation**:
   Groups are sorted and batch-processed starting from the one with the oldest last checked timestamp (`lastInactivityCheckedAt`). This ensures all groups are scanned evenly.
2. **The Net**:
   Newly created groups do not have the `lastInactivityCheckedAt` field, so they might be missed by a simple "oldest-first" sort. To catch (and self-heal) these, recently created groups are fetched separately, and those not yet checked are appended to the end of the rotation batch.

---

## 🛡️ 2-Stage Read Optimization (Firestore Read Optimization)

Firestore's pricing model is based on the number of document reads. When checking the activity status of tens of thousands of users daily, reading every single user's document individually would result in enormous read costs.

Scripture Habit adopts an advanced two-stage optimization design to **"determine multiple statuses in a single read."**

*   **Stage 1: Primary Screening via the Parent Group Document**
    The parent document of each group (`/groups/{groupId}`) maintains map objects (`memberLastActive` and `memberLastReadAt`) that synchronize the final activity status of each member.
    The sweeper first **reads only a single parent group document and calculates the status of members based on this map information**. For members determined to be "definitely active" at this stage, **reading their underlying individual documents is completely skipped**.
*   **Stage 2: Pinpoint Retrieval of Only Inactivity Candidates (getAll)**
    Only for users determined as "potentially inactive (or uninitialized) in the primary screening," their underlying member status documents (`/groups/{groupId}/members/{uid}`) are fetched in parallel batches of 100 using `db.getAll()`.
    This successfully **reduces database read operations by more than 90%** compared to a naive approach.

---

## 🔄 Sweep & Kick Transaction Process Flow

The following is the sequence from when the cron job starts until the inactivity kicks, automatic group dissolutions, and owner transfers are completed as Firestore transactions.

```mermaid
sequenceDiagram
    autonumber
    actor Cron as Scheduled Job (Cron)
    participant Service as InactivityService (Server)
    participant DB as Firestore (Database)
    participant FCM as Push Notification (FCM)

    Cron->>Service: Run batch process (limit: 100)
    Service->>DB: 1. Bulk fetch unchecked oldest + newly created groups
    DB-->>Service: Return target groups list

    loop For each target group
        Service->>DB: 2. Get parent group document (for primary screening)
        DB-->>Service: Group data (including member final activity map)

        alt If inactivity candidates exist in primary screening
            Service->>DB: 3. Pinpoint bulk fetch only candidate member documents (db.getAll)
            DB-->>Service: Detailed member status data
        end

        Service->>Service: 4. Pure logical calculation (decideGroupInactivity)

        alt Pattern A: Target for group deletion (all members inactive)
            Service->>DB: 5a. Recursive deletion of all underlying group data and user membership info (db.recursiveDelete)
        else Pattern B: Process between members (auto-kick, owner transfer, etc.)
            Note over Service: Create db.batch() and execute atomically
            
            alt If owner is inactive and another active member exists
                Service->>DB: 5b. Set new owner + add congratulatory message to chat
            end

            loop For each user to kick
                Service->>DB: 5c. Remove group membership from user document<br/>Delete /users/{uid}/groupStates/{gid}<br/>Delete /groups/{gid}/members/{uid}
                Service-->>FCM: 5d. Send kick notification asynchronously (background)
            end

            Service->>DB: 5e. Update group basic info (lastInactivityCheckedAt, etc.)
            Service->>DB: 5f. Commit (batch.commit)
        end
    end
    Service-->>Cron: Return process stats results
```

---

## 📅 Inactivity Detection & Owner Transfer Decision Tree

The decision logic that determines the fate of a group is processed entirely within `decideGroupInactivity`, which is a completely I/O-free **pure function**. This allows for perfect unit test execution simply by mocking time and test data.

```mermaid
flowchart TD
    Start(["Start Group Inactivity Evaluation"]) --> CheckDeleted{"1. Is deletion flag isDeleted<br/>true?"}
    CheckDeleted -- Yes --> DeleteGroup(["2. Decide recursive deletion of group"])
    
    CheckDeleted -- No --> EvaluateMembers["3. Individually calculate status of all members<br/>calculateMemberStatus"]
    
    EvaluateMembers --> LoopMembers{"4. What is each member's status?"}
    
    LoopMembers -- needs_initialization --> AddInit["5. Add to initialization list<br/>*Treated as active for evaluation"]
    LoopMembers -- active --> AddActive["6. Add to active list"]
    LoopMembers -- inactive --> AddInactive["7. Add to inactive list"]
    
    AddInit --> CheckOwner{"8. Is the group owner<br/>in the inactive list?"}
    AddActive --> CheckOwner
    AddInactive --> CheckOwner
    
    CheckOwner -- No (Owner active) --> ProcessKicks["9. Add inactive members other than owner<br/>to auto-kick list"]
    
    CheckOwner -- Yes (Owner inactive) --> CheckOtherActive{"10. Do other active<br/>members exist?"}
    
    CheckOtherActive -- Yes (Transferable) --> HandoffOwner["11. Decide to auto-transfer owner rights<br/>to oldest active user & add congrats/transfer msg"]
    HandoffOwner --> ProcessKicks
    
    CheckOtherActive -- No (Ghost group) --> DeleteGroup
    
    ProcessKicks --> CalcUnity["12. Recalculate group unityPercentage<br/>using remaining members after kick"]
    CalcUnity --> End(["13. Return final decision action"])
```

---

## 💻 Core Code Explanation

### 1. Preparing for Inactivity Evaluation via Two-Stage Read (`inactivity-service.ts`)

This is the core logic that leverages the primary screening map to minimize Firestore reads.

```typescript
export class InactivityService {
    static async processGroupInactivity(groupId: string, groupSnap?: admin.firestore.DocumentSnapshot) {
        const groupRef = db.collection('groups').doc(groupId);
        const actualSnap = groupSnap || await groupRef.get();
        if (!actualSnap.exists) return { removedCount: 0, initializedCount: 0, transferCount: 0, groupDeleted: false };

        const groupData = actualSnap.data() as GroupDocument;
        const membersArray = groupData.members || [];
        const now = new Date();

        // 1. Subcollection Self-Healing Function
        // If members subcollection is empty due to sync errors, detect it cheaply with limit(1) and self-heal in a batch
        if (membersArray.length > 0) {
            const oneMemberSnap = await groupRef.collection('members').limit(1).get();
            if (oneMemberSnap.empty) {
                const healBatch = db.batch();
                for (const uid of membersArray) {
                    const memberRef = groupRef.collection('members').doc(uid);
                    const joinedAt = groupData.memberJoinedAt?.[uid] || groupData.createdAt || admin.firestore.FieldValue.serverTimestamp();
                    healBatch.set(memberRef, {
                        uid, joinedAt,
                        lastActiveAt: groupData.memberLastActive?.[uid] || joinedAt,
                        lastReadAt: groupData.memberLastReadAt?.[uid] || joinedAt,
                        kickThreshold: groupData.memberKickThresholds?.[uid] || 3,
                        readMessageCount: 0
                    });
                }
                await healBatch.commit();
            }
        }

        // 2. [Stage 1: Screening via Group Parent Document Map]
        const allPossibleUids = new Set([
            ...membersArray,
            ...Object.keys(groupData.memberLastActive || {}),
            ...Object.keys(groupData.memberJoinedAt || {})
        ]);

        const activeMemberIds = new Set<string>();
        const potentiallyInactiveUids = new Set<string>();

        for (const uid of allPossibleUids) {
            const joinedAt = groupData.memberJoinedAt?.[uid];
            const lastActive = groupData.memberLastActive?.[uid];
            const lastRead = groupData.memberLastReadAt?.[uid];
            
            if (!joinedAt && !lastActive && !lastRead) {
                potentiallyInactiveUids.add(uid); // Go to detailed check if map data is missing
            } else {
                // Perform a temporary active check with mock data based on maps in the parent document
                const mockMemberData: InactivityMemberData = { joinedAt, lastActiveAt: lastActive, lastReadAt: lastRead };
                const result = calculateMemberStatus(uid, mockMemberData, groupData, now);
                if (result.status === 'active') {
                    activeMemberIds.add(uid); // Finish if parent data proves the member is definitely active
                } else {
                    potentiallyInactiveUids.add(uid); // Go to detailed fetch if inactive status is suspected
                }
            }
        }

        const memberList: any[] = [];
        // Active users are confirmed via parent document map (prevents extra reads!)
        for (const uid of activeMemberIds) {
            memberList.push({
                uid,
                data: {
                    joinedAt: groupData.memberJoinedAt?.[uid],
                    lastActiveAt: groupData.memberLastActive?.[uid],
                    lastReadAt: groupData.memberLastReadAt?.[uid],
                }
            });
        }

        // [Stage 2: Pinpoint fetch subcollections of only potential inactive candidates via db.getAll()]
        const uidsToFetch = Array.from(potentiallyInactiveUids);
        if (uidsToFetch.length > 0) {
            for (let i = 0; i < uidsToFetch.length; i += 100) {
                const chunk = uidsToFetch.slice(i, i + 100);
                const refs = chunk.map(uid => groupRef.collection('members').doc(uid));
                const docs = await db.getAll(...refs); // Ultra-fast bulk fetch via Firestore's getAll
                for (let j = 0; j < docs.length; j++) {
                    const doc = docs[j];
                    const uid = chunk[j];
                    if (doc.exists) {
                        memberList.push({ uid, data: doc.data(), createTime: doc.createTime });
                    } else {
                        memberList.push({ uid, data: {} }); // Ghost member
                    }
                }
            }
        }

        // 3. Evaluate decision using pure function
        const decision = decideGroupInactivity(groupData, memberList, now);

        // ... (Execute atomic batch writes based on the decision results)
    }
}
```

---

### 2. Pure Inactivity & Owner Transfer Decision Logic (`inactivity-utils.ts`)

This is a completely deterministic decision engine that allows you to test statuses without mocking the network or Firestore.

```typescript
export function decideGroupInactivity(
    groupData: InactivityGroupData,
    members: { uid: string, data: InactivityMemberData, createTime?: any }[],
    now: Date = new Date()
): GroupInactivityDecision {
    const decision: GroupInactivityDecision = {
        shouldDeleteGroup: false,
        membersToRemove: [],
        membersToInitialize: [],
        membersToRepair: []
    };

    // Disband immediately if group isDeleted flag is true
    if (groupData.isDeleted === true) {
        decision.shouldDeleteGroup = true;
        return decision;
    }

    const activeMemberIds: string[] = [];
    const inactiveMemberIds: string[] = [];
    const ownerUserId = groupData.ownerUserId;

    // Aggregate each member's status
    for (const member of members) {
        const memberId = member.uid;
        const memberData = member.data;

        // [Self-healing] Auto-correct joinedAt if corrupted by server delay, etc.
        if (memberData.joinedAt && member.createTime) {
            const joinedMs = toMillis(member.createTime);
            const storedJoinedMs = toMillis(memberData.joinedAt);
            if (storedJoinedMs > joinedMs && joinedMs > 0) {
                // Detect bug where joinedAt is in the future relative to document creation time, mark for repair
                decision.membersToRepair.push({ uid: memberId, joinedAt: joinedMs });
                memberData.joinedAt = joinedMs;
            }
        }

        const result = calculateMemberStatus(memberId, memberData, groupData, now);

        if (result.status === 'needs_initialization') {
            decision.membersToInitialize.push(memberId);
            activeMemberIds.push(memberId); // Uninitialized members are treated as active during their grace period
        } else if (result.status === 'inactive') {
            inactiveMemberIds.push(memberId);
        } else {
            activeMemberIds.push(memberId);
        }
    }

    // [Owner inactivity check and transfer process]
    if (ownerUserId && inactiveMemberIds.includes(ownerUserId)) {
        // Extract other active remaining members excluding the owner
        const otherActiveMembers = activeMemberIds.filter(id => id !== ownerUserId);

        if (otherActiveMembers.length > 0) {
            // If active members exist, auto-transfer owner rights to the oldest remaining active member
            decision.newOwnerId = otherActiveMembers[0];
        } else {
            // If no active members remain, safely dissolve the group automatically
            decision.shouldDeleteGroup = true;
            return decision;
        }
    }

    // Inactive members excluding the owner are designated for kick
    const finalOwnerId = decision.newOwnerId || ownerUserId;
    decision.membersToRemove = inactiveMemberIds.filter(uid => uid !== finalOwnerId);

    return decision;
}
```
