# AI コンテキストガイド ＆ 開発ルール

このドキュメントでは、Scripture Habit の開発において遵守すべきアーキテクチャの原則、状態管理のルール、データベース書き込みポリシー、およびコーディング規約について定義します。

---

## 1. アーキテクチャの基本原則

### ① ロジックとコンポーネントの分離 (Logic-Component Split)
- **UI コンポーネント (`src/components/`)**: レンダリングとレイアウト、スタイリング（Vanilla CSS）に専念。直接の API 呼び出しや複雑な計算ロジックは記述しない。
- **カスタムフック (`src/hooks/`)**: データ取得、状態同期、ビジネスロジックを担当。
- **スタイリング**: `src/index.css` の CSS 変数とクラス設計に基づく **Vanilla CSS** を使用（TailwindCSS などのユーティリティライブラリは使用しない）。

### ② 状態管理の分類（単一情報源の原則）
- **静的なサーバー情報**: TanStack Query
- **リアルタイムデータ（チャット・未読・ストリーク）**: Firestore `onSnapshot`
- **グローバル UI 状態（モーダル・テーマ）**: Zustand
- **認証状態**: `AuthContext`

---

## 2. データベース書き込みポリシー

### ① 共有データはバックエンド API 経由で更新
- グループメッセージ（`messages`）、メンバー一覧（`members`）、応援（`cheers`）などの共同データは、`firestore.rules` でクライアントからの直接書き込みを禁止（`allow write: if false;`）しています。
- 必ずバックエンドの Express API（Firebase Admin SDK）を経由し、トランザクションで安全に一括更新します。

### ② 個人データの直接書き込み
- ユーザー設定（`users/{uid}`）、通知トークン（`private/tokens`）、既読状態（`groupStates`）など、個人に閉じたデータのみクライアントからの直接更新を許可しています。

### ③ トランザクション処理の原則
- **Read-before-Write**: すべての読み取りを書き込みの前に実行する。
- **副作用の禁止**: 外部 API 呼び出しや通知送信などの副作用は、トランザクションが正常にコミットされた後に実行する。

---

## 3. 多言語対応と AI 統合

- **ハードコードの禁止**: UI 文字列は直接記述せず、必ず `useLanguage` の `t()` 関数を使用する。
- **AI ペルソナ**: Gemini 呼び出し時のプロンプトは、常に「温かく、親しみやすく、日々の学びに寄り添うファシリテーター」のトーンを維持する。

---

## 4. エラーハンドリング規約

- バックエンドの業務エラーには、汎用の `Error` ではなく `AppError` のサブクラス（`ValidationError`, `AuthenticationError`, `ForbiddenError`, `NotFoundError`, `ConflictError`）を使用する。
- レスポンス返却には統一ヘルパー `sendErrorResponse(res, error)` を使用する。

---

## 5. 関連ドキュメント

- [全体アーキテクチャ](./architecture.md)
- [Firebase セキュリティルール](./firebase-security-rules.md)
- [API 設計 & エラーハンドリング](./api-middleware-error-handling.md)
