# 技術的なトラブルシューティング & FAQ

このドキュメントでは、**scripture-habit** の開発・運用時に発生しやすい問題と、その具体的な解決手順について解説します。

---

## 1. ポート競合エラー (8080, 9099, 5000)

* **症状**: `npm run dev:all` や `npm run emulators` の実行時に以下のようなエラーで起動に失敗する。
  ```text
  Port 8080 is already in use by another process
  Port 9099 is already in use by another process
  ```
* **原因**: 前回起動した Node.js プロセスや Firebase エミュレータ（Java）が完全に終了せず、ポートを占有し続けている。
* **解決方法**:
  `kill-port` コマンドで該当ポートを一括解放します。
  ```bash
  npx kill-port 8080 9099 5000 5173
  ```
  解放後、再度開発サーバーを起動します。
  ```bash
  npm run dev:all
  ```

---

## 2. Firebase エミュレータの Java 動作要件

* **症状**: `firebase emulators:start` が `Java runtime not found` で失敗するか、起動直後に異常終了する。
* **原因**: Cloud Firestore および Cloud Functions のエミュレータは Java（JAR）上で動作するため、**Java SE Development Kit (JDK) 11 以上**のインストールが必須です。
* **解決方法**:
  1. インストール状況の確認:
     ```bash
     java -version
     ```
  2. OpenJDK 17 または 21 をインストール（Windows: `winget install Microsoft.OpenJDK.21`、macOS: `brew install openjdk@21`、または Eclipse Temurin 等）。
  3. シェルの環境変数に `JAVA_HOME` が正しく設定されていることを確認してください。

---

## 3. App Check & ローカル認証エラー

* **症状**: バックエンドの Express API ルートが、Vite またはエミュレータからのローカルリクエストに対して `403 Forbidden: Invalid App Check` を返して拒否する。
* **原因**: App Check にはデバイスの真正性プロバイダー（Play Integrity や DeviceCheck など）が必要ですが、標準的な Web ブラウザやローカルエミュレータでは利用できません。
* **解決方法**:
  1. **開発環境でのバイパス**: `.env.local` または環境変数で `SKIP_APP_CHECK=true` を設定します。`middleware.ts` 内の `verifyAppCheck` ミドルウェアが自動的に検証をスキップします。
  2. **デバッグトークンによる実検証**: ローカルで App Check の動作自体をテストしたい場合は、Firebase コンソールでデバッグトークンを登録し、クライアント SDK を設定します。
     ```typescript
     // firebase.ts の初期化
     self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
     ```

---

## 4. ローカル開発時の PWA / Service Worker の動作

* **症状**: `npm run dev` 実行中に `sw.ts` やプッシュ通知ハンドラーの変更が反映されない。
* **原因**: Vite PWA プラグインは、開発時の高速なホットモジュール置換（HMR）の妨げにならないよう、デフォルトの `dev` モードでは Service Worker を意図的に無効化しています。
* **解決方法**:
  Service Worker を有効化した状態で開発サーバーを起動します。
  ```bash
  npm run dev:pwa
  ```
  または環境変数フラグを付与して起動します。
  ```bash
  cross-env VITE_ENABLE_SW_IN_DEV=true vite
  ```

---

## 5. Vercel Serverless Functions のコールドスタート対策（API Warmup）

* **症状**: アプリ起動後、一定時間アイドル状態が続いた後の初回 API リクエストで 1.5〜2.5 秒程度のレイテンシが発生する。
* **原因**: Vercel のサーバーレスコンテナがアイドル時に破棄され、再起動時に Express コンテナと Firebase Admin 接続の再初期化を要するため。
* **対策（組み込み済み）**:
  高頻度で投稿を行う画面（`NewNote`, `SignupForm`, `Dashboard`）のマウント時に、軽量なウォームアップフックを実行しています。
  ```typescript
  import { useApiWarmupOnMount } from '../../utils/api-warmup';

  // コンポーネント内で呼び出し
  useApiWarmupOnMount();
  ```
  ユーザーが入力や操作を完了して送信ボタンを押す前に、バックグラウンドで非同期に `GET /api/health` を叩いてコンテナを温めておくことで、送信時の待機時間を最小限に抑えています。

---

## 6. Firestore セキュリティルールのユニットテスト

* **症状**: ユニットテスト実行時、エミュレータデータベースの認証状態が一致せず Firestore ルールによって操作が拒否される。
* **解決方法**:
  テスト内で `@firebase/rules-unit-testing` を使用して、明示的な認証済みコンテキストを作成します。
  ```typescript
  import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
  import { readFileSync } from 'fs';

  const testEnv = await initializeTestEnvironment({
      projectId: 'scripture-habit-auth',
      firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });

  // 認証済みの Firestore コンテキストを作成
  const aliceDb = testEnv.authenticatedContext('alice').firestore();
  ```
