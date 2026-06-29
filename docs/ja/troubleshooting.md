# 技術的なトラブルシューティング & FAQ

このドキュメントでは、**scripture-habit** の開発時に発生する一般的な環境およびプラットフォームの問題、特に **Firebase エミュレータ**に関する問題の解決方法について説明します。

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
