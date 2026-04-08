# Maintenance & Batch Jobs: The "Self-Healing" App

To ensure the long-term health and performance of the platform, **scripture-habit** utilizes a series of automated background jobs (Cron) that handle user churn, data pruning, and statistical synchronization.

---

## 🏃 Inactivity Check: The Core Algorithm

The most important maintenance task is the **Inactivity Check** (`/api/check-inactive-users`), which prevents groups from becoming "graveyards" of inactive profiles.

### 1. Rotation Scanning
The system uses a **Rotation-based Scanning** pattern to minimize database load:
- It fetches 100 groups sorted by `lastInactivityCheckedAt` (oldest first).
- It also uses a "Stale Net" to catch new groups that don't have the field yet.
- This ensures every group is checked at least once every few days.

### 2. Activity Multi-Marker
A user is declared inactive only if **all** of these markers exceed the `kickThreshold` (default 3 days):
- `lastNoteAt`: Last time they posted a study note.
- `lastPostAt`: Last time they sent any message.
- `joinedAt`: The date they joined the group (grace period for new members).

### 3. "Ghost Buster" Cleanup
To maintain strict data integrity, when a user is kicked:
- The user's membership in the `groups` collection is removed.
- Their personal `groupIds` array is updated.
- Their `groupStates` record in the `users` subcollection is deleted to free up space.
- Legacy/corrupted member documents without `joinedAt` are auto-initialized to prevent infinite loops.

---

## 👑 Ownership Transfer: The Succession Plan

Groups are never left without a leader. If a Group Owner becomes inactive:
1.  **Selection**: The system identifies all active members.
2.  **Promotion**: The member with the highest activity or seniority is promoted to "Owner."
3.  **Group Deletion**: If *zero* active members remain, the system assumes the group is abandoned and invokes `recursiveDelete()` to clean up all subcollections (messages, stats, etc.).

---

## 📦 Data Pruning: The Bucket Strategy

Chat history can grow indefinitely. We use a **Message Archiving** task (`/api/archive-old-messages`) to manage this:
- **Bucket Pattern**: Messages older than 30 days are moved from the primary `messages` subcollection to `message_buckets`.
- **Reasoning**: This keeps the active chat listener (`onSnapshot`) fast and cheap, as it doesn't have to scan thousands of historical documents.

---

## 📊 Counter Synchronization: The "Shard Hum"

We use denormalized counters (`messageCount`, `noteCount`) for performance. However, these can occasionally "drift" due to race conditions.
- **Aggregation**: Incremental changes are aggregated into the main document.
- **The Recount (Absolute Truth)**: For groups that haven't been active in 24 hours, the system performs a physical document count to ensure the synced stats match the actual number of documents in Firestore.

---

## 🚦 Security Rules & Automation
The Cron system is protected by a `CRON_SECRET` Bearer token. This ensures that only authorized automated services (like Vercel Cron or GitHub Actions) can trigger these expensive maintenance operations.
