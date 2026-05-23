# Firestore Offline Persistence & Multi-Tab Synchronization

This document describes how the application implements high-performance offline capabilities, resolves offline transactional conflicts across multiple active browser tabs, handles restricted browser sandboxes, and optimizes sessions for automated testing.

---

## 1. Offline Persistence & Multi-Tab Caching Strategy

For an application that encourages daily scripture study habits, the user experience must remain responsive even during unstable network connectivity (e.g., during transit).

### Architecture Overview
The application initializes Firestore using the native IndexedDB persistent local cache, configuring a dedicated tab manager:

```typescript
db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
```

```
     ┌────────────────────────────────────────────────────────┐
     │                       Client App                       │
     │  Tab 1 (Active Chat)            Tab 2 (Dashboard Screen)│
     └──────────┬────────────────────────────────┬────────────┘
                │                                │
                ▼                                ▼
     ┌────────────────────────────────────────────────────────┐
     │      persistentMultipleTabManager (Shared Lock)        │
     │      Coordinated access, synchronizes mutations        │
     └──────────────────────────┬─────────────────────────────┘
                                ▼
     ┌────────────────────────────────────────────────────────┐
     │                 IndexedDB Local Cache                  │
     │      Holds cached documents, offline writes queue       │
     └──────────────────────────┬─────────────────────────────┘
                                ▼
                   [ Remote Firestore Sync ]
```

### How Multi-Tab Synchronization Works:
1. **Shared Database Lock**: Under normal Single-Tab caches, opening a second browser window blocks access to IndexedDB, causing the second tab to fall back to a slower, non-cached memory store.
2. **`persistentMultipleTabManager`**: Enables multiple browser tabs or web view windows to share a single IndexedDB local store. One tab acts as the primary coordinator, writing local changes to IndexedDB and synchronizing mutations instantly across all other active windows.
3. **Offline Queue Sync**: If a user updates their notes while completely offline, mutations are placed in a localized queue inside IndexedDB. Once network connectivity is restored, the primary active tab synchronizes the queued changes with the cloud database.

---

## 2. Robust Sandbox Fallback Engine (Private Browsing Safeguard)

In restrictive browser sandboxes—such as **iOS Safari Private Browsing** or environments where third-party IndexedDB storage is strictly blocked—attempting to open IndexedDB will throw a critical security exception, crashing the entire web application.

To solve this, the initialization is guarded by a robust fallback structure in `src/firebase.ts`:

```typescript
let db: Firestore;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (e) {
  console.error("Firestore initialization with persistence failed, falling back to default:", e);
  db = getFirestore(app); // Fallback to standard memory caching
}
```

### Behavior:
* **Success**: If IndexedDB is allowed, the app gains high-performance, offline-resilient operations.
* **Fallback**: If IndexedDB throws an access error, the catch block intercepts the exception, falling back gracefully to standard memory caching (`getFirestore(app)`). The application continues to function normally without crashing, though modifications are not persisted offline once the browser tab is closed.

---

## 3. E2E Playwright Automation Session Optimizations

During automated E2E testing (via Playwright or Vitest integration runners), headless browsers boot up inside blank environments. By default, Firebase Auth might utilize session-only memory persistence or face race conditions, requiring tests to log in repeatedly, which slows down testing pipelines.

To maximize stability and testing speeds, the initialization detects automated runner profiles:

```typescript
// E2E Test Optimization: Force LocalStorage persistence so Playwright can capture it
if (typeof window !== 'undefined' && navigator.webdriver && auth) {
  window.firebaseAuth = auth;
  setPersistence(auth, browserLocalPersistence).catch(err => {
    console.error("Failed to set auth persistence:", err);
  });
}
```

### Mechanisms:
1. **Automation Attestation Check**: Inspects `navigator.webdriver`. This standard browser property is only `true` when the browser is actively controlled by an automated testing framework (like Playwright).
2. **Explicit Persistence Locking**: If detected, the client overrides default authentication settings to enforce `browserLocalPersistence` (`LocalStorage`). This guarantees that login credentials survive page reloads and cross-test execution steps.
3. **Global Debug Binding**: Binds the active authenticated auth instance directly to `window.firebaseAuth`. This allows Playwright automation scripts to interactively check authentication tokens, inject test credentials, or verify session limits directly from the testing script.
