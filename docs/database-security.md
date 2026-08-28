# Database & Security Architecture

This document defines the data architecture, Entity-Relationship (ER) model, collection hierarchy, and privacy boundaries for Cloud Firestore in Scripture Habit.

---

## 1. Entity-Relationship (ER) Model

Entity-Relationship model and collection schema for Cloud Firestore:

```mermaid
flowchart TD
    classDef main fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef sub fill:#0f172a,stroke:#94a3b8,stroke-width:1.5px,color:#e2e8f0;
    classDef social fill:#1e1b4b,stroke:#a855f7,stroke-width:2px,color:#f8fafc;

    subgraph UserSpace["[User Domain] users/{uid}"]
        USERS["<b>USERS</b> (Parent Document)<br/>──────────────────────<br/>• uid (PK: string)<br/>• email, nickname, photoURL, bio<br/>• stake, ward, language, timeZone<br/>• streakCount, highestStreak<br/>• daysStudiedCount, totalNotes<br/>• studiedDates: string[]<br/>• groupIds: string[] (joined group IDs)<br/>• groupId: string (active group ID)<br/>• kickThreshold: number (inactivity days)<br/>• hasFcmToken: boolean (denormalized)<br/>• hasCompletedOnboarding: boolean<br/>• lastPostAt, createdAt: timestamp"]:::main

        NOTES["<b>NOTES</b> (Subcollection: notes)<br/>──────────────────────<br/>• id (PK: string / UUID)<br/>• userId (FK: string)<br/>• scripture, chapter, title, speaker<br/>• comment, text (composite search string)<br/>• shareOption (all/current/specific/none)<br/>• sharedWithGroups: string[]<br/>• sharedMessageIds: map<br/>• searchTokens: string[] (prefix search)<br/>• createdAt, editedAt: timestamp"]:::sub

        GROUP_STATES["<b>GROUP_STATES</b> (Subcollection: groupStates)<br/>──────────────────────<br/>• groupId (PK: string)<br/>• readMessageCount: number<br/>• lastReadAt, lastActiveAt: timestamp<br/>• updatedAt: timestamp"]:::sub

        PRIVATE_TOKENS["<b>PRIVATE_TOKENS</b> (Subcollection: private)<br/>──────────────────────<br/>• docId: tokens (fixed)<br/>• fcmTokens: string[] (sensitive push tokens)<br/>• updatedAt: timestamp"]:::sub

        LETTERS["<b>LETTERS</b> (Subcollection: letters)<br/>──────────────────────<br/>• id (PK: string)<br/>• title, content (AI recap / welcome)<br/>• type: developer_welcome | weekly_reflection<br/>• read: boolean, createdAt: timestamp"]:::sub
    end

    subgraph GroupSpace["[Group Domain] groups/{groupId}"]
        GROUPS["<b>GROUPS</b> (Parent Document)<br/>──────────────────────<br/>• groupId (PK: string)<br/>• name (100 chars), description, ownerUserId (FK)<br/>• members: string[] (member UIDs / max 5)<br/>• membersCount: number, maxMembers: 5 (fixed)<br/>• isPrivate: boolean, isAiGroup: boolean, isDemoGroup: boolean<br/>• inviteCode, inviteCodeExpiresAt, previousInviteCodes[]<br/>• dailyActivity: { date, activeMembers[] }<br/>• memberPreviews: MemberPreview[] (denormalized)<br/>• memberLastActive, memberKickThresholds: map<br/>• timeZone, lastMessageAt, lastMessageText<br/>• createdAt: timestamp"]:::main

        MESSAGES["<b>MESSAGES</b> (Subcollection: messages)<br/>──────────────────────<br/>• id (PK: string)<br/>• groupId (FK), senderId (FK), senderNickname, senderPhotoURL<br/>• text, messageType (text/studyNote/userJoined etc.)<br/>• isNote: boolean, scripture, chapter, originalNoteId (FK)<br/>• replyTo: map, reactions: map, reactionPreviews: map<br/>• translations: map (i18n cached translations)<br/>• createdAt: timestamp<br/>• expireAt: timestamp (TTL: 30 days retention)"]:::sub

        MEMBERS["<b>MEMBERS</b> (Subcollection: members)<br/>──────────────────────<br/>• userId (PK: string)<br/>• nickname, photoURL, status (active/idle/kicked)<br/>• readMessageCount: number<br/>• lastActive, lastReadAt, joinedAt: timestamp<br/>• kickThreshold: number"]:::sub

        MESSAGES_LATEST["<b>MESSAGES_LATEST</b> (Subcollection: messages_latest)<br/>──────────────────────<br/>• docId: latest (fixed)<br/>• messages: Message[] (cached 5 recent snapshots)"]:::sub
    end

    subgraph SocialSpace["[Social & Moderation Domain]"]
        CHEERS["<b>CHEERS</b> (Root Collection: cheers)<br/>──────────────────────<br/>• cheerId (PK: string)<br/>• senderUid (FK), targetUid (FK)<br/>• groupId (FK), createdAt: timestamp"]:::social

        REPORTS["<b>REPORTS</b> (Root Collection: reports)<br/>──────────────────────<br/>• reportId (PK: string)<br/>• messageId (FK), reporterId (FK), reportedUserId (FK)<br/>• reason: string, createdAt: timestamp"]:::social
    end

    USERS -->|1 : N owns| NOTES
    USERS -->|1 : N tracks| GROUP_STATES
    USERS -->|1 : 1 isolates| PRIVATE_TOKENS
    USERS -->|1 : N receives| LETTERS
    USERS -.->|N : M joins / groupIds| GROUPS

    GROUPS -->|1 : N contains| MESSAGES
    GROUPS -->|1 : N manages| MEMBERS
    GROUPS -->|1 : 1 previews| MESSAGES_LATEST

    USERS -.->|sends cheer| CHEERS
    USERS -.->|files report| REPORTS
```

