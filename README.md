# Scripture Habit (スクハビ)

> **毎日の聖句学習を仲間と一緒に楽しく習慣化する、AIリアルタイム翻訳＆グループ機能付きコミュニティWebアプリ**

🌐 **Web Application**: [https://scripturehabit.app](https://scripturehabit.app)

<p align="center">
  <img src="https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-7.0%20(Native)-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript 7.0" />
  <img src="https://img.shields.io/badge/Node.js-26.0-5FA04E?style=for-the-badge&logo=nodedotjs" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express-5.0-000000?style=for-the-badge&logo=express" alt="Express" />
  <img src="https://img.shields.io/badge/Firebase-Firestore%2FAuth-FFCA28?style=for-the-badge&logo=firebase" alt="Firebase" />
</p>

---

## アプリ概要 (Overview)

**Scripture Habit** は、「一人だと継続しにくい」聖典学習の課題を、**ゲーム感覚のレベル＆ストリーク機能** と **学習グループによる適度なピア・プレッシャー** を用いることで解決します。

### 開発背景と解決する課題 (Background & Problem)
- **課題**: 個人での毎日の学習は挫折しやすく、外国の友人と学びを共有したくても言語の壁が存在する。
- **解決策**: レベル＆ストリーク機能によるゲーム化で継続率を高め、Gemini AI によるリアルタイム自動翻訳で言語の壁を超えたグループ学習環境を実現。

---

## 📊 運用実績 & データトラッキング (Analytics)

本プロダクトでは実際に運用を行い、ユーザーの日常的な学習習慣化とアクティブ数を分析・記録しています。2026年8月時点では一日平均10人以上のユーザーがこのアプリで学習ノートを投稿してます。

- 📈 **[日別アクティブ投稿ユーザー数データ (Google Spreadsheet)](https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/edit?usp=sharing)**
  *(※上記リンクから日毎のノート投稿ユーザー数のリアルタイム集計データを閲覧いただけます)*

---

## 主な機能 (Key Features)

### 1. ダッシュボード
<p align="center">
  <img src="./docs/images/dashboard.png" width="340" alt="ダッシュボード" />
</p>

- **レベル & 合計日数カウンター**: 毎日のノート作成で合計日数やレベル (`Lv`) がアップし、成長を実感できます。
- **今日の学習箇所ガイド**: 毎日読むべき聖句範囲が自動提示され、ワンタップで特定の聖句のページに移動することができます。

---

### 2. ノート作成
<p align="center">
  <img src="./docs/images/create-note.png" width="320" alt="ノート作成" />
</p>

- **ノートエディタ**: 今日の気づきや感想を書き留めて保存します。
- **自動ストリーク計算**: ノートを保存した瞬間に Firestore トランザクションが走り、ノートの保存、チャット送信、その他のデータ更新をまとめて行います。

---

### 3. マイノート・コレクション
<p align="center">
  <img src="./docs/images/my-notes.png" width="250" alt="マイノート" />
  <img src="./docs/images/weekly-letter.png" width="250" alt="ウィークリーレター" />
</p>

- **リアルタイムカテゴリ検索**: タグフィルターやキーワードで過去のノートを絞り込めます。
- **AIによる毎週の振り返りレター**: 1週間の学習内容をAIが読み取り、フィードバックをしてくれます。

---

### 4. グループチャット & 多言語対応
<p align="center">
  <img src="./docs/images/group-chat.png" width="250" alt="グループチャット" />
  <img src="./docs/images/languages.png" width="250" alt="多言語設定" />
</p>

- **聖句リンク自動生成機能、グループ団結機能**: 共有した聖句を元にアプリが適切なURLを生成します。
- **AI リアルタイム自動翻訳**: 海外メンバーのメッセージやニックネームを即座に自動翻訳。

---

### 5. 習慣化ルール & プロフィール・設定
<p align="center">
  <img src="./docs/images/habit-rule.png" width="230" alt="習慣化ルール" />
  <img src="./docs/images/profile.png" width="230" alt="プロフィール" />
  <img src="./docs/images/setting.png" width="230" alt="設定画面" />
</p>

- **習慣化ルール**: マンネリ化を防ぐためにユーザーがルールを設定できます。
- **ユーザープロフィール & 各種設定**: ニックネーム、アバター画像、言語設定、通知カスタマイズなどを柔軟に変更可能。

---

## 💡 こだわった技術的課題と解決策 (Technical Challenges)

### 1. 「チャットを開かずにノート投稿する」ユーザー行動に伴う未読アンカー計算の克服

- **直面したシナリオと課題**:
  初期設計では一般的なチャットアプリ同様「チャットを開いてメッセージを読む」ことしか想定していませんでした。
  しかし本アプリの特性上、**『ユーザーが何日間もチャットを開かず、ダッシュボードからノート投稿だけを継続する』** という実際の利用シナリオが発生しました。
  この場合、ノート投稿以前の古すぎるメッセージまで何十件も未読として残ってしまい、久々にチャットを開いた際に「新着メッセージの境界線（アンカー）」が過去の位置に狂ってしまう問題に直面しました。

- **技術的解決策 (Solution)**:
  1. **ノート投稿時のアクティブタイムスタンプ同期**:
     ノート保存時の Firestore トランザクションにて、その時点までのメッセージ既読状態（`lastReadTimestamp`）を自動同期。ノート投稿＝アクティブ活動として扱う仕様へとロジックを再設計しました。
  2. **純粋計算関数 `computeUnreadAnchorId` による境界特定**:
     非同期で届くメッセージ配列をタイムスタンプで防御的ソートし、「直近のノート投稿時刻より後に届いた最初のメッセージ」を「ここから新着メッセージ」としてアンカー固定するロジックを構築しました。
  3. **Vitest による多角シナリオテストの自動化**:
     「チャットを開かずにノートだけ投稿したケース」「全未読のケース」「既読と未読が混ざるケース」など、考えられるシナリオを 6 パターンの Vitest 単体テストで検証しました。

### 2. 再描画を最小限に抑える Split Context パターン
- **課題**: 単一の React Context だとチャット受信時に全画面が再描画され、入力パフォーマンスが低下する懸念があった。
- **解決策**: `DataContext`, `MessageActionsContext`, `GroupActionsContext`, `UIActionsContext` の 4 つに Context を分割（Split Context）しました。これにより不要な再描画を大幅に削減できました。

---

## 🛡️ セキュリティ & 品質保証 (Security & Quality Assurance)

- **不正アクセス遮断**: Firebase AppCheck + Zod スキーマバリデーションによる強力な入力検証
- **エラー追跡システム**: Sentry による本番サーバーエラーログのリアルタイム検知
- **品質テスト自動化**: Vitest（単体テスト）+ Playwright（E2E 自動テスト）による二重の回帰テスト体制

---

## 技術スタック & アーキテクチャ (Tech Stack & Architecture)

| カテゴリ | 使用技術 |
| :--- | :--- |
| **フロントエンド** | React 19, TypeScript 7.0 (Go Native Engine), Vite 8.1, Vanilla CSS |
| **状態管理** | React Context (Split Context Pattern), `useReducer`, Zustand |
| **バックエンド API** | Node.js (Express), Vercel Serverless Functions |
| **データベース / 認証** | Google Cloud Firestore, Firebase Authentication, Firebase AppCheck |
| **AI 統合** | Google Gemini API (多言語リアルタイム自動翻訳・テキスト生成) |
| **API 仕様書** | OpenAPI 3.0, Swagger UI (`/api/docs`) |
| **テストツール** | Vitest (単体テスト), Playwright (E2E テスト) |

### データベース設計 (ER Diagram)
<p align="center">
  <img src="./docs/images/ER-diagram.png" width="600" alt="ER Diagram" />
</p>

- **Firestore スキーマ構造**: `users`, `groups`, `cheers`, `reports` などの正規化されたデータ構造とサブコレクション設計。

### ディレクトリ構造 & アーキテクチャ (Directory Architecture)
<p align="center">
  <img src="./docs/images/directory-path-architecture.png" width="600" alt="Directory Architecture" />
</p>

- **レイヤー分離アーキテクチャ**: API・Internal・Backend・Frontend の明確な依存分離設計。

---

## API 仕様書 (Swagger UI)

本アプリケーションでは、OpenAPI 3.0 規格に準拠した対話型 API ドキュメントを提供しています。

- **Swagger UI 画面**: `https://scripturehabit.app/api/docs`
- **OpenAPI JSON 定義**: `https://scripturehabit.app/api/openapi.json`

---

## ドキュメント (Technical Documentation)

詳細なアーキテクチャや技術設計ドキュメントは以下をご覧ください。

### 日本語版 (Japanese)
- **[ドキュメント全体の目次](./docs/README.md)**: 全技術ドキュメントのインデックスと概要。
- **[アーキテクチャ設計書](./docs/architecture.md)**: 全体レイヤー (API, Internal, Backend, Frontend) の構造と設計概要。
- **[チャット & ダッシュボード同期設計](./docs/feature-chat-dashboard.md)**: リアルタイム同期と Firestore リスナーの詳細仕様。
- **[ノート投稿 & ストリーク計算ロジック](./docs/logic-note-posting.md)**: 連続学習記録 (Streak)、レベルアップ、トランザクションフローの詳細。

### English Version
- **[Technical Documentation Index](./docs/en/README.md)**: Full index and overview of all technical documents.
- **[Architecture & Structure](./docs/en/architecture.md)**: High-level overview of the layers (API, Internal, Backend, Frontend).
- **[Chat & Dashboard Sync](./docs/en/feature-chat-dashboard.md)**: Deep-dive into real-time synchronization and Firestore listeners.
- **[Note Posting Mechanism](./docs/en/logic-note-posting.md)**: Detailed logic for streaks, levels, and transaction flow.
