# Database & Security Architecture

This document defines the Cloud Firestore data architecture, Entity-Relationship (ER) model, collection hierarchy, denormalization strategies, and privacy isolation boundaries in Scripture Habit.

---

## 1. Entity-Relationship (ER) Model

The structural relationship between primary Firestore collections and subcollections:

```mermaid
flowchart TD
    classDef main fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef sub fill:#0f172a,stroke:#94a3b8,stroke-width:1.5px,color:#e2e8f0;
    classDef social fill:#1e1b4b,stroke:#a855f7,stroke-width:2px,color:#f8fafc;

    subgraph UserDomain["1. User Domain users/{uid}"]
        USERS["<b>USERS</b> (Parent Document)<br/>PK: uid / Profile, study metrics & groups"]:::main

        NOTES["<b>NOTES</b><br/>PK: id<br/>Personal study notes"]:::sub
        GROUP_STATES["<b>GROUP_STATES</b><br/>PK: groupId<br/>Per-group read markers"]:::sub
        PRIVATE_TOKENS["<b>PRIVATE_TOKENS</b><br/>PK: tokens<br/>Sensitive FCM tokens"]:::sub
        LETTERS["<b>LETTERS</b><br/>PK: id<br/>AI reflection letters"]:::sub

        USERS -->|1:N owns| NOTES
        USERS -->|1:N tracks| GROUP_STATES
        USERS -->|1:1 isolates| PRIVATE_TOKENS
        USERS -->|1:N receives| LETTERS
    end

    subgraph GroupDomain["2. Group Domain groups/{groupId}"]
        GROUPS["<b>GROUPS</b> (Parent Document)<br/>PK: groupId / Max 5 members & Unity score"]:::main

        MESSAGES["<b>MESSAGES</b><br/>PK: id<br/>Chat stream (TTL 30-day)"]:::sub
        MEMBERS["<b>MEMBERS</b><br/>PK: uid<br/>Member progress records"]:::sub
        MESSAGES_LATEST["<b>MESSAGES_LATEST</b><br/>PK: latest<br/>5-message aggregated cache"]:::sub

        GROUPS -->|1:N contains| MESSAGES
        GROUPS -->|1:N manages| MEMBERS
        GROUPS -->|1:1 caches| MESSAGES_LATEST
    end

    subgraph SocialDomain["3. Social & Moderation Domain (Root Collections)"]
        CHEERS["<b>CHEERS</b> cheers/{cheerId}<br/>PK: cheerId / Peer cheers"]:::social
        REPORTS["<b>REPORTS</b> reports/{reportId}<br/>PK: reportId / Safety reports"]:::social
    end

    USERS ===>|N:M joins groupIds| GROUPS
    GROUPS ~~~ CHEERS
    GROUPS ~~~ REPORTS
    USERS -.->|sends cheer| CHEERS
    USERS -.->|files report| REPORTS
```

### ER Model Breakdown

1. **User Domain (`users/{uid}`)**  
   Encapsulates personal profile attributes and study metrics. Subcollections partition personal study notes (`notes`), per-group read markers (`groupStates`), AI-generated reflections (`letters`), and device notification tokens (`private/tokens`) into clear ownership scopes.

2. **Group Domain (`groups/{groupId}`)**  
   Maintains micro-circles capped at 5 members. The parent document coordinates metadata and Unity scores, while subcollections house the message stream (`messages`), membership states (`members`), and preview cache aggregates (`messages_latest`).

3. **Social & Moderation Domain (`cheers`, `reports`)**  
   Cross-cutting events such as peer encouragements and moderation reports reside in independent root collections to decouple operational lifecycles from user documents.

---

## 2. Collection Schema Specifications

### 2.1 User Domain (`/users/{uid}`)

