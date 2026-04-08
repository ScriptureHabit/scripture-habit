# Database & Security: The Foundation

**scripture-habit** uses Google Cloud Firestore as its primary database. We follow a "Centralized Write" pattern where most data mutations occur via a backend API to ensure strict business logic and security.

---

## 📂 Collection Structure

### 1. `users` (User Profiles & Personal Data)
- **Document ID**: Firebase UID.
- **`groupStates/{groupId}` (Subcollection)**: Tracks unread counts and read markers for the user in each group.
- **`notes` (Subcollection)**: Personal study notes, synced from group posts.
- **`private/tokens`**: Sensitive FCM tokens for push notifications.

### 2. `groups` (Social Hubs)
- **Metadata**: Name, description, `memberCount`, `lastMessageAt`, `targetScripture`.
- **`members` (Array of UIDs)**: Used for fast membership queries.
- **`members/{userId}` (Subcollection)**: Detailed individual stats within the group (total points, activity time).
- **`messages` (Subcollection)**: The chat history, including notes, images, and system messages.

### 3. `translation_cache`
- Used by the AI translation subsystem to avoid redundant Gemini calls.
- **ID**: MD5 hash of `text + targetLanguage`.

---

## 🛡️ Security Rules (`firestore.rules`)

We implement a multi-layered security model to prevent unauthorized access and data tampering.

### A. Authentication Guards
- **`isAuthenticated()`**: Ensures the user is logged in. In production, we also verify that their email is verified for social features.
- **`isAppCheckVerified()`**: **Mandatory for all writes.** This ensures requests only come from our official web or mobile application.

### B. Path-Based Permissions
- **Groups**: Users can only `get` or `list` groups if they are a member or if the group is marked as `isPublic`.
- **Messages**: Users can only read messages in groups where they are an active member (`isMemberOfGroup(groupId)`).

### C. "API-Only Write" Policy
To maintain data integrity (like streaks and counters), almost all collections have `allow write: if false;`. 
- **The Backend (Admin SDK)**: Bypasses these rules to perform atomic updates within transactions.
- **Exception**: Individual users can update their own `groupStates` (for local read-count feedback) and their FCM tokens in the `private` subcollection.

---

## 💎 Data Integrity & Normalization

### Zod-Based Converters (`src/utils/firestoreConverters.ts`)
Before any data reaches the React components, it passes through a `FirestoreDataConverter` that:
1.  **Validates**: Ensures the data matches the expected Zod schema.
2.  **Normalizes**: Converts legacy data formats or missing fields into safe defaults.
3.  **Parses IDs**: Automatically maps the Firestore document ID to an `id` or `uid` field in the object.

### The "Truth" vs. "Cache"
- **The Truth**: Stored in the database and updated via API.
- **The UI State**: Derived from `onSnapshot` listeners, providing an "optimistic-like" experience because Firestore's local cache reflects changes nearly instantly after the server receives them.
