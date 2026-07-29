# Firestore Offline Persistence

This document explains how the app handles offline data, synchronizes data across multiple browser tabs, provides fallbacks for restricted browsers, and configures authentication for automated testing.

---

## 1. Offline Caching and Multi-Tab Sync

To support offline usage (such as when commuting), the app caches data locally so it remains responsive without network connection.

### Architecture Overview
The application initializes Firestore using the IndexedDB persistent local cache and configures a multiple tab manager:

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

### 1.1 How Multi-Tab Sync Works
1. **Avoid Database Locking**: Standard single-tab persistence blocks IndexedDB when a second tab is opened, forcing the new tab to use slow memory caching.
2. **Shared Access**: The `persistentMultipleTabManager` allows multiple tabs or WebViews to share the same IndexedDB store. One tab coordinates writing changes to IndexedDB and updates the other tabs.
3. **Offline Sync Queue**: When offline, any changes are stored in an offline queue. Once the network is restored, the active tab automatically uploads the changes to Firestore.

### 1.2 Web Locks API Dependency and Fallback Behavior
Firebase SDK's multiple tab manager internally leverages the browser's **Web Locks API** to manage reader/writer locks across tabs. In older browsers (e.g., Safari on iOS < 15.3) or restricted WebViews where this API is unavailable, the SDK automatically switches to:
* **Read-Only Mode Fallback**: If Web Locks API is unsupported, secondary tabs (tabs opened after the primary one) will be restricted from writing to the IndexedDB cache and will function in read-only mode to prevent data corruption.
* **Full Memory Cache Fallback**: In private browsing environments where IndexedDB itself is disabled, the initialization fails and safely triggers our try-catch block (Section 2) to fall back to the default memory-only cache (`getFirestore(app)`).


---

## 2. Private Browsing Fallback

In private browsing modes (like iOS Safari Private Browsing) or restricted environments, IndexedDB access might be blocked. Attempting to initialize it can throw an error and crash the app.

To prevent crashes, we wrap the Firestore initialization in a try-catch block in `src/firebase.ts`:

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

### 2.1 Fallback Behavior
* **Normal Mode**: If IndexedDB is supported, the app enables offline caching.
* **Fallback Mode**: If IndexedDB fails to initialize, the app falls back to standard memory caching (`getFirestore(app)`). The app still functions normally, but offline changes will not be saved after the tab is closed.

---

## 3. E2E Testing Optimizations

During automated E2E tests, headless browsers start with a blank state. By default, Firebase Auth might use session-only memory, requiring the tests to sign in repeatedly.

To speed up tests and maintain the login state, we detect automated test environments and enforce local persistence:

```typescript
// E2E Test Optimization: Force LocalStorage persistence so Playwright can capture it
if (typeof window !== 'undefined' && navigator.webdriver && auth) {
  window.firebaseAuth = auth;
  setPersistence(auth, browserLocalPersistence).catch(err => {
    console.error("Failed to set auth persistence:", err);
  });
}
```

### 3.1 Key Settings
1. **Detect Automation**: Checks if `navigator.webdriver` is true, which indicates the browser is controlled by a testing tool like Playwright.
2. **Enforce Local Storage**: When automation is detected, the app forces authentication state persistence using `browserLocalPersistence` (`localStorage`). This keeps the user logged in across page reloads.
3. **Global Debug Interface**: Binds the auth instance to `window.firebaseAuth` so Playwright scripts can access auth tokens or check session states directly.

---

## 4. Offline Conflict Resolution Policy

When users edit data offline, changes are queued locally in IndexedDB and synchronized once the network is restored. To ensure data consistency across concurrent offline edits, we define these resolution policies:

### 4.1 Last-Write-Wins (LWW) Policy
*   **Direct Writes**: For standard document mutations (such as updating profile nicknames or toggling chat reactions), Firestore uses a **Last-Write-Wins** strategy based on the server-side arrival timestamp.
*   **Isolated Scopes**: Because notes are created in user-specific subcollections (`users/{uid}/notes` or group message subcollections), multiple users are writing to distinct documents. This naturally eliminates editing conflict states.

### 4.2 Transactional Offline Blocking
*   **Client Aborts**: Firestore transactions (like joining groups to verify the 5-member capacity limit, or atomic `NoteService` operations) **cannot execute offline**. 
*   **Fail-Safe UI**: When offline, any action requiring transactional integrity will fail immediately at the API network layer, triggering a user toast: *"Internet connection required to join groups or update data."* This prevents corrupting group member counts or daily aggregate statistics via offline spoofing.

### 4.3 Optimistic UI Updates
*   **Message Dispatch**: Real-time group chat messages display instantly using temporary client-side IDs (`tempId`). Once the connection is restored, the client resolves the `tempId` against the Firestore generated server ID, ensuring smooth user interactions during temporary drops.

