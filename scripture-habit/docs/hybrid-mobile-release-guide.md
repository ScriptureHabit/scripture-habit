# Capacitor Mobile: Production Release & App Signing Guide

This guide details the step-by-step production compilation, signing, and store deployment procedures for the **scripture-habit** hybrid mobile applications (Android & iOS).

---

## 🤖 1. Android Release & App Signing Pipeline

Android applications use the App Bundle (`.aab`) format for Google Play distribution, or Android Package (`.apk`) for testing. Signing must be performed correctly to support secure Google Authentication and FCM.

### 1.1 Compile Static Assets and Sync Capacitor
Before compiling the native code, compile the React build and sync the plugins:
```bash
# 1. Compile the production Vite client
npm run build

# 2. Sync files and native plugins to the android/ directory
npx cap sync android
```

### 1.2 Generate a Production Keystore (One-Time Setup)
If you do not already have a release key, generate a secure Java Keystore:
```bash
keytool -genkey -v -keystore scripture-habit-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias scripture-habit-alias
```
*Keep `scripture-habit-release.jks` in a highly secure, backed-up location. If this file is lost, you will never be able to update your application on the Google Play Store.*

### 1.3 Compile the Release App Bundle (`.aab`)
Open the Android project in Android Studio, or execute the Gradle wrapper directly from your terminal:
```bash
# Navigate to the Android native subdirectory
cd android

# Compile the release App Bundle
./gradlew bundleRelease
```
This builds the unsigned bundle at `android/app/build/outputs/bundle/release/app-release-unsigned.aab`.

### 1.4 Optimize and Sign the Bundle
Use the Android SDK tools (usually located in your Android SDK directory e.g. `C:\Users\[User]\AppData\Local\Android\Sdk\build-tools\[Version]\`) to sign and verify the bundle:

1.  **Sign the `.aab` / `.apk`**:
    ```bash
    jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 -keystore scripture-habit-release.jks app-release-unsigned.aab scripture-habit-alias
    ```
2.  **Align the Package (Required if compiling .apk)**:
    ```bash
    zipalign -v 4 app-release-unsigned.apk scripture-habit-signed.apk
    ```
3.  **Verify Signature**:
    ```bash
    apksigner verify scripture-habit-signed.apk
    ```

### 1.5 Firebase Console & Google Auth Registration
Google Auth **requires** your production signing key's SHA-1 and SHA-256 fingerprints to be registered in your Firebase Project, otherwise Google Sign-In will crash on native apps with a generic API Exception.

1.  **Extract Fingerprints from your Keystore**:
    ```bash
    keytool -list -v -keystore scripture-habit-release.jks -alias scripture-habit-alias
    ```
2.  Copy the output **SHA-1** and **SHA-256** Hex hashes.
3.  Navigate to **Firebase Console > Project Settings (Gear Icon) > General**.
4.  Scroll down to your **Android App** configuration.
5.  Click **Add fingerprint** and paste both the SHA-1 and SHA-256 values.
6.  *Important*: Download the updated `google-services.json` and replace `android/app/google-services.json`.

---

## 🍏 2. iOS Xcode Release & Provisioning Pipeline

iOS deployment requires Apple Developer membership, Xcode on macOS, and Apple APNs configuration for push notifications.

### 2.1 Sync the iOS Native Project
Export the web bundle and sync native configurations:
```bash
# Export the build to the Capacitor iOS directory
npx cap sync ios

# Open the workspace in Xcode
npx cap open ios
```

### 2.2 Configure Signing and Provisioning Profiles
Inside Xcode, configure the App's provisioning capabilities:
1.  Select the **App** root target in the left navigation sidebar.
2.  Open the **Signing & Capabilities** tab.
3.  Ensure **Automatically manage signing** is checked.
4.  Select your **Developer Team** from the dropdown.
5.  Verify that Xcode successfully generates the App ID, Development Certificate, and Provisioning Profile.
6.  *Bundle Identifier*: Verify that it matches `com.scripturehabit.app` exactly as defined in `capacitor.config.ts`.

### 2.3 APNs & Push Notification Setup
iOS requires Apple Push Notification service (APNs) keys linked to Firebase.
1.  Navigate to the **Apple Developer Portal > Certificates, Identifiers & Profiles > Keys**.
2.  Create a new key, check the **Apple Push Notifications service (APNs)** checkbox, and download the `.p8` key file. Note your **Key ID** and your **Team ID**.
3.  Navigate to **Firebase Console > Project Settings > Cloud Messaging**.
4.  Under the **Apple app sharing configuration**, upload the `.p8` key file, entering your Apple Team ID and APNs Key ID.

### 2.4 Archive and Upload to App Store Connect
1.  In Xcode, select the active target device dropdown and change it from emulator to **Any iOS Device (arm64)**.
2.  Increment the **Version** (e.g., `1.0.0`) and the **Build number** (e.g., `1`) in the General settings.
3.  Go to the Xcode menu bar and click **Product > Archive**.
4.  Once the organizer opens, click **Distribute App > App Store Connect > Upload** to deploy the build for TestFlight or final App Store Review.

---

## 🛠️ Summary Matrix: Key Release Credentials

Ensure these assets are safe and shared within your engineering team's credentials manager:

| Asset | Scope | Filename | Description |
| :--- | :--- | :--- | :--- |
| **Android Keystore** | Android | `scripture-habit-release.jks` | Cryptographic signature file containing keys for the Android app. |
| **Google Services Config** | Both | `google-services.json` / `GoogleService-Info.plist` | Config map directing native plugins to Firestore/Auth API gates. |
| **Apple APNs Key** | iOS | `AuthKey_[KEY_ID].p8` | Private key to authorize Firebase FCM messages to Apple APNs routers. |

> [!CAUTION]
> Never commit `.jks` Keystore files, `.p8` APNs Keys, or unmasked `google-services.json` files to public GitHub repositories. Use a password manager or encrypted vault to transfer these assets.
