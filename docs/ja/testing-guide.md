# テストガイド

このドキュメントでは、アプリケーションの信頼性を保証するために scripture-habit プロジェクトで使用されているテスト戦略とパターンについて説明します。

---

## 1. Firestore セキュリティルール
ユーザーデータの保護とビジネスロジックの適用を検証するため、`@firebase/rules-unit-testing` を使用してセキュリティルールをテストしています。

- **場所**: `api_internal/rules.test.ts`
- **実行方法** (専用テスト):
  ```bash
  npm run test:rules
  ```
  *(すべての内部統合テストの一部として実行する場合)*:
  ```bash
  npm run test:internal
  ```
- **主なパターン**:
  - 認証済みおよび未認証の両方のアクセスをテストする。
  - 適切なフィルターが適用された一覧（リスト）クエリを検証する（セキュリティルールで特定のフィルターが必要となることが多いため）。
  - ネストされたコレクションやソーシャル機能（Cheers や Reports）をテストする。

---

## 2. フロントエンドのフック（Hook）テスト
日付に基づくリセットやメタデータの取得などのコアなフックロジックは、Vitest と `@testing-library/react` を使用してテストされます。

- **場所**: `src/hooks/__tests__/*.test.ts`
- **実行方法**:
  ```bash
  npm test
  ```
- **主なパターン**:
  - `vi.useFakeTimers()` を使用して、時間に依存するロジックをテストする。
  - フックのロジックを隔離するため、外部依存関係（`safeStorage` や `fetch` など）をモックする。
  - 状態遷移と副作用（サイドエフェクト）を検証する。

---

## 3. API 統合テスト
認証、バリデーション、およびデータベースのトランザクションが正しく機能することを確認するため、API ルートはアクティブな Firebase エミュレータに対してテストされます。

- **場所**: `api_internal/*.integration.test.ts`
- **実行方法** (すべての内部テストに推奨):
  ```bash
  npm run test:internal
  ```
  *(単一ファイルを手動で実行する場合)*:
  ```bash
  firebase emulators:exec --project scripture-habit-auth "npx vitest api_internal/groups.integration.test.ts"
  ```
- **主なパターン**:
  - 様々なユーザー状態をシミュレートするために `verifyIdToken` をモックする。
  - Admin SDK を使用して、Firestore に初期状態をセットアップする。
  - エラーケースをテストする（バリデーションエラーは 400、権限エラーは 403、リソース未検出は 404）。

---

## 4. AI プロンプト回帰テスト
スナップショットテストを使用して、Gemini に送信される正確なプロンプトテキストを検証します。

- **場所**: `api_internal/ai_integration.test.ts`
- **実行方法** (推奨):
  ```bash
  npm run test:internal
  ```
  *(手動で実行する場合)*:
  ```bash
  firebase emulators:exec --project scripture-habit-auth "npx vitest api_internal/ai_integration.test.ts"
  ```
- **主なパターン**:
  - `axios.post` をモックして、Gemini API に送信されるプロンプトをインターセプト（傍受）する。
  - `expect(prompt).toMatchSnapshot()` を使用して、プロンプトテンプレートの予期しない変更を検出する。
  - 動的コンテンツ（聖典の参照、言語）が正しく注入されていることを検証する。

---

## 5. E2E テスト (Playwright)
プロジェクトでは **Playwright** を使用して、主要なユーザーワークフローのエンドツーエンド（E2E）テストを実行しています。

- **場所**: `tests/*.spec.ts`
- **実行方法**:
  ```bash
  npm run test:e2e
  ```
  *注意: このコマンドは、Playwright の `webServer` 設定を使用して、Vite 開発サーバー、Express バックエンド、および Firebase エミュレータを自動的に起動します。*

### 5.1 グローバル認証セットアップ (`auth.setup.ts`)
テストを高速化し、繰り返しサインインするのを避けるため、Playwright の**グローバルセットアップ（Global Setup）**を使用してセッション状態を保存および再利用します。
1. **テスターアカウントのセットアップ**: セットアップスクリプトは Chromium を起動し、`shared-tester@example.com`（パスワード: `password123`）を対象とします。
2. **自動サインアップへのフォールバック**: スクリプトはサインインを試みます。エミュレータ内にユーザーが存在しない場合は、`/en/signup` を介して新しいアカウントを作成し、`/dashboard` に遷移します。
3. **状態のクリーンアップ**: サインイン後、スクリプトは `/api/test/leave-all-groups` を呼び出してアクティブなグループをすべて脱退し、言語を英語（`en`）にリセットします。これにより、すべてのテストがクリーンなアカウント状態で開始されます。
4. **セッションのエクスポート**: 認証済みの状態は `playwright/.auth/user.json` に保存されます。他のテストはこのファイルを使用してログイン状態で開始され、サインインステップをスキップします。

### 5.2 高度な E2E デバッグ
E2E テストをデバッグするには、Playwright に組み込まれている以下のツールを使用できます。
* **インタラクティブ UI モード**: ビジュアルインターフェースを開き、テストをステップ実行したり、DOM をインスペクト（調査）したり、ネットワークアクティビティを確認したりできます。
  ```bash
  npx playwright test --ui
  ```
* **HTML トレースビューア**: CI 上でテストが失敗した場合、Playwright はトレースレポートを生成します。以下を使用して開くことができます。
  ```bash
  npx playwright show-report
  ```

---

## 6. CI/CD 統合
すべてのテスト（Lint、Vitest、API 統合テスト、Playwright E2E）は、プッシュやプルリクエストのたびに `.github/workflows/ci.yml` を通じて GitHub Actions 上で自動的に実行されます。

自動テスト実行中に App Check をバイパスするため、テスト環境で `SKIP_APP_CHECK=true` が設定されていることを確認してください。

---

## 7. Firestore 読み取り回数（Read Count）回帰テスト

最適な Firestore の読み取り回数を数学的に強制し、最適化状態を永続的に固定するために、専用の読み取り回数アサーションテストを実行します。

- **場所**: `api_internal/firestore-read-count.integration.test.ts`
- **実行方法**:
  ```bash
  npm run test:internal -- firestore-read-count.integration.test.ts
  ```
- **主なパターン**:
  - Vitest のスパイ（Spy）機能を使用して、トランザクションおよびドキュメント参照の読み取り回数を検証します。
  - 期待される正確な読み取り回数を数学的にアサート（検証）します（例: トランザクションループ内の再読み取りが 0 回であること）。
  - `api_internal/test-setup.ts` 内に実装された、エミュレートされたすべてのテストスイートのコレクションレベルでの読み取り回数内訳をレポートする、透過的な自動読み取りバジェット（予算）トラッカーによって補完されます。
