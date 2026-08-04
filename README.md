# Scripture Habit (スクハビ)

毎日の聖句学習を仲間と一緒に習慣化する、AIリアルタイム翻訳＆グループ機能付きコミュニティWebアプリ

🌐 **Web Application**: [https://scripturehabit.app](https://scripturehabit.app)

<p align="center">
  <img src="https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-20.x-5FA04E?style=for-the-badge&logo=nodedotjs" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express" alt="Express" />
  <img src="https://img.shields.io/badge/Firebase-Firestore%2FAuth-FFCA28?style=for-the-badge&logo=firebase" alt="Firebase" />
</p>

---

## 概要

**Scripture Habit** は、一人だと挫折しがちな聖典学習を、仲間と一緒に楽しく継続するためのWebアプリです。レベルや連続学習日数（ストリーク）の仕組みに加えて、Gemini AIによるリアルタイム自動翻訳を備えており、国や言語を超えてグループで学習ノートを共有できます。

### 開発背景
- **課題**: 毎日の個人学習は継続が難しく、海外の友人と一緒に学びたくても言語の壁がある。
- **解決策**: グループ機能とストリーク管理で学習を習慣化し、Gemini AI のリアルタイム自動翻訳で言語の異なるメンバーともスムーズに交流できる環境を作りました。

---

## 📊 運用データ

実際に公開・運用を行っており、日々の学習アクティブユーザー数やノート投稿数を記録しています。現在、1日平均10人以上のユーザーがこのアプリで継続的にノートを投稿しています。

- 📈 **[日別ノート投稿ユーザー数 (Google スプレッドシート)](https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/edit?usp=sharing)**

---

## 主な機能

### 1. ダッシュボード
<p align="center">
  <img src="./docs/images/dashboard.png" width="340" alt="ダッシュボード" />
</p>

- **レベル & ストリーク表示**: 毎日のノート作成で連続学習日数やレベルが上がり、成長を実感できます。
- **今日の学習箇所ガイド**: その日読むべき範囲が自動表示され、ワンタップで対象ページを開けます。

---

### 2. ノート作成
<p align="center">
  <img src="./docs/images/create-note.png" width="320" alt="ノート作成" />
</p>

- **ノートエディタ**: 日々の気づきや感想を記録して保存します。
- **アトミックな更新処理**: ノート保存時に Firestore トランザクションを実行し、ストリーク計算・チャット同期・データ更新をまとめて安全に行います。

---

### 3. マイノート・振り返り
<p align="center">
  <img src="./docs/images/my-notes.png" width="250" alt="マイノート" />
  <img src="./docs/images/weekly-letter.png" width="250" alt="ウィークリーレター" />
</p>

- **検索 & フィルタリング**: タグやキーワードで過去の学習ノートをすぐに検索できます。
- **AI ウィークリーレター**: 1週間のノート内容を Gemini AI が読み取り、振り返りのフィードバックを届けてくれます。

---

### 4. グループチャット & 多言語対応
<p align="center">
  <img src="./docs/images/group-chat.png" width="250" alt="グループチャット" />
  <img src="./docs/images/languages.png" width="250" alt="多言語設定" />
</p>

- **聖句リンク自動変換**: メッセージ内の聖句参照を自動的に読みやすいリンクに変換します。
- **AI リアルタイム自動翻訳**: 海外メンバーのメッセージや名前を即座に自動翻訳します。

---

### 5. 習慣化ルール & 設定
<p align="center">
  <img src="./docs/images/habit-rule.png" width="230" alt="習慣化ルール" />
  <img src="./docs/images/profile.png" width="230" alt="プロフィール" />
  <img src="./docs/images/setting.png" width="230" alt="設定画面" />
</p>

- **マイ習慣ルール**: マンネリを防ぐため、自分なりの学習ルールを設定できます。
- **プロフィール設定**: アバター、言語、通知などを柔軟にカスタマイズ可能です。

---

## 💡 技術的な工夫と解決した課題

### 1. チャットを開かずにノート投稿した際の新着位置（アンカー）ズレの修正

- **課題**:
  一般的なチャットアプリは「チャットを開いて既読にする」挙動を前提としていますが、本アプリでは**「チャットを開かず、ダッシュボードからノート投稿だけを毎日続けるユーザー」**という利用パターンが発生しました。
  この場合、既読位置が昔のまま残ってしまうため、久しぶりにチャットを開いた際に「どこからが新着メッセージか」の位置（アンカー）が大きくずれる問題がありました。

- **解決策**:
  1. **ノート投稿時の既読タイムスタンプ更新**:
     ノート保存の Firestore トランザクション内で、`lastReadTimestamp`（最終既読時刻）も自動更新。「ノート投稿＝アプリで活動した」とみなすロジックに変更しました。
  2. **新着アンカー計算のロジック化 (`computeUnreadAnchorId`)**:
     取得したメッセージ配列をタイムスタンプ順に並べ、「直近のノート投稿時刻より後に届いた最初のメッセージ」を新着位置として特定する純粋関数を作成しました。
  3. **Vitest によるテスト作成**:
     「チャットを開かずノートだけ投稿」「未読と既読が混ざる」など 6 パターンの表示シナリオを書き、単体テストで動作を検証しました。

### 2. Split Context による不要な再描画の削減
- **課題**: 1つの React Context に状態をまとめると、チャットメッセージを受信するたびに画面全体が再描画され、入力パフォーマンスが低下する懸念がありました。
- **解決策**: 状態と操作を `DataContext`, `MessageActionsContext`, `GroupActionsContext`, `UIActionsContext` の 4 つに分割（Split Context）。不要なコンポーネントの再描画を抑えました。

---

## 🛡️ セキュリティ & テスト

- **セキュリティ**: Firebase AppCheck と Zod による入力値バリデーション
- **エラー監視**: Sentry を導入し、本番環境でのエラーログを追跡
- **テスト**: Vitest（単体テスト）と Playwright（E2Eテスト）によるリグレッション防止

---

## 技術スタック

| カテゴリ | 使用技術 |
| :--- | :--- |
| **フロントエンド** | React 19, TypeScript 7, Vite, Vanilla CSS |
| **状態管理** | React Context (Split Context), `useReducer`, Zustand |
| **バックエンド API** | Node.js, Express, Vercel Serverless Functions |
| **データベース / 認証** | Google Cloud Firestore, Firebase Authentication, Firebase AppCheck |
| **AI** | Google Gemini API (自動翻訳・ウィークリーレター生成) |
| **API ドキュメント** | OpenAPI 3.0, Swagger UI (`/api/docs`) |
| **テスト** | Vitest (単体テスト), Playwright (E2E テスト) |

### データベース設計 (ER図)
<p align="center">
  <img src="./docs/images/ER-diagram.png" width="850" alt="ER Diagram" />
</p>

### ディレクトリ構造
<p align="center">
  <img src="./docs/images/directory-path-architecture.png" width="850" alt="Directory Architecture" />
</p>

---

## API 仕様書 (Swagger UI)

OpenAPI 3.0 に準拠した Swagger UI を公開しています。

- **Swagger UI 画面**: `https://scripturehabit.app/api/docs`
- **OpenAPI JSON**: `https://scripturehabit.app/api/openapi.json`

---

## ドキュメント

### 日本語版
- **[ドキュメント目次](./docs/README.md)**: 各技術ドキュメントのインデックス。
- **[アーキテクチャ設計書](./docs/architecture.md)**: ディレクトリ構造と全体レイヤーの解説。
- **[チャット & ダッシュボード同期設計](./docs/feature-chat-dashboard.md)**: リアルタイム同期と Firestore リスナーの仕様。
- **[ノート投稿 & ストリーク計算ロジック](./docs/logic-note-posting.md)**: 連続学習記録、レベルアップ、トランザクションの詳細。

### English Version
- **[Technical Documentation Index](./docs/en/README.md)**
- **[Architecture & Structure](./docs/en/architecture.md)**
- **[Chat & Dashboard Sync](./docs/en/feature-chat-dashboard.md)**
- **[Note Posting Mechanism](./docs/en/logic-note-posting.md)**
