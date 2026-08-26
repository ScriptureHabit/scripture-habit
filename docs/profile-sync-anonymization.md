# User Profile Sync & Reaction Anonymization

This document details how profile updates (nickname, avatar) are synchronized to group chats and how personal data is anonymized upon account deletion.

---

## 1. Architecture Overview (`ProfileService`)

The serverless `ProfileService` (`api_internal/services/profile-service.ts`) handles two main workflows:

```mermaid
sequenceDiagram
    autonumber
    actor User as User Client
    participant API as Profile API
    participant PS as ProfileService
    participant DB as Firestore Database

    rect rgb(240, 248, 255)
        Note over User,DB: Scenario A: User Updates Profile (Nickname/Avatar)
        User->>API: Update Profile
        API->>PS: syncProfileToChats()
        PS->>DB: Update active group member previews & recent chat messages
    end

    rect rgb(255, 240, 245)
        Note over User,DB: Scenario B: User Deletes Account
        User->>API: Delete Account
        API->>PS: purgeSocialIdentity()
        PS->>DB: Anonymize reaction previews in chat logs (replace with '...' and '')
    end
```

---

## 2. Profile Sync to Group Chats

Updating every historic message across all past groups would cause massive database write volumes. The sync engine balances performance and accuracy:

1. **Targeted Scan Horizon**: Scans recent active messages (up to 500 messages per group).
2. **Reaction Preview Updates**: Updates cached sender nicknames and avatars stored in `reactionPreviews`.
3. **Batching Safeguards**: Commits Firestore writes in chunks of 450 (well within Firestore's 500-write limit).

---

## 3. Account Deletion & Social Identity Anonymization

When an account is deleted, personal identifiable data must be removed, but deleting messages or reaction entries entirely would disrupt conversation context.

To solve this, the service **anonymizes reaction metadata**:

```
[Before Account Deletion]
  Reaction: { uid: "user_123", nickname: "Jane Doe", photoURL: "https://..." }
        │
        ▼ (Account Deletion Triggered)
[After Account Deletion]
  Reaction: { uid: "user_123", nickname: "...", photoURL: "" }
```

- **Personal Data Stripped**: The nickname becomes `"..."` and the avatar URL is emptied.
- **Chat Continuity Preserved**: Total reaction counts and message flows remain intact for other members.

---

## 4. Related Documentation

- [Group Chat Architecture & Implementation](./groupchat-construction-guide.md)
- [Database & Security](./database-security.md)