| Collection / Path | Primary Fields | Type | Description & Constraints |
| :--- | :--- | :--- | :--- |
| **`users/{uid}`**<br>(Parent Document) | `uid` (PK)<br>`nickname`<br>`email`<br>`photoURL`<br>`bio`<br>`stake` / `ward`<br>`language`<br>`timeZone`<br>`streakCount`<br>`highestStreak`<br>`daysStudiedCount`<br>`totalNotes`<br>`studiedDates`<br>`groupIds`<br>`groupId`<br>`kickThreshold`<br>`hasFcmToken`<br>`hasCompletedOnboarding`<br>`lastPostAt`<br>`createdAt` | string<br>string<br>string<br>string<br>string<br>string<br>string<br>string<br>number<br>number<br>number<br>number<br>string[]<br>string[]<br>string<br>number<br>boolean<br>boolean<br>timestamp<br>timestamp | Firebase Auth UID<br>Display nickname (max 50 chars)<br>Account email address<br>Profile avatar image URL<br>Biography (max 500 chars)<br>Church stake and ward names<br>UI language code (`en`, `ja`, `es`, etc.)<br>User operational timezone (IANA format)<br>Current active study streak in days<br>All-time highest streak record<br>Cumulative days studied count<br>Total study notes created count<br>List of studied dates (YYYY-MM-DD)<br>Joined group ID array (max 4 groups)<br>Currently selected active group ID<br>Inactivity auto-kick threshold (1-30 days)<br>Denormalized flag for rapid FCM eligibility checks<br>Onboarding completion flag<br>Timestamp of last note creation<br>Account creation timestamp |
| **`users/{uid}/notes/{noteId}`**<br>(Subcollection) | `id` (PK)<br>`userId` (FK)<br>`scripture`<br>`chapter`<br>`title` / `speaker`<br>`comment`<br>`text`<br>`shareOption`<br>`sharedWithGroups`<br>`sharedMessageIds`<br>`searchTokens`<br>`createdAt`<br>`editedAt` | string<br>string<br>string<br>string<br>string<br>string<br>string<br>enum<br>string[]<br>map<br>string[]<br>timestamp<br>timestamp | Note UUID<br>Author User UID<br>Scripture category (`Book of Mormon`, `New Testament`, etc.)<br>Chapter reference (e.g., `1 Nephi 1:1`)<br>General Conference / Talk title & Speaker<br>Personal study reflections<br>Composite text for full-text token search<br>Sharing scope (`all`, `current`, `specific`, `none`)<br>Target group IDs where note is published<br>Map of `groupId -> messageId`<br>Prefix search token array<br>Creation timestamp<br>Last edited timestamp |
| **`users/{uid}/groupStates/{groupId}`**<br>(Subcollection) | `groupId` (PK)<br>`readMessageCount`<br>`lastReadAt`<br>`lastActiveAt`<br>`updatedAt` | string<br>number<br>timestamp<br>timestamp<br>timestamp | Target Group ID<br>Read message count (for unread badge calculation)<br>Timestamp of last read message<br>Timestamp of last active interaction in group<br>State update timestamp |
| **`users/{uid}/private/tokens`**<br>(Private Subcollection) | `docId` (PK: `'tokens'`)<br>`fcmTokens`<br>`updatedAt` | string<br>string[]<br>timestamp | Fixed document ID<br>Array of active FCM push notification tokens<br>Last token synchronization timestamp |
| **`users/{uid}/letters/{letterId}`**<br>(Subcollection) | `id` (PK)<br>`title`<br>`content`<br>`type`<br>`read`<br>`createdAt` | string<br>string<br>string<br>string<br>boolean<br>timestamp | Letter Document ID<br>Letter subject/title<br>AI reflection letter or developer welcome body<br>`developer_welcome` or `weekly_reflection`<br>Read status flag<br>Generation timestamp |

---

### 2.2 Group Domain (`/groups/{groupId}`)

