# Contributing to Scripture Habit

Thank you for your interest in contributing to Scripture Habit. We welcome contributions from developers, designers, translators, and users of all experience levels.

> [!TIP]
> **You don't need to understand the whole codebase!** Pick a feature in [`/docs`](docs/README.md) that interests you and start small.

---

## Ways to Contribute

1. **Reporting Bugs**: Open an issue using the Bug Report template, describing the problem, reproduction steps, and environment.
2. **Suggesting Enhancements**: Open an issue describing the feature, its motivation, and proposed user experience.
3. **Improving Translations**: Review existing translations for natural phrasing, or add new language files in `scripture-habit/src/locales/`.
4. **Improving Documentation**: Fix typos, add explanations, or improve developer guides in the `docs/` folder.
5. **Writing Code**: Pick up an existing issue (especially issues labeled `good first issue`) or propose a pull request for a bug fix or feature.

---

## Where to Start: Quick Navigation by Feature

You do not need to understand every layer of Scripture Habit to make a meaningful contribution. Find a feature or topic below that sparks your interest, review its dedicated guide, and start small:

| Feature / Domain | Documentation | Key Files & Directories | Test / Verification |
| :--- | :--- | :--- | :--- |
| **Translations & i18n** | [logic-i18n.md](docs/logic-i18n.md) | `src/locales/*.ts` | `npm run check:all` |
| **AI Integration & Prompts** | [feature-ai-integration.md](docs/feature-ai-integration.md) | `api_internal/routes/ai.ts` | `npm test` |
| **Scripture Links & Mapper** | [gospel-library-mapper.md](docs/gospel-library-mapper.md) | `src/utils/gospelLibraryMapper.ts` | `npm test` |
| **UI & Design System** | [design-system.md](docs/design-system.md) | `src/components/*`, `src/index.css` | `npm run dev` |
| **Note Creation & Streaks** | [logic-note-posting.md](docs/logic-note-posting.md) | `src/services/noteService.ts`, `src/utils/streakUtils.ts` | `npm test` |
| **Group Chat & Real-Time Sync** | [groupchat-construction-guide.md](docs/groupchat-construction-guide.md) | `src/components/chat/*`, `src/services/chatService.ts` | `npm test` |
| **Push Notifications & FCM** | [feature-notifications.md](docs/feature-notifications.md) | `src/services/fcmService.ts` | `npm test` |
| **Backend API & Middleware** | [api-middleware-error-handling.md](docs/api-middleware-error-handling.md) | `api_internal/middleware/*`, `api_internal/routes/*` | `npm test` |
| **Firebase Security & Rules** | [firebase-security-rules.md](docs/firebase-security-rules.md) | `firestore.rules`, `firestore.indexes.json` | `npm run check:all` |

---

## Development Setup

For a quick start:
1. **Fork and clone the repository**:
   ```bash
   git clone https://github.com/<your-username>/scripture-habit.git
   cd scripture-habit
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Start local development**:
   ```bash
   # Copy environment file
   cp .env.example .env.local

   # Option A: Start all services in one command (Recommended, starts with clean DB)
   npm run dev:all

   # (Optional) Seed test data on demand in another terminal:
   # npm run db:seed:existing   # Existing user (existing-user, group members, streak)
   # npm run db:seed:new        # Fresh new user (new-user, 0 streaks, onboarding)
   # Or start everything with seed: npm run dev:all:seed

   # Option B: Start services individually in separate terminals
   npm run emulators
   npm run db:seed
   npm run server
   npm run dev
   ```

> For step-by-step instructions, Firebase Emulator configuration, environment variable reference, and troubleshooting, please see the **[Development & Setup Guide](docs/development-guide.md)** (or **[日本語版](docs/ja/development-guide.md)**).

---

## Testing & Quality Checks

Before submitting changes, ensure all tests and type checks pass:

```bash
# Run unit tests (Vitest)
npm test

# Run all verification checks (i18n check, message types, FCM usage, and TypeScript compiler)
npm run check:all

# Run linter
npm run lint

