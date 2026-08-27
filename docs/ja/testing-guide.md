# テストガイド

このドキュメントでは、アプリの品質と信頼性を維持するために scripture-habit で実施している各種テスト（単体・統合・E2E）と実行手順について解説します。

---

## 1. Firestore セキュリティルールのテスト

`@firebase/rules-unit-testing` を使用し、認証状態やグループ参加条件に応じたアクセス制御をテストします。

- **場所**: `api_internal/rules.test.ts`
- **実行コマンド**:
  ```bash
  npm run test:rules
  ```

---

## 2. フロントエンドのフック（Hook）単体テスト

日付変更リセットやキャッシュ制御などのロジックを Vitest と `@testing-library/react` で検証します。

- **場所**: `src/hooks/__tests__/*.test.ts`
- **実行コマンド**:
  ```bash
  npm test
  ```

---

## 3. バックエンド API 統合テスト

Firebase エミュレータ上で Express API ルートのバリデーション、認証、およびトランザクションを検証します。

- **場所**: `api_internal/*.integration.test.ts`
- **実行コマンド**:
  ```bash
  npm run test:internal
  ```

---

## 4. AI プロンプト回帰テスト

Gemini API に送信されるプロンプトテンプレートの意図しない変更をスナップショットテストで検知します。

- **場所**: `api_internal/ai_integration.test.ts`
- **実行コマンド**:
  ```bash
  npm run test:internal
  ```

---

## 5. E2E テスト (Playwright)

ユーザー登録、ノート作成、グループチャットなど主要な一連の画面フローをブラウザ自動操作でテストします。

- **場所**: `tests/*.spec.ts`
- **実行コマンド**:
  ```bash
  npm run test:e2e
  ```
  *(Vite サーバー、Express バックエンド、Firebase エミュレータが自動起動してテストが実行されます)*

- **デバッグ UI の起動**:
  ```bash
  npx playwright test --ui
  ```

---

## 6. Firestore 読み取り回数（Read Count）回帰テスト

予期せぬクエリ増加や N+1 問題による読み取りコストの増大を防ぐため、1操作あたりの読み取り回数を検証します。

- **場所**: `api_internal/firestore-read-count.integration.test.ts`
- **実行コマンド**:
  ```bash
  npm run test:internal -- firestore-read-count.integration.test.ts
  ```

---

## 7. 関連ドキュメント

- [開発 ＆ 環境セットアップガイド](./development-guide.md)
- [CI/CD ＆ メンテナンス自動化](./cicd-maintenance-automation.md)
- [トラブルシューティング](./troubleshooting.md)
