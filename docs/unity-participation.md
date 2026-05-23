# Unity Participation & Sync Architecture

This document describes the design, math, data syncing models, and edge-case resolution strategy for **Unity (団結度)**—the metric representing a reading group's shared daily completion status.

---

## 1. Core Concept

The Unity metric encourages group solidarity by calculating the percentage of eligible members who have posted their scripture study notes for the current day. 

Instead of relying purely on a scheduled backend aggregation, the application integrates both **Server-side historical state** and **Client-side real-time mutations** to render an instantaneous, lag-free metric.

```
       ┌───────────────────────────────┐
       │   Group Document (Firestore)  │
       │   - dailyActivity.activeMembers│
       └──────────────┬────────────────┘
                      │
                      │ (Server Base)
                      ▼
            [ getUnityParticipation() ] ◄─── (Client Augmentation) ─── [ Real-time Chat Messages ]
                      │
                      ├──────────────────────────┐
                      ▼                          ▼
            [ Apply Eligibility Rules ]    [ Check Timezone / Date Alignment ]
                      │
                      ▼
            [ Final Unity Percentage ]
```

---

## 2. Dynamic Synchronization (Dual Data Sources)

To provide an instant feedback loop when a user posts a note, `getUnityParticipation` aggregates active poster IDs from two separate data channels:

### Source A: Server-Side Snapshot (`dailyActivity`)
* **Location**: Loaded from the root `/groups/{groupId}` document.
* **Property**: `group.dailyActivity` containing `{ activeMembers: string[], date: string }`.
* **Behavior**: This is the official database record of who has posted for the date. It is updated transactionally whenever a note is submitted.

### Source B: Client-Side Augmentation (`Message[]`)
* **Location**: Fetched dynamically inside the active Group Chat window.
* **Behavior**: If a user is active in the chat and someone posts a note, a new message document lands in the client state before the group document's static aggregation propagates.
* **Reconciliation**: The client scans these local real-time chat messages. If a message is marked `isNote: true`, has a valid timestamp, and the date matches today in the group's timezone, the sender's UID is added to the posters set, bypassing Firestore replication latency.

---

## 3. The Eligibility Logic (Edge-Case Resolution)

Calculating a fair percentage requires strict rules around who *must* post. Without safety checks, a new user joining a group at 11:59 PM would immediately drop the entire group's daily Unity percentage to a lower bracket.

### Denominator Eligibility
The core rule is:
> **Members who joined today are excluded from the daily requirement (denominator) UNLESS they have already posted a note.**

If they have already posted today, they are treated as eligible and added to both the denominator and numerator, instantly boosting the score. If they haven't posted yet, they do not penalize the group.

```mermaid
flowchart TD
    Start([Evaluate Member UID]) --> IsPoster{Did they post today?}
    IsPoster -- Yes --> Eligible([Eligible & Posted])
    
    IsPoster -- No --> HasJoinedTs{Is joinedAt TS available?}
    HasJoinedTs -- No --> DefaultEligible([Eligible by default])
    
    HasJoinedTs -- Yes --> CompareDates{Is joinedAt < today?}
    CompareDates -- Yes (Joined prior) --> DefaultEligible
    CompareDates -- No (Joined today) --> Ineligible([Excluded/Not Eligible])
```

### Triple-Fallback `joinedAt` Resolver
To apply this rule, the application needs the exact time the member joined the group. Because member records exist in different structures depending on which view is rendered (Sidebar, Group Chat, Profile), the algorithm uses a robust **three-tier fallback chain**:

1. **Primary**: `group.memberJoinedAt[uid]`
   * The global joined-at map stored directly on the group metadata document.
2. **Secondary**: `membersMap[uid].joinedAt`
   * The localized map populated in the Group Chat view which resolves individual member metadata.
3. **Tertiary**: `group.myMemberStatus.joinedAt` (only for current user)
   * The personal member status object parsed in the Sidebar context for lightweight client-side checks.

If no registration time can be found after exhausting the three tiers, the member defaults to **Eligible** to avoid logic failures.

---

## 4. Timezone & Date Normalization

Because groups can span multiple countries, calculations are locked to the **group's specified timezone** (`group.timeZone` falling back to `UTC`).

1. **Date Parsing**: Timestamps are parsed into epoch milliseconds and converted into a localized string (`YYYY-MM-DD`) matching the group's timezone via `formatDateInTimeZone()`.
2. **Lexicographical Comparison**:
   * Joining date is normalized to a comparable string representation.
   * A member is eligible if `normalizedJoinedDate < normalizedTodayDate`.
3. **Empty Base Cases**: If no members are eligible to post (e.g., in a group composed entirely of new members who joined today and have not yet posted), the algorithm gracefully returns **100% Unity** rather than division-by-zero or an empty metric.

---

## 5. Implementation Reference

The core logic is structured in `src/utils/unity-utils.ts`:

```typescript
export const getUnityParticipation = (
  group: Group | null,
  messages: Message[] = [],
  referenceDate: Date = new Date(),
  membersMap?: MembersMap
): UnityParticipation => {
  // ... Core checks & dual source loading ...
  
  const eligibleMembers = uniqueMemberIds.filter(uid => {
    const isPoster = uniquePosters.has(uid);
    if (isPoster) return true; // Posted today -> count
    
    // Triple fallback resolver
    let joinedTs = memberJoinedAt[uid] || membersMap?.[uid]?.joinedAt || group.myMemberStatus?.joinedAt;
    if (!joinedTs) return true; // default fallback

    const joinedDateStr = formatDateInTimeZone(new Date(parseTimestampToMillis(joinedTs)), groupTimeZone);
    
    // Compare lexicographically: must have joined before today
    return normalizeDateString(joinedDateStr) < normalizeDateString(todayStr);
  });

  const postedMembers = eligibleMembers.filter(uid => uniquePosters.has(uid));
  
  if (eligibleMembers.length === 0) return { ..., percentage: 100 };
  
  const percentage = Math.round((postedMembers.length / eligibleMembers.length) * 100);
  return { eligibleMembers, postedMembers, notPostedMembers, percentage };
};
```
