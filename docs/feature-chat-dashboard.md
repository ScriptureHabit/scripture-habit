# Chat & Dashboard Synchronization

The **Chat Dashboard** is an important UI component in **scripture-habit**. It handles real-time messages, image uploads, and unread status markers across multiple groups.

---

## 🛰️ Real-time Core: `onSnapshot` Architecture

We avoid traditional polling or manual fetch patterns. Instead, the UI reflects the Firestore database using persistent WebSocket listeners.

### Delta Handling
The sync engine (in `src/components/groupchat/hooks/core/`) uses Firestore's ability to send only modified or added documents.
- **Optimistic State**: When a user reads a message, the UI updates the local state immediately while the API update processes in the background.
- **Snapshot Merging**: New messages are added to the local list, minimizing deep tree re-renders by using stable React `key` properties based on Firestore `doc.id`.

---

## 🏁 Read Markers

Synchronizing unread counts is managed using a **"Server Truth"** model:

1.  **Local Read**: When a user enters a chat, the app marks the local `unreadCount` as zero.
2.  **API Sync**: It calls `/api/update-read-status` to inform the server of the new "Last Read" timestamp.
3.  **Recovery Logic**: If the API call fails or a background tab conflict occurs, the next `onSnapshot` trigger from the server will overwrite the local state with the database value.

---

## 🖼️ Media & Image Handling

Images in the chat follow a multi-stage process to ensure the UI feels responsive:
- **Optimization**: Images are resized or compressed on the client before upload to save user bandwidth.
- **Storage**: Real-time URLs are generated via Firebase Storage.
- **Optimistic Preview**: The component displays a local blob URL instantly after the user selects an image, replacing it with the permanent URL only once the upload is confirmed.

---

## 🚦 Synchronization State Diagram

```mermaid
stateDiagram-v2
    [*] --> Initializing
    Initializing --> FetchingMetadata: React Query (Metadata)
    FetchingMetadata --> AttachingListeners: onSnapshot (Messages)
    AttachingListeners --> ActiveSync
    
    state ActiveSync {
        [*] --> Idle
        Idle --> LocalUpdate: User Reads/Posts
        LocalUpdate --> APISync: POST /api/...
        APISync --> Idle: Success (Truth Confirmed)
        APISync --> Idle: Failure (Rollback to Last Truth)
    }
```

---

## 🚀 Performance Tips for Developers
- **Limit Snapshots**: Always use `limit(N)` and `orderBy('createdAt', 'desc')` in chat queries to prevent loading too many historical messages.
- **Stable References**: Use `useMemo` for derived chat data to prevent the sidebar from re-rendering on typing events.
- **Background Suppression**: When the browser tab is inactive, listeners remain active but UI updates are throttled to save CPU.
