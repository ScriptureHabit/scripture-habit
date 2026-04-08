# Notification System: Push & Delivery

The **scripture-habit** notification system ensures that users stay engaged with their groups through real-time push notifications delivered via Firebase Cloud Messaging (FCM).

---

## 🔑 Token Management

The system stores FCM tokens in two locations to balance privacy and functionality:
1.  **Public (`users/{uid}/fcmTokens`)**: Primary storage for easy retrieval during group notifications.
2.  **Private (`users/{uid}/private/tokens/fcmTokens`)**: Secondary fallback for enhanced security logic.

The backend `getUserFcmTokens` helper retrieves and deduplicates tokens from both locations to ensure maximum deliverability.

---

## 📡 Delivery Pipeline

The notification flow follows a **Decoupled Delivery** pattern:
1.  **Trigger**: A business action occurs (e.g., `NoteService.postNote` succeeds).
2.  **Notification Service**: `NotificationService.notifyNotePosted` is invoked.
3.  **Token Collection**: The service identifies all members of the target groups.
4.  **Multicast Sending**: `sendPushNotification` uses FCM's `sendEachForMulticast` to deliver the payload to up to 500 tokens in a single batch.

### Payload Structure
We send both `notification` (system-handled) and `data` (app-handled) fields:
- **Title/Body**: Visible notification text (e.g., "New note from [User]").
- **Data**: JSON object containing `groupId` and `type: 'note'`. This allows the app to open the correct chat screen when the user taps the notification.

---

## 🧹 Self-Healing & Cleanup

To prevent "ghost" tokens from slowing down deliveries, the system implements an automatic cleanup loop:
- **Detection**: FCM returns `messaging/invalid-registration-token` or `messaging/registration-token-not-registered` if a token is no longer valid (e.g., app uninstalled).
- **Cleanup**: The `cleanupTokens` helper is immediately triggered to remove these specific tokens from both the public and private Firestore locations.

---

## 🛠️ Native Integration (Capacitor)

On mobile devices (Android/iOS), the app uses the `@capacitor/push-notifications` plugin:
1.  **Permission**: Requested when the user clicks "Enable Notifications" on the Dashboard.
2.  **Registration**: Once granted, the FCM token is generated and sent to our `/api/register-fcm-token` endpoint.
3.  **Foreground Handling**: If the app is open, the notification is suppressed to prevent UI overlapping, as the real-time `onSnapshot` listener will already reflect the changes.
