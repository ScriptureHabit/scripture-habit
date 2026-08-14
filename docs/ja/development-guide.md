# 開発および環境セットアップガイド

**Scripture Habit** の開発ガイドです。このドキュメントでは、ローカル開発環境の構築、テストの実行、およびプロジェクトへのコントリビューション手順を説明します。

---

## クイックスタート（ローカル環境の立ち上げ）

ローカル開発のために、有料の Firebase アカウントや本番用 API キーを用意する必要は**ありません**。Scripture Habit は、ローカルの Firebase エミュレータ上で完全に動作します。

### 前提条件
- **Node.js**: `>= 22.0.0`（`node -v` で確認）
- **npm**: `>= 10.0.0`
- **Java JRE / JDK**: Firebase エミュレータの実行に必要（`java -version` で確認）

---

### ステップバイステップの手順

#### 1. リポジトリのクローン
```bash
git clone https://github.com/your-username/scripture-habit.git
cd scripture-habit/scripture-habit
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

#### 4. Firebase エミュレータの起動
ターミナルでエミュレータを起動します：
```bash
npm run emulators
# または: npx firebase emulators:start --project scripture-habit-auth
```
起動すると、以下のローカルエンドポイントが利用可能になります：
- **エミュレータ UI ダッシュボード**: [http://127.0.0.1:4000](http://127.0.0.1:4000)
- **Firestore エミュレータ**: `127.0.0.1:8080`
- **Auth エミュレータ**: `127.0.0.1:9099`

#### 5. テスト用データの投入（シード）
**新しいターミナルタブ/ウィンドウ**を開き、シードスクリプトを実行してテスト用のユーザー、学習グループ、カレンダー、ストリーク、チャット履歴を一括で作成します：
```bash
npm run db:seed
```
> [!TIP]
> **何度でも実行可能（冪等性）**: データベースを初期状態にリセットしたいときは、いつでも `npm run db:seed` を再実行できます。

#### 6. 開発サーバーの起動
ターミナルで以下を実行します：
```bash
npm run dev
```
ブラウザで **[http://localhost:5173](http://localhost:5173)** を開いて動作を確認します。

---

## 環境変数リファレンス

| 変数名 | スコープ | ローカル開発で必須？ | 説明 |
| :--- | :--- | :---: | :--- |
| `VITE_FIREBASE_API_KEY` | フロントエンド | 不要（初期値のままでOK） | Firebase Web API キー |
| `VITE_FIREBASE_AUTH_DOMAIN` | フロントエンド | 不要（初期値のままでOK） | Firebase Auth ドメイン |
| `VITE_FIREBASE_PROJECT_ID` | フロントエンド | 不要（初期値のままでOK） | Firebase プロジェクト ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | フロントエンド | 不要（初期値のままでOK） | Firebase Storage バケット |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | フロントエンド | 不要（初期値のままでOK） | FCM 送信者 ID |
| `VITE_FIREBASE_APP_ID` | フロントエンド | 不要（初期値のままでOK） | Firebase アプリ ID |
| `VITE_APPCHECK_SITE_KEY` | フロントエンド | 不要（空欄でOK） | reCAPTCHA v3 キー（ローカルでは無効化） |
| `VITE_SENTRY_DSN` | フロントエンド | 不要（空欄でOK） | Sentry エラーログ送信先 |
| `GEMINI_API_KEY` | バックエンド | 任意 | AI 自動翻訳 / 週間レター生成用の Google Gemini API キー |
| `CRON_SECRET` | バックエンド | 任意 | 定期実行 / メンテナンス用共有シークレット |
| `DISCORD_WEBHOOK_URL` | バックエンド | 任意 | 内部監視アラート用 Discord Webhook |

---

## 主な npm スクリプト

| コマンド | 説明 |
| :--- | :--- |
| `npm run dev` | Vite 開発サーバーを起動（`localhost:5173`） |
| `npm run server` | バックエンド Express サーバーを起動（`localhost:5000`） |
| `npm run build` | プロダクションビルドおよびメタタグの多言語化を実行 |
| `npm run lint` | ESLint によるコード静的解析 |
| `npm run check:all` | 型チェック、多言語翻訳チェック、FCM 型検証を一括実行 |
| `npm run test` | Vitest による単体・統合テストを実行 |
| `npm run test:e2e` | Playwright による E2E テストを実行 |
| `npm run db:seed` | エミュレータにテスト用ユーザー・グループ・履歴データを投入 |

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

1. **フォーク＆ブランチ作成**: `main` から作業用ブランチを作成（`git checkout -b feature/your-feature-name`）。
2. **コミット**: 変更内容が分かりやすいコミットメッセージを作成。
3. **コーディング規約**: React フックのルールを遵守し、`/types` の型定義を活用。
4. **プルリクエストの作成**: 変更内容の説明や、UI変更がある場合はスクリーンショット/GIFを添付してPRを作成してください。