# Build production bundle to verify types and assets
npm run build
```

---

## Making Changes & Git Workflow

We follow the **GitHub Flow** model with **Trunk-Based Development** principles to ensure high development velocity and safe, reliable deployments.

### 1. Branch Strategy (GitHub Flow)

- `main` branch is always stable, passing tests, and deployable.
- Always create a new branch from `main` before starting any work.
- **Keep branches short-lived:** Aim to merge branches within 1 to 2 days to prevent merge conflicts.
- **Keep Pull Requests small and focused:** Smaller PRs (100–300 lines) are reviewed and merged much faster.
- **Delete branches after merging:** Clean up local and remote feature branches once merged into `main`.

### 2. Branch Naming Conventions

Use clear, standardized prefixes for your branches:

| Prefix | Purpose | Example |
| :--- | :--- | :--- |
| `feat/` | New features or functionality | `feat/ai-group-limit`, `feat/audio-alert` |
| `fix/` | Bug fixes and patches | `fix/quest-celebration-popup` |
| `refactor/` | Code refactoring without behavior change | `refactor/user-profile-modal` |
| `perf/` | Performance optimizations | `perf/translation-cache` |
| `docs/` | Documentation updates | `docs/update-contributing-guide` |
| `chore/` | Tooling, dependencies, or CI/CD updates | `chore/upgrade-dependencies` |

### 3. Commit Message Conventions

We follow **Conventional Commits**:
- `feat(ai-group): enforce 1 AI group per user and update card UI`
- `fix(quest-modal): prevent unwanted celebration modal on page reload`
- `docs(contributing): add git branch best practices`
- `refactor(profile): hide stats section for AI bot accounts`
- `chore(deps): update npm packages`

### 4. Pull Request Process

1. Push your branch to your GitHub fork or repository.
2. Open a Pull Request targeting the `main` branch.
3. Fill out the Pull Request template detailing what was changed, why, and how to verify.
4. Ensure all automated GitHub Actions CI checks (`npm test`, `npm run check:all`, `npm run lint`) pass.
5. Once approved by a maintainer and merged, delete your feature branch.

---

## Adding or Updating Translations

Translations are centralized and modular:
- **UI Translations & Master Keys**: `src/locales/en.ts` (`en.ts` is the master translation file)
- **Language Configurations**: `src/locales/<lang>.ts` (e.g. `ja.ts`, `es.ts`, `zho.ts`)

### 1. Improving Existing Translations
Edit the relevant `src/locales/<lang>.ts` file and submit a pull request.

### 2. Adding a New Language
Adding a new language is simple:
1. Copy `src/locales/en.ts` to `src/locales/<lang>.ts` (e.g. `fr.ts`, `de.ts`) and translate the values.
2. Update the `_meta` configuration at the top of the file (native name, flag emoji, LDS 3-letter code).
3. Run `npm run check:i18n` to verify 100% key coverage. All configurations, types, and metadata are synchronized automatically (Zero-Config).

> **Important Notes for Translators:**
> - **Preserve Placeholders:** Keep variables inside curly braces (e.g. `{nickname}`, `{streak}`, `{count}`, `{days}`) unchanged in your translations.
> - **Gospel Library Code (`ldsCode`):** Church websites use 3-letter language codes for `ldsCode` (e.g. `fra` for French, `deu` for German, `ita` for Italian).

---

## Code of Conduct

Please note that this project is released with a [Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project, you agree to abide by its terms.

---

# コントリビューションガイド (Contributing Guide)

Scripture Habit への貢献に関心を持っていただきありがとうございます。開発者、デザイナー、翻訳者、日常のユーザーなど、経験のレベルを問わずどなたからの貢献も歓迎しています。

> [!TIP]
> **コードベース全体を理解する必要はありません！** [`/docs`](docs/ja/README.md) から気になる機能を1つ選んで、小さなところから気軽に始めてみてください。

---

## 貢献の方法

1. **バグの報告**: Bug Report テンプレートを使用して Issue を作成し、発生した問題、再現手順、環境を記載してください。
2. **機能・改善の提案**: Feature Request テンプレートを使用して Issue を作成し、提案する機能や背景、期待する体験を記載してください。
3. **翻訳の改善**: 既存の翻訳の自然な言い回しの確認や、`scripture-habit/src/locales/` への新しい言語ファイルの追加。
4. **ドキュメントの改善**: 誤字脱字の修正、説明の追記、`docs/` フォルダ内の開発ガイドの改善。
5. **コードの実装**: 既存の Issue（特に `good first issue` ラベルが付いたもの）の対応や、バグ修正・機能追加の Pull Request の作成。

---

## はじめに：機能別のクイック逆引き表

Scripture Habit に貢献するために、すべての機能を理解しておく必要はありません。興味のある領域や機能を見つけ、専用ガイドを読んで小さなところから着手してみてください：

| 機能 / 領域 | ドキュメント | 主な関連ファイル・ディレクトリ | テスト・検証コマンド |
| :--- | :--- | :--- | :--- |
| **翻訳・多言語対応 (i18n)** | [logic-i18n.md](docs/ja/logic-i18n.md) | `src/locales/*.ts` | `npm run check:all` |
| **AI 連携・プロンプト改善** | [feature-ai-integration.md](docs/ja/feature-ai-integration.md) | `api_internal/routes/ai.ts` | `npm test` |
| **聖典リンク・URLマッパー** | [gospel-library-mapper.md](docs/ja/gospel-library-mapper.md) | `src/utils/gospelLibraryMapper.ts` | `npm test` |
| **UI・デザインシステム** | [design-system.md](docs/ja/design-system.md) | `src/components/*`, `src/index.css` | `npm run dev` |
| **ノート作成・ストリーク計算** | [logic-note-posting.md](docs/ja/logic-note-posting.md) | `src/services/noteService.ts`, `src/utils/streakUtils.ts` | `npm test` |
| **グループチャット・リアルタイム同期** | [groupchat-construction-guide.md](docs/ja/groupchat-construction-guide.md) | `src/components/chat/*`, `src/services/chatService.ts` | `npm test` |
| **プッシュ通知・FCM** | [feature-notifications.md](docs/ja/feature-notifications.md) | `src/services/fcmService.ts` | `npm test` |
| **バックエンドAPI・ミドルウェア** | [api-middleware-error-handling.md](docs/ja/api-middleware-error-handling.md) | `api_internal/middleware/*`, `api_internal/routes/*` | `npm test` |
| **Firebase セキュリティ・DBルール** | [firebase-security-rules.md](docs/ja/firebase-security-rules.md) | `firestore.rules`, `firestore.indexes.json` | `npm run check:all` |

---

## 開発環境のセットアップ
 
クイックスタート：
1. **リポジトリのフォークとクローン**:
   ```bash
   git clone https://github.com/<your-username>/scripture-habit.git
   cd scripture-habit
   ```
2. **依存関係のインストール**:
   ```bash
   npm install
   ```
3. **ローカル開発環境の起動**:
   ```bash
   # 環境変数ファイルの作成
   cp .env.example .env.local

   # 推奨: 1コマンドで全サービスを一括起動（DBはクリーンな状態で起動）
   npm run dev:all

   # （任意）別ターミナルで必要に応じてテストデータを投入:
   # npm run db:seed:existing   # 既存ユーザー環境（existing-user、グループ所属、ストリークあり）
   # npm run db:seed:new        # 新規ユーザー環境（new-user、未所属、初回オンボーディング）
   # または最初からシード込みで一括起動: npm run dev:all:seed

   # または個別ターミナルで起動する場合:
   npm run emulators
   npm run db:seed
   npm run server
   npm run dev
   ```

> ステップバイステップの詳細な環境構築手順、Firebase エミュレータの設定、環境変数リファレンス、およびトラブルシューティングについては、**[開発および環境セットアップガイド (docs/ja/development-guide.md)](docs/ja/development-guide.md)** をご覧ください。

---

## テストと品質チェック

Pull Request を送信する前に、すべてのテストと型チェックが通ることを確認してください：

```bash
# 単体テストの実行 (Vitest)
npm test

# 全チェックの実行（i18n翻訳漏れチェック、メッセージ型、FCM利用、TypeScript型チェック）
npm run check:all

# リントチェック
npm run lint

# プロダクションビルドの確認
npm run build
```

---

## 変更と Git ワークフロー

本プロジェクトでは、開発速度の向上と安全で信頼性の高いデプロイを両立するため、**GitHub Flow** および **トランクベース開発（Trunk-Based Development）** の原則を採用しています。

### 1. ブランチ戦略（GitHub Flow）

- `main` ブランチは常に安定し、テストが通過したデプロイ可能な状態を維持します。
- 作業を始める際は、必ず `main` ブランチから新しいブランチを作成してください。
- **ブランチの寿命を短く保つ:** コンフリクトを防ぐため、1〜2 日程度でマージできる粒度を推奨します。
- **Pull Request を小さく保つ:** 100〜300 行程度の小さく焦点を絞った PR は、レビューとマージが迅速に行えます。
- **マージ後のブランチ削除:** `main` にマージされたローカルおよびリモートのブランチは速やかに削除します。

### 2. ブランチの命名規則

用途が一目で分かるように、統一された接頭辞を使用してください：

| 接頭辞 | 用途 | 例 |
| :--- | :--- | :--- |
| `feat/` | 新機能・機能追加 | `feat/ai-group-limit`, `feat/audio-alert` |
| `fix/` | バグ修正・パッチ | `fix/quest-celebration-popup` |
| `refactor/` | 振る舞いを変えないコードのリファクタリング | `refactor/user-profile-modal` |
| `perf/` | パフォーマンス改善 | `perf/translation-cache` |
| `docs/` | ドキュメントの修正・追記 | `docs/update-contributing-guide` |
| `chore/` | ビルド設定、依存ライブラリ、CI/CD の更新 | `chore/upgrade-dependencies` |

### 3. コミットメッセージの規則

**Conventional Commits** に準拠しています：
* `feat(ai-group): enforce 1 AI group per user and update card UI`
* `fix(quest-modal): prevent unwanted celebration modal on page reload`
* `docs(contributing): add git branch best practices`
* `refactor(profile): hide stats section for AI bot accounts`
* `chore(deps): update npm packages`

### 4. Pull Request の流れ

1. 変更ブランチをご自身の GitHub フォークまたは本リポジトリにプッシュします。
2. `main` ブランチに対して Pull Request を作成します。
3. PR テンプレートに沿って、変更内容、理由、確認方法を記入してください。
4. GitHub Actions による自動 CI テスト（`npm test`, `npm run check:all`, `npm run lint`）がすべてパスすることを確認します。
5. メンテナーのレビューと承認を受けマージされたら、作業ブランチを削除します。

---

## 翻訳の追加・修正について

本プロジェクトの翻訳システムは **完全な 1 ファイル完結型（Single Source of Truth & Zero-Config）** です。UI文言、プッシュ通知、AI投稿、聖典の書名、言語メタデータがすべて 1 つのファイルにまとまっています：

* **翻訳マスターファイル**: `src/locales/en.ts`
* **各言語ファイル**: `src/locales/<言語コード>.ts`

### 1. 既存言語の修正・改善
該当する `src/locales/<lang>.ts` を直接修正し、Pull Request を送信してください。

### 2. 新しい言語の追加（たったの 2 ステップ）
1. `src/locales/en.ts` をコピーして、新しい言語ファイル `src/locales/<lang>.ts`（例: `fr.ts`, `de.ts`）を作成・翻訳します。
   * ファイル先頭の `_meta`（言語コード、言語名、国旗絵文字、LDSコード）も設定します。
2. `npm run check:i18n` を実行して、未翻訳のキー漏れがないか確認します。
   * 言語一覧（`languages.ts`）や型定義、聖典メタデータへの登録は **完全自動（Zero-Config）** で行われます！

> **翻訳時の注意点:**
> - **変数のプレースホルダー:** `{nickname}`, `{streak}`, `{count}`, `{days}` などの波括弧で囲まれた変数名は翻訳せず、そのまま残してください。
> - **福音ライブラリ言語コード (`ldsCode`):** 教会公式 URL で使われる 3 文字の言語コード（例: フランス語は `fra`、ドイツ語は `deu`、イタリア語は `ita`）を指定してください。

---

## 行動規範 (Code of Conduct)

本プロジェクトには [行動規範 (CODE_OF_CONDUCT.md)](CODE_OF_CONDUCT.md) が適用されます。参加にあたっては、この規範の遵守をお願いいたします。