| Collection / Path | Primary Fields | Type | Description & Constraints |
| :--- | :--- | :--- | :--- |
| **`groups/{groupId}`**<br>(Parent Document) | `groupId` (PK)<br>`name`<br>`description`<br>`ownerUserId` (FK)<br>`members`<br>`membersCount`<br>`maxMembers`<br>`isPrivate`<br>`isAiGroup`<br>`isDemoGroup`<br>`inviteCode`<br>`inviteCodeExpiresAt`<br>`previousInviteCodes`<br>`dailyActivity`<br>`memberPreviews`<br>`memberLastActive`<br>`memberLastReadAt`<br>`memberKickThresholds`<br>`timeZone`<br>`lastMessageAt`<br>`lastMessageText`<br>`createdAt` | string<br>string<br>string<br>string<br>string[]<br>number<br>number<br>boolean<br>boolean<br>boolean<br>string<br>timestamp<br>string[]<br>map<br>array<br>map<br>map<br>map<br>string<br>timestamp<br>string<br>timestamp | Group Document ID (auto-generated)<br>Group name (max 100 chars)<br>Group description (max 1000 chars)<br>Creator User UID<br>Array of member UIDs (max 5)<br>Current member count<br>Capacity limit (fixed at 5)<br>Private group visibility flag<br>AI companion presence flag<br>Demo sandbox flag<br>6-character invite code<br>Invite code expiration date (null = permanent)<br>History of previous valid invite codes<br>Today's active poster records `{ date: 'YYYY-MM-DD', activeMembers: [] }`<br>Denormalized previews (`memberPreviews: MemberPreview[]`)<br>Last active timestamp per member (`UID -> timestamp`)<br>Last read timestamp per member (`UID -> timestamp`)<br>Inactivity threshold per member (`UID -> number`)<br>Group operational timezone<br>Timestamp of latest message<br>Preview text snippet of latest message<br>Group creation timestamp |
| **`groups/{groupId}/messages/{messageId}`**<br>(Subcollection) | `id` (PK)<br>`groupId` (FK)<br>`senderId` (FK)<br>`senderNickname`<br>`senderPhotoURL`<br>`text`<br>`messageType`<br>`isNote`<br>`scripture`<br>`chapter`<br>`originalNoteId` (FK)<br>`replyTo`<br>`reactions`<br>`reactionPreviews`<br>`translations`<br>`createdAt`<br>`expireAt` | string<br>string<br>string<br>string<br>string<br>string<br>enum<br>boolean<br>string<br>string<br>string<br>map<br>map<br>map<br>map<br>timestamp<br>timestamp | Message Document ID<br>Parent Group ID<br>Sender User UID<br>Sender display name<br>Sender avatar URL<br>Message text body (max 2000 chars)<br>`text`, `studyNote`, `userJoined`, `unityAnnouncement` etc.<br>Synchronized note flag<br>Scripture category (when note)<br>Chapter reference (when note)<br>Original User Note ID (when note)<br>Quoted reply metadata<br>Emoji reaction map (`emoji -> string[]`)<br>Reaction avatar previews map<br>Multilingual translation cache (`lang -> text`)<br>Post timestamp<br>**Firestore TTL auto-expiration timestamp (30 days from creation)** |
| **`groups/{groupId}/members/{uid}`**<br>(Subcollection) | `userId` (PK)<br>`nickname`<br>`photoURL`<br>`status`<br>`readMessageCount`<br>`lastActive`<br>`lastReadAt`<br>`joinedAt`<br>`kickThreshold` | string<br>string<br>string<br>enum<br>number<br>timestamp<br>timestamp<br>timestamp<br>number | Member User UID<br>Denormalized display name<br>Denormalized avatar URL<br>`active`, `idle`, `kicked`<br>Read message count<br>Last action timestamp<br>Last read timestamp<br>Join timestamp<br>Personal kick threshold in days |
| **`groups/{groupId}/messages_latest/latest`**<br>(Subcollection) | `docId` (PK: `'latest'`)<br>`messages` | string<br>Message[] | Fixed document ID<br>Array of 5 most recent message snapshots (Strategy B instant preview cache) |

---

### 2.3 Social & Moderation Domain (Root Collections)

