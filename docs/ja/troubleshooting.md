# 技術的なトラブルシューティング & FAQ

このドキュメントでは、**scripture-habit** の開発時に発生する一般的な環境およびプラットフォームの問題、特に **Capacitor**、**Android エミュレータ**、および **Firebase エミュレータ**に関する問題の解決方法について説明します。

---

## モバイルおよびエミュレータの接続性

### 1. 接続拒否: `ERR_CONNECTION_REFUSED`
*   **症状**: Android エミュレータまたは実機において、ライブリロードでの Vite サーバーの読み込み（`npx cap run android --livereload`）に失敗する、あるいはローカルの Express バックエンド（ポート 3001）へのアクセスに失敗する。
*   **原因**: Android エミュレータ内部の `localhost`（または `127.0.0.1`）は、ホストの開発用マシンではなくエミュレータ自体を指します。
*   **解決方法**:
    1.  **ホスト IP の特定**: `ipconfig`（Windows）または `ifconfig`（Mac/Linux）を使用して、マシンのローカル IP アドレス（例：`192.168.1.15`）を確認します。
    2.  **Vite の設定**: 外部からのアクセスを許可して Vite サーバーを実行します。
        ```bash
        npm run dev -- --host
        ```
    3.  **API エンドポイントの更新**: モバイルの `.env` または `capacitor.config.ts` で、`API_BASE` がマシンの IP アドレスを指していることを確認します。
        `http://192.168.1.15:3001/api`
    4.  **エミュレータの代替手段**: Android エミュレータは、特別な IP `10.0.2.2` を使用してホストマシンにアクセスできます。たとえば、エミュレータ上で実行している場合は `http://10.0.2.2:3001/api` が機能します。

### 2. クリアテキスト/HTTP ブロック
*   **症状**: ローカル開発サーバーへのネットワーク呼び出しが静かに失敗する、あるいは Android Studio の logcat に `net::ERR_CLEARTEXT_NOT_PERMITTED` と表示される。
*   **原因**: Android 9（API 28）以降、デフォルトでクリアテキスト（暗号化されていない HTTP）トラフィックが無効になっています。
*   **解決方法**:
    デバッグ設定でクリアテキストトラフィックを許可します。`android/app/src/main/` にある `AndroidManifest.xml` に `android:usesCleartextTraffic="true"` を追加します。
    ```xml
    <application
        android:usesCleartextTraffic="true"
        ... >
    ```
    > [!WARNING]
    > Google Play ストアに本番ビルドをデプロイする前に、この設定を削除してください。

---

## App Check & Google 認証

### 1. ローカル API での "Invalid App Check Token"
*   **症状**: バックエンドの Express API ルートが、Vite またはエミュレータからのローカルリクエストに対して `403 Forbidden: Invalid App Check` を返して拒否する。
*   **原因**: App Check にはデバイスの整合性プロバイダー（Play Integrity や DeviceCheck など）が必要ですが、これらは標準的な Web ブラウザやエミュレータでは利用できません。
*   **解決方法**:
    1.  **開発環境でのバイパス**: ローカルの環境変数で `SKIP_APP_CHECK=true` を設定します。このフラグが有効な場合、`middleware.ts` の `verifyAppCheck` ミドルウェアは検証をスキップします。
    2.  **デバッグトークンの使用**: App Check をテストするには、Firebase コンソールでデバッグトークンを登録し、クライアント SDK を設定します。
        ```typescript
        // firebase.ts の初期化
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        ```

### 2. ネイティブビルドでの Google サインイン失敗
*   **症状**: Android 上で Google ログインをタップすると、読み込みスピナーが表示されるものの、エラーコード `12500` または `10` を返して静かにログイン画面に戻る。
*   **原因**: Google OAuth には署名キーの SHA-1 フィンガープリントが必要です。Capacitor が使用するデバッグ用キーストアのフィンガープリントを、Firebase プロジェクトの設定に登録する必要があります。
*   **解決方法**:
    1.  **SHA-1 の抽出**: `android/` ディレクトリ内で Gradle 署名レポートツールを実行します。
        ```bash
        ./gradlew signingReport
        ```
        `debug` バリアントに対応する SHA-1 ブロックを探します。
    2.  **フィンガープリントの登録**: SHA-1 フィンガープリントをコピーします。**Firebase コンソール > プロジェクトの設定 > マイアプリ（Android アプリ）**に移動し、**SHA 証明書フィンガープリント**にフィンガープリントを追加します。
    3.  **設定の更新**: Firebase から新しい `google-services.json` をダウンロードし、`android/app/` 内のファイルを置き換えます。

---

## Firebase エミュレータ環境のセットアップ

### 1. Firestore 認証コンテキストの不一致
*   **症状**: ユニットテストが失敗する、またはエミュレータデータベースのコンテキストが認証済み状態と一致しないため Firestore ルールが操作を拒否する。
*   **解決方法**:
    テスト内で `@firebase/rules-unit-testing` を使用して、認証済みのコンテキストを作成します。
    ```typescript
    import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
    
    const testEnv = await initializeTestEnvironment({
        projectId: 'scripture-habit-auth',
        firestore: { rules: readFileSync('firestore.rules', 'utf8') }
    });
    
    // 認証済みの Firestore コンテキストを作成
    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    ```
