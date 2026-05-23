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
