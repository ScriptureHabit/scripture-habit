# Database & Schema Architecture

This document defines the data architecture, entity-relationship models, schema plans, and database patterns used to maintain a stable backend for **scripture-habit**.

---

## 📂 Entity-Relationship (ER) Model

Our data model is hierarchical, balancing the need for real-time synchronization with long-term data storage.

```mermaid
erDiagram
    USERS ||--o{ NOTES : "personal copies"
    USERS ||--o{ GROUP_STATES : "read markers"
    USERS ||--o{ PRIVATE_TOKENS : "sensitive fcm"
    USERS ||--o{ LETTERS : "encouragement letters"
    
    GROUPS ||--o{ MESSAGES : "active chat"
    GROUPS ||--o{ MESSAGE_BUCKETS : "archived history"
    GROUPS ||--o{ MEMBERS_STATS : "individual progress"
    
    USERS }|--o{ GROUPS : "many-to-many (membership)"
    
    USERS ||--o{ CHEERS : "social cheers"
    USERS ||--o{ REPORTS : "abuse reports"
    
    USERS {
        string uid PK
        string nickname
        int streakCount
        int totalNotes
    }
    
    GROUPS {
        string groupId PK
        string ownerUserId FK
        string[] members
        int membersCount
        timestamp lastMessageAt
        boolean isPublic
    }
    
    MESSAGES {
        string id PK
        string text
        string senderId FK
        timestamp createdAt
        boolean isNote
    }
    
    LETTERS {
        string letterId PK
        string text
        timestamp createdAt
        string type
    }
    
    CHEERS {
        string cheerId PK
        string senderUid FK
        string targetUid FK
        timestamp createdAt
    }
    
    REPORTS {
        string reportId PK
        string reporterId FK
        string targetId
        string reason
        timestamp createdAt
    }
```

---

## 🗺️ Schema Plan & Denormalization

### 1. `groups`
* **Denormalization Strategy**: We store `memberPreviews` (nickname/photo) and `lastMessageAt` directly on the root group document. This allows the client dashboard to show active groups instantly without secondary document requests.
* **Activity Tracking**: `dailyActivity` stores a list of active user IDs to calculate group activity without querying the entire message collection.

### 2. `users` (Profile Sync)
* **Shared ID**: The document ID matches the Firebase Auth UID to prevent synchronization issues.
* **Redundancy**: `groupIds` (array) is stored on the user document to allow fast searches when displaying the user's active groups.

### 3. Subcollections (Data Isolation)
* **`/messages`**: Optimized for lightweight, real-time message updates.
* **`/members`**: Stores per-group member statistics (study points, individual progress) that are too large to fit in the main group document.

---

> [!IMPORTANT]
> ### 🛡️ Security Rules & Write Permissions
> Details about verification rules (`isAuthenticated()`, `isAppCheckVerified()`), membership lookups, and backend-only write validation policies are documented in **[Firebase Security Rules & Write Isolation](firebase-security-rules.md)**.
> All client updates and transaction routines are described in **[Firestore Transactions & Counter Service Design](firestore-transactions-counters.md)**.

---

## 📦 Chat Archiving (The Bucket Pattern)

To avoid Firestore's document-size limits (1MB per document) and keep real-time client syncs lightweight, the application uses the **Bucket Pattern** for chat history.

```
       [ Client Chat Listener ] ─── Subscribed to ───► [ groups/{id}/messages ] (Active Space)
                                                                 │
                                                    (Automated Cron Sweeps)
                                                                 ▼
                                                [ groups/{id}/message_buckets/{bucketId} ]
                                                        (Archived Cold Storage)
```

### Mechanisms:
* **Active Collection**: Active messages are stored in `/messages` and kept small.
* **Archiving Cron**: A cron job (`ArchiveService` triggered daily) moves messages older than 30 days into a bucketed subcollection `/message_buckets/{bucketId}`.
* **Bandwidth Savings**: The active chat listener remains lightweight, ensuring that client sync does not consume excessive mobile data or memory.

---

## 🔐 Private Data Isolation

Sensitive user credentials and setup tokens are kept separate from general queries:
`users/{uid}/private/tokens`

* **Access Rules**: Access to this subcollection is restricted at the database level. Neither group members nor group owners can view these documents. Only the Admin SDK and the owning user can read or write tokens.
