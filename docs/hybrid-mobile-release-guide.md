# Capacitor Mobile: Production Release & App Signing

This guide explains how to build, sign, and deploy the **scripture-habit** mobile apps for Android and iOS.

---

## 1. Android Release & App Signing

Android apps use the Android App Bundle (`.aab`) format for Google Play, or the APK (`.apk`) format for testing. You must sign the app correctly to enable Google Authentication and Push Notifications.

### 1.1 Build and Sync
First, build the React frontend and sync the project with Capacitor:
```bash
# 1. Compile the production Vite client
npm run build

# 2. Sync files and native plugins to the android/ directory
npx cap sync android
```

### 1.2 Generate a Production Keystore (One-Time Setup)
If you do not have a release key, generate a new keystore file:
```bash
keytool -genkey -v -keystore scripture-habit-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias scripture-habit-alias
```
*Keep `scripture-habit-release.jks` in a safe, backed-up location. If you lose this file, you cannot update your app on the Google Play Store.*

### 1.3 Build the App Bundle
You can build the app using Android Studio or run Gradle from the terminal:
```bash
# Navigate to the Android native subdirectory
cd android

# Compile the release App Bundle
./gradlew bundleRelease
```
This builds the unsigned bundle at `android/app/build/outputs/bundle/release/app-release-unsigned.aab`.

### 1.4 Sign the Bundle
Use the tools in your Android SDK directory (e.g., `C:\Users\[User]\AppData\Local\Android\Sdk\build-tools\[Version]\`) to sign the app:

1.  **Sign the `.aab` / `.apk`**:
    ```bash
    jarsigner -verbose -sigalg SHA256withRSA -digestalg -SHA-256 -keystore scripture-habit-release.jks app-release-unsigned.aab scripture-habit-alias
    ```
2.  **Align the Package (Required if compiling .apk)**:
    ```bash
    zipalign -v 4 app-release-unsigned.apk scripture-habit-signed.apk
    ```
3.  **Verify Signature**:
    ```bash
    apksigner verify scripture-habit-signed.apk
    ```

### 1.5 Register Fingerprints in Firebase
Google Authentication requires your production signing key's SHA-1 and SHA-256 fingerprints. Without these, Google Sign-In will fail on the mobile app.

1.  **Extract Fingerprints from your Keystore**:
    ```bash
    keytool -list -v -keystore scripture-habit-release.jks -alias scripture-habit-alias
    ```
2.  Copy the output **SHA-1** and **SHA-256** Hex hashes.
3.  Navigate to **Firebase Console > Project Settings (Gear Icon) > General**.
4.  Scroll down to your **Android App** configuration.
5.  Click **Add fingerprint** and paste both the SHA-1 and SHA-256 values.
6.  *Important*: Download the new `google-services.json` and replace the existing file in `android/app/`.

---

## 2. iOS Xcode Release & Provisioning

Deploying to iOS requires an Apple Developer Account, Xcode on macOS, and Apple APNs setup for push notifications.

### 2.1 Sync iOS
Sync your web assets and open the Xcode workspace:
```bash
# Export the build to the Capacitor iOS directory
npx cap sync ios

# Open the workspace in Xcode
npx cap open ios
```

### 2.2 Configure Signing and Provisioning Profiles
In Xcode, configure your team and signing settings:
1.  Select the **App** root target in the left navigation sidebar.
2.  Open the **Signing & Capabilities** tab.
3.  Ensure **Automatically manage signing** is checked.
4.  Select your **Developer Team** from the dropdown.
5.  Make sure Xcode successfully creates the App ID and Provisioning Profile.
6.  *Bundle Identifier*: Ensure this matches `com.scripturehabit.app` exactly as defined in `capacitor.config.ts`.

### 2.3 APNs & Push Notification Setup
To enable push notifications on iOS, link your Apple APNs key to Firebase:
1.  Navigate to the **Apple Developer Portal > Certificates, Identifiers & Profiles > Keys**.
2.  Create a new key, check **Apple Push Notifications service (APNs)**, and download the `.p8` file. Note your **Key ID** and **Team ID**.
3.  Navigate to **Firebase Console > Project Settings > Cloud Messaging**.
4.  Under **Apple app configuration**, upload the `.p8` file and enter your Team ID and Key ID.

### 2.4 Archive and Upload to App Store Connect
1.  In Xcode, select the active target device dropdown and change it from emulator to **Any iOS Device (arm64)**.
2.  Increment the **Version** (e.g., `1.0.0`) and the **Build number** (e.g., `1`) in the General settings.
3.  Go to the Xcode menu bar and click **Product > Archive**.
4.  After archiving, click **Distribute App** to upload the build to App Store Connect.

---

## 3. Summary of Credentials

Keep these files in a secure location and share them safely with your team:

| Asset | Scope | Filename | Description |
| :--- | :--- | :--- | :--- |
| **Android Keystore** | Android | `scripture-habit-release.jks` | The signing key for the Android app. |
| **Google Services Config** | Both | `google-services.json` / `GoogleService-Info.plist` | Firebase configuration files for Android and iOS. |
| **Apple APNs Key** | iOS | `AuthKey_[KEY_ID].p8` | APNs authentication key for iOS push notifications. |

> [!CAUTION]
> Never commit `.jks`, `.p8`, or `google-services.json` files to Git. Use a password manager or secure vault to share these credentials.
