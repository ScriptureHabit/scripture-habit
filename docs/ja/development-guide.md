# 開発および環境セットアップガイド

> [!TIP]
> **インタラクティブ・アーキテクチャツアー**: [ブラウザでツアーを開く (アプリ起動 & 全体配線)](https://htmlpreview.github.io/?https://github.com/ScriptureHabit/scripture-habit/blob/main/docs/public/architecture-tour.html?tour=tour-root&lang=ja)

**Scripture Habit** の開発ガイドです。このドキュメントでは、ローカル開発環境の構築、テストの実行、およびプロジェクトへのコントリビューション手順を説明します。

---

## クイックスタート（ローカル環境の立ち上げ）

ローカル開発のために、有料の Firebase アカウントや本番用 API キーを用意する必要は**ありません**。Scripture Habit は、ローカルの Firebase エミュレータ上で動作します。

### 前提条件
- **Node.js**: `>= 22.0.0`（`node -v` で確認）
- **npm**: `>= 10.0.0`
- **Java JRE / JDK**: Firebase エミュレータの実行に必要（`java -version` で確認）

---

### ステップバイステップの手順

#### 1. リポジトリのクローン
```bash
git clone https://github.com/your-username/scripture-habit.git
cd scripture-habit
```

#### 2. 依存パッケージのインストール
```bash
npm install
```

#### 3. 環境変数ファイルの準備
テンプレートファイルをコピーして `.env.local` を作成します：
```bash
# Linux / macOS / Git Bash の場合:
cp .env.example .env.local

# Windows (PowerShell) の場合:
Copy-Item .env.example .env.local
```
> [!NOTE]
> `.env.example` の初期値（プレースホルダー）は、ローカルエミュレータですぐに動くように設定されています。

#### 4. ローカル開発環境の起動

##### 方法 A: 1コマンド全自動起動（推奨）
Firebase エミュレータの起動、初期化待機、Express バックエンドおよび Vite フロントエンドの開発サーバー起動を単一ターミナルでまとめて実行します（データベースはクリーンな初期状態で起動します）：
```bash
npm run dev:all
```
すべてのサービスログが色分けプレフィックス（`[SYS]`, `[EMU]`, `[API]`, `[WEB]`）付きで集約出力されます。`Ctrl+C` を押すと全サービスが一括停止します。

> [!TIP]
> **テストデータの投入（シード）について**:
> - 起動後に別ターミナルで `npm run db:seed:existing`（既存ユーザー・グループ所属データ）または `npm run db:seed:new`（新規ユーザー・初回オンボーディングデータ）を実行して、いつでも好きなタイミングでデータを投入・初期化できます。
> - 起動と同時に自動で既存ユーザーデータを投入したい場合は `npm run dev:all:seed` を実行してください。

##### 方法 B: 個別ターミナルでの起動
サービスを個別のターミナルタブで起動したい場合：
```bash
# 1. Firebase エミュレータの起動
npm run emulators

# 2. ローカル Firestore & Auth エミュレータにテストデータを投入
npm run db:seed

# 3. バックエンド Express サーバーの起動 (localhost:5000)
npm run server

# 4. フロントエンド Vite 開発サーバーの起動 (localhost:5173)
npm run dev
```

起動後、以下のエンドポイントにアクセスできます：
- **フロントエンド Web アプリ**: [http://localhost:5173](http://localhost:5173)
- **バックエンド API**: [http://localhost:5000](http://localhost:5000)
- **エミュレータ UI ダッシュボード**: [http://127.0.0.1:4000](http://127.0.0.1:4000)
- **Firestore エミュレータ**: `127.0.0.1:8080`
- **Auth エミュレータ**: `127.0.0.1:9099`

---

## 環境変数の設定一覧

| 変数名 | 利用スコープ | ローカル開発での必須性 | 説明 |
| :--- | :--- | :---: | :--- |
| `VITE_FIREBASE_API_KEY` | フロントエンド | 不要（初期値のままで動作） | Firebase Web API キー |
| `VITE_FIREBASE_AUTH_DOMAIN` | フロントエンド | 不要（初期値のままで動作） | Firebase Auth ドメイン |
| `VITE_FIREBASE_PROJECT_ID` | フロントエンド | 不要（初期値のままで動作） | Firebase プロジェクト ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | フロントエンド | 不要（初期値のままで動作） | Firebase Storage バケット |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | フロントエンド | 不要（初期値のままで動作） | FCM 送信者 ID |
| `VITE_FIREBASE_APP_ID` | フロントエンド | 不要（初期値のままで動作） | Firebase アプリ ID |
| `VITE_APPCHECK_SITE_KEY` | フロントエンド | 不要（空欄でOK） | reCAPTCHA v3 キー（ローカルでは無効化） |
| `VITE_SENTRY_DSN` | フロントエンド | 不要（空欄でOK） | Sentry エラー監視 DSN |
| `GEMINI_API_KEY` | バックエンド | 任意 | Google Gemini API キー（AI 機能検証時） |
| `CRON_SECRET` | バックエンド | 任意 | 定期実行バッチ用共有シークレット |
| `DISCORD_WEBHOOK_URL` | バックエンド | 任意 | 監視通知用 Discord Webhook URL |

---

## 主な npm スクリプト

| コマンド | 説明 |
| :--- | :--- |
| `npm run dev:all` | 全開発サービス（エミュレータ、バックエンド、フロントエンド）を単一ターミナルで一括起動（DBはクリーン状態） |
| `npm run dev:all:seed` | 全開発サービスを一括起動し、自動でテストデータ（db:seed）を投入 |
| `npm run dev` | Vite 開発サーバーを起動（`localhost:5173`） |
| `npm run server` | バックエンド Express サーバーを起動（`localhost:5000`） |
| `npm run emulators` | Firebase ローカルエミュレータ（Firestore, Auth, Functions）を起動 |
| `npm run build` | プロダクションビルドおよびメタタグの多言語化を実行 |
| `npm run lint` | ESLint によるコード静的解析 |
| `npm run check:all` | 型チェック、多言語翻訳チェック、バックエンド整合性を一括実行 |
| `npm run check:i18n` | 全言語の翻訳キー網羅率を検証 |
| `npm run sort:locales` | 翻訳ファイルのキー順と構造を自動整形 |
| `npm run test` | Vitest によるフロントエンド単体テストを実行 |
| `npm run test:internal` | エミュレータ環境でバックエンド統合テストを実行 |
| `npm run test:rules` | Firestore セキュリティルールの単体テストを実行 |
| `npm run test:e2e` | Playwright による E2E テストを実行 |
| `npm run db:seed` | エミュレータに既存ユーザー環境（グループ所属・ストリークあり）のテストデータを投入（`db:seed:existing` と同等） |
| `npm run db:seed:existing` | エミュレータに既存ユーザー環境（existing-user、グループ「Daily Bread」、ストリーク8日）のデータを投入 |
| `npm run db:seed:new` | エミュレータに新規ユーザー環境（new-user、未所属、初回オンボーディング）のデータを投入 |
| `npm run docs:dev` | VitePress ドキュメントサイトの開発サーバーを起動 |
| `npm run docs:build` | TypeDoc リファレンス自動生成およびドキュメントサイトをビルド |

---

## インタラクティブ・コードツアー（VS Code）

コードベースの理解と迅速なオンボーディングを支援するため、本リポジトリには VS Code 上でソースコードとデータフローを対話型で学べる **CodeTour（全64ツアー）** が用意されています。

### 拡張機能のインストール

Visual Studio Code の拡張機能マーケットプレイスから **[CodeTour](https://marketplace.visualstudio.com/items?itemName=vsls-contrib.codetour)** をインストールしてください。

### ツアーの開始手順

1. VS Code サイドバーの **「CodeTour」** パネルを開く（またはコマンドパレット `Ctrl+Shift+P` / `Cmd+Shift+P` から `CodeTour: Start Tour` を実行）。
2. 一覧から学習したいツアーを選択して開始します：
   - **基礎・フレームワーク編（40ツアー）**:
     - `chat-01` 〜 `chat-08`: グループチャット設計、リアルタイム同期、スクロール制御、多言語翻訳、セキュリティ。
     - `firebase-01` 〜 `firebase-04`: `onSnapshot`、クエリ最適化、サーバータイムスタンプ、Firestore セキュリティルール。
     - `react-01` 〜 `react-09`: `useReducer`、Context API、カスタムフック、Ref 制御、楽観的 UI 更新。
     - `ts-01` 〜 `ts-06`: 判別可能なユニオン型、ジェネリクス、型ガード、`as const`、非同期型定義。
     - `test-01` 〜 `test-04`: Vitest 単体テスト、モック戦略、Firebase エミュレータ統合テスト、Playwright E2E。
     - `node-01` 〜 `node-06`: Express ミドルウェア、環境変数管理、共通エラーハンドリング、レート制限。
   - **アーキテクチャ・データフロー編（24ツアー）**:
     - `arch-01` 〜 `arch-24`: 各主要機能（ユーザー認証、新規ノート作成、習慣ダッシュボード、タイムカプセル、PWA 等）における UI・フック・状態・サービス・インフラ層の End-to-End データリレー。

> [!TIP]
> ブラウザ上でモジュール間の配線図やデータリレーのアニメーションを俯瞰したい場合は、ローカルの [`code-flow.html`](../../code-flow.html) を開くか、[オンライン・アーキテクチャツアー](https://htmlpreview.github.io/?https://github.com/ScriptureHabit/scripture-habit/blob/main/docs/public/architecture-tour.html) を参照してください。

---

## テストと品質検証

プルリクエスト（PR）を作成する前に、以下のチェックが通過することを確認してください：

```bash
# 1. 型チェックおよび静的解析
npm run check:all

# 2. 単体テストの実行
npm run test

# 3. （任意）E2E テストの実行
npm run test:e2e
```

---

## トラブルシューティング

### ポート競合エラー（8080, 9099, 4000）
以前起動したプロセスがポートを掴んでいる場合：
- **Windows (PowerShell)**:
  ```powershell
  Stop-Process -Id (Get-NetTCPConnection -LocalPort 8080).OwningProcess -Force
  ```
- **macOS / Linux**:
  ```bash
  kill -9 $(lsof -t -i:8080)
  ```

### Java が見つからないエラー
Firebase エミュレータの動作には Java が必要です。`Java not found` と表示される場合は、OpenJDK（例: Windowsなら `winget install Microsoft.OpenJDK.21`、Macなら `brew install openjdk`）をインストールしてください。

---

## コントリビューションの流れ

ローカルでの開発とテストが完了したら、以下の手順で Pull Request を作成してください：

1. **作業ブランチの作成**: `main` から作業用ブランチを作成（例: `git checkout -b feat/your-feature-name`）。
2. **コミット**: Conventional Commits に従った分かりやすいコミットメッセージを作成。
3. **品質チェック**: `npm run check:all` および `npm test` がすべてパスすることを確認。
4. **プルリクエストの作成**: 変更理由、動作確認手順、UI変更がある場合はスクリーンショットを添付して PR を提出します。

> ブランチ命名規則、コミットメッセージの書式、翻訳の追加ルール、および行動規範の詳細については、**[コントリビューションガイド (CONTRIBUTING.md)](../../CONTRIBUTING.md)** をご確認ください。