---

## 2. Firestore Hierarchical Path Layout

```mermaid
graph TD
    Root["Firestore Root"]

    Root --> Users["users / collection"]
    Root --> Groups["groups / collection"]
    Root --> Cheers["cheers / collection"]
    Root --> Reports["reports / collection"]

    Users --> UserDoc["{uid} / document"]
    Groups --> GroupDoc["{groupId} / document"]

    UserDoc --> Private["private / tokens (sensitive FCM push tokens)"]
    UserDoc --> Notes["notes / {noteId} (personal study notes)"]
    UserDoc --> GroupStates["groupStates / {groupId} (per-group read counts)"]
    UserDoc --> Letters["letters / {letterId} (AI recap & reflection letters)"]

    GroupDoc --> Messages["messages / {messageId} (active chat messages)"]
    GroupDoc --> MessagesLatest["messages_latest / latest (cached 5 most recent messages)"]
    GroupDoc --> Members["members / {uid} (member status & activity)"]
```

---

## 3. Schema Design & Denormalization

1. **Groups Collection (`groups/{groupId}`)**:
   - Stores `memberPreviews` (nicknames and avatars) directly in the parent document to render dashboard cards without extra reads.
   - Stores `dailyActivity` (list of today's active poster UIDs) to calculate group completion instantly without querying chat logs.
2. **Users Collection (`users/{uid}`)**:
   - Mirrors active `groupIds` array on the user document for single-query membership lookups.

---

## 4. Automated Chat Retention (Firestore Native TTL)

To prevent unbounded document growth and keep real-time listeners lightweight, messages are written with an `expireAt` timestamp (30 days from creation).
Cloud Firestore's **Time-to-Live (TTL)** engine automatically deletes expired message documents in the background.

---

## 5. Private Token Isolation

Sensitive tokens (e.g. FCM push tokens) are isolated in the `users/{uid}/private/tokens` subcollection.
Firestore Security Rules ensure only the authenticated user (`request.auth.uid == uid`) and backend Admin SDK can access these credentials.

---

## 6. Related Documentation

- [Firebase Security Rules](./firebase-security-rules.md)
- [Firestore Transactions & Counters](./firestore-transactions-counters.md)
- [Architecture Overview](./architecture.md)
