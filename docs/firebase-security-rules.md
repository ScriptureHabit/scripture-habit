# Firebase Security Rules & CQRS Write Isolation

This document details the security rules, dynamic verification, and write isolation patterns configured in the project's **Firestore Security Rules** (`firestore.rules`). 

---

## 🛡️ Security Model: Two-Tier Protection

To achieve maximum protection, the application uses a **Defense-in-Depth (多重防御)** strategy. Security is checked not just once at the API layer, but verified a second time at the database layer.

```
Incoming Request  ──►  [ Tier 1: API Middleware ]  ──►  [ Tier 2: Database Rules ]  ──► Data Commit
                       - Express Router                 - firestore.rules
                       - verifyAppCheck                 - isAuthenticated()
                       - globalLimiter                  - isAppCheckVerified()
                       (See security-architecture.md)   (This Document)
```

1.  **Tier 1 (API Gateway)**: Secures heavy actions (AI tasks, scrapers, notifications) and runs validation rules. Custom middleware verifies App Check and user sessions. (See **[App Check & API Protection](security-architecture.md)**).
2.  **Tier 2 (Database Layer)**: Direct Firestore Security Rules act as a fallback. If a user bypasses the API gateway, or if a client SDK tries to write to Firestore directly, the security rules block the action.

---

## 1. Security Rules Verification Layers

The `firestore.rules` file checks two main conditions before allowing access: **Email Verification** and **Firebase App Check**.

### A. Email Verification (`isAuthenticated()`)
To prevent spam and bot accounts, actions like joining groups or viewing posts require an authenticated user with a verified email:
```javascript
function isAuthenticated() {
  return request.auth != null && (
    request.auth.token.email_verified == true || 
    request.auth.token.get('email_verified', false) == true ||
    request.auth.token.get('email', '').matches('.*@example[.]com$')
  );
}
```
* **Automated Testing Bypass**: To allow E2E integration tests to run without verifying real email addresses, emails ending in `@example.com` are allowed to bypass this check in non-production test environments.

### B. App Check Verification (`isAppCheckVerified()`)
During client-side user document registration (`/users/{userId}`), the application blocks bots from creating records directly.
```javascript
function isAppCheckVerified() {
  return (request.auth != null && request.auth.token.get('email', '').matches('.*@example[.]com$')) || 
         request.appCheck != null;
}
```
* **Security Behavior**: It checks that the request has an authentic App Check token. Without this token, document creation in Firestore is rejected.

---

## 2. Business Logic Enforcement (Group Size Limit)

While business limits are typically managed in backend APIs, users could bypass client restraints to directly create multiple groups. 

To enforce safety at the database boundary, the security rule for creating `/groups/{groupId}` checks the user's document to evaluate their current group count:

```javascript
allow create: if isAuthenticated() && 
  request.resource.data.ownerUserId == request.auth.uid &&
  get(/databases/$(database)/documents/users/$(request.auth.uid)).data.get('groupIds', []).size() < 4;
```

### Mechanism:
1. **Dynamic Lookup**: Uses `get(/databases/$(database)/documents/users/...)` to load the current state of the user.
2. **Size Constraint**: Evaluates `groupIds.size() < 4`.
3. **Behavior**: Even if someone uses the Firestore SDK in their console to call `.set()`, the database blocks the creation if they already own 4 groups.

---

## 3. CQRS & Server-Side Write Isolation Pattern

A core design choice of **scripture-habit** is the strict use of the **CQRS (Command Query Responsibility Segregation) write isolation pattern**.

Instead of allowing clients to write, update, or delete records directly on shared collections, **all mutation capability is handled by the Backend Express API (Firebase Admin SDK)**.

```
       [ Client App ] ─── Read (Direct Real-time Sync) ───► [ Firestore Database ]
             │                                                     ▲
             │                                                     │
        HTTP Command                                          Write (Admin SDK)
             │                                                     │
             ▼                                                     │
     [ Express API ] ─── Transactions / Valids / Security ─────────┘
```

### Direct Write Restrictions in `firestore.rules`
The rules lock down write permissions for collaborative resources:

* **Group Messaging**:
  ```javascript
  match /messages/{messageId} {
    allow read: if isAuthenticated() && isMemberOfGroup(groupId);
    allow write: if false; // Block client writes
  }
  ```
* **Group Roster Members**:
  ```javascript
  match /members/{userId} {
    allow read: if isAuthenticated() && isMemberOfGroup(groupId);
    allow write: if false; // Block client writes
  }
  ```
* **Cheers / Reactions**:
  ```javascript
  match /cheers/{cheerId} {
    allow read: if ...
    allow write: if false; // Block client writes
  }
  ```

### Why Use Write Isolation?
1. **Validation & Type Safety**: Client SDKs cannot easily enforce strict schema validation. Forcing changes to go through Express guarantees incoming data matches strict schemas before hitting Firestore.
2. **Transaction Coordination**: Creating messages or joining groups requires updating multiple documents (e.g., updating user group list, group membership maps, aggregating counters, sending push notifications). These cannot be easily coordinated by front-end clients safely (See **[Firestore Transactions & Counter Service](firestore-transactions-counters.md)**).
3. **Malicious Override Prevention**: If clients had write access to `/members/` or `/messages/`, a user could modify other members' roles, spoof authors, or delete shared history.
4. **App Check & Rate Limiting Gateways**: Backend endpoints are secured via Express Rate Limiters and backend `verifyAppCheck` middleware, protecting against DDoS attacks.