| Collection / Path | Primary Fields | Type | Description & Constraints |
| :--- | :--- | :--- | :--- |
| **`cheers/{cheerId}`** | `cheerId` (PK)<br>`senderUid` (FK)<br>`targetUid` (FK)<br>`groupId` (FK)<br>`createdAt` | string<br>string<br>string<br>string<br>timestamp | Cheer event ID<br>Sender User UID<br>Target receiver User UID<br>Associated Group ID<br>Sent timestamp |
| **`reports/{reportId}`** | `reportId` (PK)<br>`messageId` (FK)<br>`reporterId` (FK)<br>`reportedUserId` (FK)<br>`reason`<br>`createdAt` | string<br>string<br>string<br>string<br>string<br>timestamp | Report ID<br>Reported message ID<br>Reporter User UID<br>Reported User UID<br>Report reason (max 1000 chars)<br>Report submission timestamp |

---

## 3. Firestore Hierarchical Path Layout

Hierarchical mapping of root collections, parent documents, and subcollections:

```mermaid
flowchart LR
    classDef root fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef col fill:#1e293b,stroke:#818cf8,stroke-width:1.5px,color:#f8fafc;
    classDef doc fill:#1e1b4b,stroke:#c084fc,stroke-width:1.5px,color:#f8fafc;
    classDef sub fill:#0f172a,stroke:#94a3b8,stroke-width:1px,color:#e2e8f0;

    Root["🔥 Firestore Root"]:::root

    Root --> UsersCol["users (collection)"]:::col
    UsersCol --> UserDoc["{uid} (document)"]:::doc
    UserDoc --> Notes["notes / {noteId} (study notes)"]:::sub
    UserDoc --> GroupStates["groupStates / {groupId} (read markers)"]:::sub
    UserDoc --> Private["private / tokens (sensitive FCM tokens)"]:::sub
    UserDoc --> Letters["letters / {letterId} (AI reflection letters)"]:::sub

    Root --> GroupsCol["groups (collection)"]:::col
    GroupsCol --> GroupDoc["{groupId} (document)"]:::doc
    GroupDoc --> Messages["messages / {messageId} (chat log)"]:::sub
    GroupDoc --> MessagesLatest["messages_latest / latest (cached 5 msgs)"]:::sub
    GroupDoc --> Members["members / {uid} (member progress)"]:::sub

    Root --> CheersCol["cheers / {cheerId} (social cheers)"]:::sub
    Root --> ReportsCol["reports / {reportId} (safety reports)"]:::sub
```

### Hierarchical Path Breakdown

1. **User Subcollection Nesting**  
   Consolidating personal data under `users/{uid}` simplifies Security Rules to `request.auth.uid == uid`, preventing cross-tenant access at the structural level.

2. **Group Scoping & Cache Separation**  
   Nesting `messages` under `groups/{groupId}` ensures live listeners are constrained to group members, while isolating `messages_latest/latest` minimizes document read volume during initial dashboard rendering.

---

## 4. Schema Design & Denormalization

1. **Groups Collection (`groups/{groupId}`)**:
   - `memberPreviews`: Embeds nicknames and avatars directly in the parent document to render dashboard cards without auxiliary queries.
   - `dailyActivity`: Embeds today's active poster UIDs to compute Unity scores in $O(1)$ time without scanning chat history.
2. **Users Collection (`users/{uid}`)**:
   - Maintains an array of joined `groupIds` on the parent document for single-query membership lookups.

---

## 5. Automated Chat Retention (Firestore Native TTL)

To prevent unbounded storage growth and keep real-time listeners lightweight, messages are written with an `expireAt` timestamp (30 days from creation).
Cloud Firestore's **Time-to-Live (TTL)** engine automatically removes expired documents in the background.

---

## 6. Private Token Isolation

Sensitive tokens (e.g., FCM push tokens) reside strictly within the `users/{uid}/private/tokens` subcollection.
Firestore Security Rules enforce that only the authenticated owner (`request.auth.uid == uid`) and backend Admin SDK can access these credentials.

---

## 7. Related Documentation

- [Firebase Security Rules](./firebase-security-rules.md)
- [Firestore Transactions & Counters](./firestore-transactions-counters.md)
- [Architecture Overview](./architecture.md)
