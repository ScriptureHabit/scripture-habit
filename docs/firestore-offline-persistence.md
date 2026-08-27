# Firestore Offline Persistence

This document details client-side IndexedDB caching, multi-tab synchronization, private browsing fallbacks, and conflict resolution strategies.

---

## 1. Offline Caching & Multi-Tab Synchronization

To support uninterrupted scripture study during commutes or connectivity drops, Firestore caches data locally in IndexedDB:

```typescript
db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
```

```
┌────────────────────────────────────────────────────────┐
│                      Client App                        │
│     Tab 1 (Active Chat)          Tab 2 (Dashboard)     │
└────────────┬───────────────────────────────┬───────────┘
             │                               │
             ▼                               ▼
┌────────────────────────────────────────────────────────┐
│         persistentMultipleTabManager (Shared Lock)     │
│       Coordinating access and mutation syncing         │
└────────────────────────────┬───────────────────────────┘
                             ▼
┌────────────────────────────────────────────────────────┐
│                 IndexedDB Local Cache                  │
│    Document cache and offline write mutation queue     │
└────────────────────────────┬───────────────────────────┘
                             ▼
                 [ Firestore Cloud Sync ]
```

- **Multi-Tab Coordination (`persistentMultipleTabManager`)**:
  Allows multiple tabs and WebViews to share the same IndexedDB store safely without locking conflicts.
- **Offline Mutation Queue**:
  Writes made offline are queued locally and automatically committed to Cloud Firestore once connectivity is restored.

---

## 2. Private Browsing & Fallback Strategies

To prevent startup crashes in environments where IndexedDB is blocked (e.g. iOS Safari Private Browsing):

```typescript
let db: Firestore;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (e) {
  console.warn("IndexedDB not available, falling back to memory cache:", e);
  db = getFirestore(app); // Safe fallback to in-memory caching
}
```

---

## 3. Offline Conflict Resolution & Safeguards

- **Personal Notes & Settings**:
  Stored within dedicated user subcollections (`users/{uid}/notes`), eliminating multi-user edit collisions.
- **Transaction Gating**:
  Operations requiring server-side validation (such as joining a group with a 5-member cap) are cleanly blocked when offline, prompting the user to reconnect.
- **Optimistic UI for Messages**:
  New chat messages are assigned temporary IDs (`tempId`) for instant rendering, cleanly resolved once the backend commits the record.

---

## 4. Related Documentation

- [Architecture Overview](./architecture.md)
- [Network & Performance Optimization](./network-performance-optimization.md)
- [Chat & Dashboard Synchronization](./feature-chat-dashboard.md)
