# ノート作成・編集モーダル (`NewNote`) の設計と実装

::: tip インタラクティブ・アーキテクチャツアー
この機能のデータフローとステップ解説ツアーを体験できます：
- **オンライン（GitHubブラウザプレビュー）**: [インタラクティブツアーを開く (新規ノート作成 & 聖句タグ)](https://htmlpreview.github.io/?https://github.com/ScriptureHabit/scripture-habit/blob/main/docs/public/architecture-tour.html?tour=tour-newnote&lang=ja)
- **VitePress / ローカル**: [新規ノート作成 & 聖句タグ の解説ツアーを開く](/architecture-tour.html?tour=tour-newnote&lang=ja)
:::

このドキュメントでは、スタディノートの作成・編集モーダル（`src/components/newnote`）の構成、フォーム状態の管理、カスタムフックの分離、および各機能の実装について解説します。

---

## 1. 全体アーキテクチャの概要

`NewNote` は、ユーザーが日々の学習ノートを記録し、個人保存またはグループ共有を行うためのモーダルコンポーネントです。

```
                               ┌─────────────────────────┐
                               │       NewNote           │
                               │  (モーダルコンテナ)      │
                               └────────────┬────────────┘
                                            │
        ┌──────────────────┬────────────────┼─────────────────┬──────────────────┐
        ▼                  ▼                ▼                 ▼                  ▼
useUrlMetaFetcher   useAIGenerator   useRandomNote   useNoteSubmission    サブコンポーネント
(500msデバウンスURL) (Gemini質問生成) (テーマ別聖句提案) (投稿・編集・紙吹雪)  (ピル/ダイアログ)
```

### 主な機能
- **聖典名の入力補完**: ひらがなやカタカナ、略称から書籍名をリアルタイム補完。
- **URL メタデータの自動取得 (`useUrlMetaFetcher`)**: 総大会や説教のURLが入力された際、500msのデバウンスを挟んでタイトルや話者名を自動抽出。
- **AI 振り返り質問の生成 (`useAIGenerator`)**: 選択した聖句に応じた深めるための問いかけを Gemini AI で生成。
- **テーマ別ランダム聖句提案 (`useRandomNote`)**: 「今日の読書計画」「マスター聖句」「平安」「試練」「喜び」などのカテゴリから聖句をランダム抽出。
- **共有範囲の制御 (`NoteSharingOptions`)**: 「全グループ共有」「個人記録のみ」「特定のグループを選択」から柔軟に選択。
- **編集モードと新規作成の統合**: 既存ノートの編集時は `writeBatch` により個人ノートとグループチャットメッセージを同時更新。

---

## 2. ディレクトリ構造

```
src/components/newnote/
├── new-note.tsx                        # メインモーダルコンポーネント
├── new-note.css                        # スタイリング
├── new-note.test.tsx                   # コンポーネント統合テスト
├── hooks/
│   ├── use-url-meta-fetcher.ts        # URLメタデータ自動取得フック
│   ├── use-ai-generator.ts            # Gemini API 質問生成フック
│   ├── use-random-note.ts             # ランダム聖句提案フック
│   ├── use-note-submission.ts         # 投稿・編集同期フック
│   └── use-note-submission.test.ts    # 投稿フックの単体テスト
└── subcomponents/
    ├── random-scripture-menu.tsx      # ランダム提案メニュー
    ├── scripture-selection-modal.tsx  # テーマ別選択モーダル
    ├── note-sharing-options.tsx       # 共有範囲選択ピルUI
    └── close-confirm-modal.tsx        # 破棄確認モーダル
```

---

## 3. 主要フックの実装概要

### ① URL メタデータ取得 (`useUrlMetaFetcher`)
ユーザーが入力した章フィールドが `http` で始まる場合、入力完了後 500ms 待機してからバックエンド API（`/api/preview`）を呼び出し、タイトルと話者を取得します。

### ② ランダム聖句の提案 (`useRandomNote`)
日替わりの読書計画やテーマ別リストからランダムに聖句を選び、入力フォームへ自動セットします。リンク付き聖句の場合は、ユーザーの言語に合わせてURLを自動ローカライズします。

### ③ 投稿・編集処理 (`useNoteSubmission`)
- **新規投稿**: `/api/notes` へ POST 送信。レベルアップ時には紙吹雪（`canvas-confetti`）を表示。
- **既存編集**: Firestore の `writeBatch` を使用し、個人ノート（`users/{uid}/notes`）とグループメッセージ（`groups/{gid}/messages`）を一括更新。

---

## 4. 関連ドキュメント

- [ノート投稿 & ストリーク計算](./logic-note-posting.md)
- [URL メタデータ & 話者抽出](./url-metadata-extraction.md)
- [AI 統合 (Gemini)](./feature-ai-integration.md)
- [ダッシュボード ＆ マイノート設計ガイド](./dashboard-mynotes-construction-guide.md)
