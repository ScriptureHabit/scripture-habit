# Group Invitation & Membership Join Pipeline

This document explains the group invitation and joining process. It ensures database consistency, prevents brute-force attempts on invite codes, and supports localized previews.

---

## 🏗️ Pipeline Overview

The join pipeline validates requests using rate-limiting, authentication status, and Firestore transactional writes:

```mermaid
sequenceDiagram
    autonumber
    participant UI as Client UI (Join Modal)
    participant Rate as express-rate-limit (inviteLimiter)
    participant Auth as requireEmailVerified Middleware
    participant API as Backend API (/join-group)
    participant DB as Firestore Transaction

    UI->>Rate: POST /api/groups/join-group (Invite Code / Group ID)
    alt Rate Limit Exceeded
        Rate-->>UI: HTTP 429 Too Many Requests
    else Allowed
        Rate->>Auth: Verify Auth Context & Email Verification Status
        alt Email unverified (Password sign-in)
            Auth-->>UI: HTTP 403 Forbidden
        else Verified
            Auth->>API: Execute Join Group Handler
            API->>DB: Start Transaction
            DB->>DB: Enforce Read-Before-Write
            DB->>DB: Fetch Group Document, User Document & Message Counter
            
            alt Validation Fails (Full group, expired link, or invalid code)
                DB-->>API: Throw Validation Error
                API-->>UI: HTTP 400 Bad Request
            else Valid Join
                DB->>DB: Write 1: Update Group Document (members, memberPreviews)
                DB->>DB: Write 2: Create Group Member Document (members subcollection)
                DB->>DB: Write 3: Create User Group State Document (groupStates subcollection)
                DB->>DB: Write 4: Update User Document (arrayUnion groupIds)
                DB->>DB: Write 5: Write System Welcome Message Document
                DB->>Counter: Write 6: Atomically Increment messageCount Counter
                DB-->>API: Commit Transaction
                API-->>UI: HTTP 200 Success + Redirect to Group
            end
        end
    end
```

---

## 🔒 Invite Code Security

Invite codes grant access to private groups, so we protect them using these rules:

### 1. Easy-to-Read Codes
To prevent user errors (like confusing `O` and `0` or `I` and `1`), invite codes use a 32-character alphabet:
`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
-   **Length**: 6 characters.
-   **Combinations**: Over 1 billion unique codes.

### 2. Uniqueness Checks
When creating a group or regenerating a link, the system generates a random code and queries Firestore inside a transaction. If the code is already in use, it tries a new one (up to 10 attempts).

### 3. Expiration Dates
-   **Default Expiration**: 7 days.
-   **Storage**: Stored as a Firestore timestamp in `inviteCodeExpiresAt`.
-   **Validation**: The join transaction rejects the request if `expiresAt < new Date()`.

### 4. Rate Limiting (`inviteLimiter`)
To prevent automated brute-force scans:
-   **Window**: 60 Minutes.
-   **Production Limit**: Max 15 join attempts per hour.
-   **Development Limit**: 1000 attempts per hour to support testing.

---

## 📡 Backend API Endpoints (`api_internal/routes/groups.ts`)

### 1. Group Preview (`GET /api/groups/group-preview/:inviteCode`)
Shows the Group Name, Description, and Member count in a preview card before the user joins.

*   **Public Access**: This endpoint is public (unauthenticated) so users can preview a group before logging in.
*   **Expiration Checks**: Returns `HTTP 410 Gone` if the invite code has expired.
*   **Localization**: Reads `req.query.language` to return translated group descriptions from `groupData.translations[lang]`.

### 2. Regenerate Code (`POST /api/groups/regenerate-invite-code`)
Allows the group owner to invalidate the current code and generate a new one.

*   **Owner Guard**: Verifies that the caller's UID matches `ownerUserId` on the group document.
*   **Immediate Effect**: Overwriting the old code instantly blocks anyone trying to use it.

---

## 🤝 Concurrency-Safe Group Joining

To prevent database race conditions (like exceeding group capacity during simultaneous joins), joining a group runs inside a Firestore transaction:

### 1. Strict Validation
-   **Capacity Limit**: Rejects if the group size exceeds `maxMembers` (default 500).
-   **Group Limit**: Rejects if the user has reached `MAX_GROUPS_PER_USER`.
-   **Duplicate Guard**: Checks if the user is already in the group's `members` list.
-   **Email Check**: Rejects if the user has not verified their email address.

### 2. Transaction Writes
These writes occur atomically to ensure data consistency:

1.  **Group Updates**: Appends the user's UID to `members`, increments `membersCount`, and updates `memberPreviews` (limited to the 15 most recent members).
2.  **Member Subcollection**: Creates `/groups/{groupId}/members/{uid}` to store joined timestamps and user settings.
3.  **User State**: Creates `/users/{uid}/groupStates/{groupId}` to track the user's read message index for unread badges.
4.  **User Profile**: Adds the `groupId` to the user's `groupIds` array.
5.  **Welcome Message**: Creates a system message: `✨ **${nickname}** joined the group! Welcome!`.
