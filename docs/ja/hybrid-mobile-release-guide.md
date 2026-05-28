# Capacitor モバイル: 本番リリース & アプリ署名

このガイドでは、Android および iOS 向けに **scripture-habit** モバイルアプリをビルド、署名、デプロイする方法について説明します。

---

## 1. Android リリース & アプリ署名

Android アプリは、Google Play 向けに Android App Bundle (`.aab`) フォーマットを使用するか、テスト用に APK (`.apk`) フォーマットを使用します。Google 認証およびプッシュ通知を有効にするには、アプリに正しく署名する必要があります。

### 1.1 ビルドと同期
最初に、React フロントエンドをビルドし、Capacitor とプロジェクトを同期します：
```bash
# 1. 本番用の Vite クライアントをコンパイル
npm run build

# 2. ファイルとネイティブプラグインを android/ ディレクトリに同期
npx cap sync android
```

### 1.2 本番用キーストアの生成（初回のみの設定）
リリースキーがない場合は、新しいキーストアファイルを生成します：
```bash
keytool -genkey -v -keystore scripture-habit-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias scripture-habit-alias
```
*`scripture-habit-release.jks` は、バックアップされた安全な場所に保管してください。このファイルを紛失すると、Google Play ストアでアプリを更新できなくなります。*

### 1.3 App Bundle のビルド
Android Studio を使用してアプリをビルドするか、ターミナルから Gradle を実行できます：
```bash
# Android ネイティブのサブディレクトリに移動
cd android

# リリース用の App Bundle をコンパイル
./gradlew bundleRelease
```
これにより、`android/app/build/outputs/bundle/release/app-release-unsigned.aab` に署名されていないバンドルがビルドされます。

### 1.4 バンドルの署名
Android SDK ディレクトリ（例：`C:\Users\[User]\AppData\Local\Android\Sdk\build-tools\[Version]\`）にあるツールを使用して、アプリに署名します：

1.  **`.aab` / `.apk` に署名する**:
    ```bash
    jarsigner -verbose -sigalg SHA256withRSA -digestalg -SHA-256 -keystore scripture-habit-release.jks app-release-unsigned.aab scripture-habit-alias
    ```
2.  **パッケージのアラインメント（`.apk` をコンパイルする場合のみ必要）**:
    ```bash
    zipalign -v 4 app-release-unsigned.apk scripture-habit-signed.apk
    ```
3.  **署名の検証**:
    ```bash
    apksigner verify scripture-habit-signed.apk
    ```

### 1.5 Firebase へのフィンガープリント登録
Google 認証には、本番用署名キーの SHA-1 および SHA-256 フィンガープリントが必要です。これらが登録されていない場合、モバイルアプリで Google サインインが失敗します。

1.  **キーストアからフィンガープリントを抽出する**:
    ```bash
    keytool -list -v -keystore scripture-habit-release.jks -alias scripture-habit-alias
    ```
2.  出力された **SHA-1** および **SHA-256** の 16 進数ハッシュをコピーします。
3.  **Firebase コンソール > プロジェクトの設定（歯車アイコン） > 全般** に移動します。
4.  下部にある **マイアプリ（Android アプリ）** の設定までスクロールします。
5.  **フィンガープリントを追加** をクリックし、SHA-1 と SHA-256 の両方の値を貼り付けます。
6.  *重要*: 新しい `google-services.json` をダウンロードし、`android/app/` 内の既存のファイルを置き換えます。

---

## 2. iOS Xcode リリース & プロビジョニング

iOS へのデプロイには、Apple Developer アカウント、macOS 上の Xcode、およびプッシュ通知用の Apple APNs のセットアップが必要です。

### 2.1 iOS の同期
Web アセットを同期し、Xcode ワークスペースを開きます：
```bash
# ビルドを Capacitor iOS ディレクトリにエクスポート
npx cap sync ios

# ワークスペースを Xcode で開く
npx cap open ios
```

### 2.2 署名とプロビジョニングプロファイルの設定
Xcode で、チームと署名設定を行います：
1.  左側のナビゲーションサイドバーで **App** のルートターゲットを選択します。
2.  **Signing & Capabilities** タブを開きます。
3.  **Automatically manage signing** がチェックされていることを確認します。
4.  ドロップダウンから **Developer Team** を選択します。
5.  Xcode が App ID とプロビジョニングプロファイル（Provisioning Profile）を正常に作成できることを確認します。
6.  *Bundle Identifier*: これが `capacitor.config.ts` で定義されている `com.scripturehabit.app` と完全に一致していることを確認します。

### 2.3 APNs & プッシュ通知のセットアップ
iOS でプッシュ通知を有効にするには、Apple APNs キーを Firebase にリンクします：
1.  **Apple Developer Portal > Certificates, Identifiers & Profiles > Keys** に移動します。
2.  新しいキーを作成し、**Apple Push Notifications service (APNs)** をチェックして、`.p8` ファイルをダウンロードします。**Key ID** と **Team ID** をメモします。
3.  **Firebase コンソール > プロジェクトの設定 > クラウド メッセージング** に移動します。
4.  **Apple アプリの設定**で、`.p8` ファイルをアップロードし、Team ID と Key ID を入力します。

### 2.4 アーカイブと App Store Connect へのアップロード
1.  Xcode で、アクティブなターゲットデバイスのドロップダウンを選択し、エミュレータから **Any iOS Device (arm64)** に変更します。
2.  General 設定で **Version**（例：`1.0.0`）と **Build** 番号（例：`1`）をインクリメント（加算）します。
3.  Xcode のメニューバーから **Product > Archive** をクリックします。
4.  アーカイブ完了後、**Distribute App** をクリックして、ビルドを App Store Connect にアップロードします。

---

## 3. クレデンシャルのまとめ

以下のファイルを安全な場所に保管し、チーム内で安全に共有してください。

| アセット | スコープ | ファイル名 | 説明 |
| :--- | :--- | :--- | :--- |
| **Android キーストア** | Android | `scripture-habit-release.jks` | Android アプリ用の署名キー。 |
| **Google サービス設定** | 両方 | `google-services.json` / `GoogleService-Info.plist` | Android および iOS 用の Firebase 設定ファイル。 |
| **Apple APNs キー** | iOS | `AuthKey_[KEY_ID].p8` | iOS プッシュ通知用の APNs 認証キー。 |

> [!CAUTION]
> `.jks`、`.p8`、または `google-services.json` ファイルを絶対に Git にコミットしないでください。これらの資格情報を共有するには、パスワードマネージャーやセキュアな保管庫を使用してください。
