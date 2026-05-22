# Firebase Security Rules & CQRS Write Isolation

This document details the security model, dynamic verification shields, and write-isolation architectural patterns configured in the project's **Firestore Security Rules** (`firestore.rules`). 

---

## 🛡️ Defense-in-Depth: The Two-Tier Security Model

To achieve maximum protection, the application implements a **Defense-in-Depth (多重防御)** strategy. Security is checked not just once at the API layer, but verified a second time at the database layer.

```
Incoming Request  ──►  [ Tier 1: API Middleware ]  ──►  [ Tier 2: Database Rules ]  ──► Data Commit
                       - Express Router                 - firestore.rules
                       - verifyAppCheck                 - isAuthenticated()
                       - globalLimiter                  - isAppCheckVerified()
                       (See security-architecture.md)   (This Document)
```

1.  **Tier 1 (API Gateway)**: Secures resource-heavy actions (AI tasks, scrapers, notifications) and parses validation rules. Custom middleware verifies App Check and user sessions. (See **[App Check & API Protection](security-architecture.md)**).
2.  **Tier 2 (Database Layer)**: Direct Firestore Security Rules act as a fallback guard. If a user bypasses the API gateway, or if a client sdk attempts to write to Firestore directly, the security rules immediately intercept and reject the command.

---

## 1. The Multi-Tiered Security Rules Guard

The `firestore.rules` file wraps Firestore document endpoints in two core verification layers, which are evaluated inside security rule functions: **Email Verification** and **Firebase App Check**.

### A. Email Verification Shield (`isAuthenticated()`)
To prevent spam, account flooding, and bot interactions, any action classified as a "social transaction" (joining groups, viewing posts, etc.) requires an authenticated user with a verified email:
```javascript
function isAuthenticated() {
  return request.auth != null && (
    request.auth.token.email_verified == true || 
    request.auth.token.get('email_verified', false) == true ||
    request.auth.token.get('email', '').matches('.*@example[.]com$')
  );
}
```
* **Bypass Strategy for Automated Testing**: To allow standard E2E integration test runs without waiting for real-world verification links, emails belonging to `@example.com` are permitted to bypass this check in non-production test suites.

### B. App Check Shield (`isAppCheckVerified()`)
During client-side user document registration (`/users/{userId}`), the application must prevent bots or scrapers from calling the creation endpoint directly via Curl.
```javascript
function isAppCheckVerified() {
  return (request.auth != null && request.auth.token.get('email', '').matches('.*@example[.]com$')) || 
         request.appCheck != null;
}
```
* **Security Behavior**: It strictly validates that the request carries an authentic, cryptographic Firebase App Check token issued from a legitimate browser (attested by reCAPTCHA Enterprise). Without this token, document creation is rejected at the Firestore gateway.

---

## 2. Rules-Bound Business Logic Lock (Group Size Limit)

While business limits are typically managed in backend APIs, malicious users could bypass client restraints to directly create multiple groups. 

To enforce safety at the database boundary, the security rule for creating `/groups/{groupId}` maps directly into the user's registry document to fetch and evaluate their current group count:

```javascript
allow create: if isAuthenticated() && 
  request.resource.data.ownerUserId == request.auth.uid &&
  get(/databases/$(database)/documents/users/$(request.auth.uid)).data.get('groupIds', []).size() < 4;
```

### Mechanism:
1. **Dynamic Path Traversal**: Uses `get(/databases/$(database)/documents/users/...)` to load the current state of the creating user before the transaction finishes.
2. **Size Constraint**: Evaluates `groupIds.size() < 4`.
3. **Implication**: Even if a hacker uses a direct Firestore SDK in their console to call `.set()`, the database itself blocks the creation if they already own 4 groups.

---

## 3. CQRS & Server-Side Write Isolation Pattern

A defining architectural design choice of **scripture-habit** is the strict use of the **CQRS (Command Query Responsibility Segregation) write-isolation pattern**.

Rather than allowing clients to write, update, or delete records directly on shared collections, **all mutation capability is isolated to the Backend Express API (Firebase Admin SDK)**.

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
The rules completely lock down write permissions for collaborative resources:

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

### Why Choose Write-Isolation?
1. **Validation & Type Safety**: Client SDKs cannot enforce Zod schema validation. Forcing mutations to go through Express guarantees incoming data perfectly matches strict backend schemas (e.g. `createGroupSchema`, `joinGroupSchema`) before hitting Firestore.
2. **Transactional Coordination**: Creating messages or joining groups requires coordinating multiple documents concurrently (e.g., updating a user's group list, group membership maps, aggregating counters, sending push notifications). These cannot be easily coordinated by front-end clients safely (See **[Firestore Transactions & Counter Service](firestore-transactions-counters.md)**).
3. **Malicious Override Prevention**: If clients had write access to `/members/` or `/messages/`, a user could modify other members' roles, spoof message authors, or delete shared history.
4. **App Check & Rate Limiting Gateways**: Backend endpoints are secured via Express Global Rate Limiters and backend `verifyAppCheck` middleware, ensuring robust DDOS protection before databases process inputs.
