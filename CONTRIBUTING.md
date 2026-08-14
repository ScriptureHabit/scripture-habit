# Contributing to Scripture Habit

Thank you for your interest in contributing to Scripture Habit. We welcome contributions from developers, designers, translators, and users of all experience levels.

---

## Ways to Contribute

1. **Reporting Bugs**: Open an issue using the Bug Report template, describing the problem, reproduction steps, and environment.
2. **Suggesting Enhancements**: Open an issue describing the feature, its motivation, and proposed user experience.
3. **Improving Translations**: Review existing translations for natural phrasing, or add new language files in `scripture-habit/src/locales/`.
4. **Improving Documentation**: Fix typos, add explanations, or improve developer guides in the `docs/` folder.
5. **Writing Code**: Pick up an existing issue (especially issues labeled `good first issue`) or propose a pull request for a bug fix or feature.

---

## Development Setup

### Prerequisites

- **Node.js**: 24.x or higher
- **npm**: 10.x or higher
- **Git**

### Getting Started

1. **Fork and clone the repository**:
   ```bash
   git clone https://github.com/<your-username>/scripture-habit.git
   cd scripture-habit
   ```

2. **Navigate to the application folder and install dependencies**:
   ```bash
   cd scripture-habit
   npm install
   ```

3. **Start the local development server**:
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:5173`.

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

## Making Changes

### Branch Naming

Create a feature branch from `main` using descriptive names:
- `feat/feature-name` (new features)
- `fix/bug-description` (bug fixes)
- `docs/update-guide` (documentation updates)
- `i18n/language-name` (translations)

### Commit Conventions

We follow Conventional Commits:
- `feat: add spanish audio playback support`
- `fix: correct streak reset calculation for utc offsets`
- `docs: update setup instructions in README`
- `chore: update dependency versions`

### Pull Request Process

1. Push your branch to your GitHub fork.
2. Open a Pull Request against the `main` branch of the upstream repository.
3. Fill out the Pull Request template detailing what was changed, why, and how to verify.
4. Ensure all automated GitHub Actions CI checks pass.
5. A maintainer will review your pull request and provide feedback.

---

## Adding or Updating Translations

Translations are centralized and modular:
- **UI Translations**: `scripture-habit/src/locales/<lang>.ts` (`en.ts` is the master translation file)
- **Scripture Book Names**: `scripture-habit/src/locales/books/<lang>.ts`
- **Language Metadata**: `scripture-habit/src/config/languages.ts`

### 1. Improving Existing Translations
Edit the relevant `src/locales/<lang>.ts` or `src/locales/books/<lang>.ts` file and submit a pull request.

### 2. Adding a New Language
Adding a new language is straightforward:
1. Create `src/locales/<lang>.ts` and `src/locales/books/<lang>.ts` using `en.ts` as a template.
2. Add the new language configuration to `scripture-habit/src/config/languages.ts` (language code, native name, translation key, flag emoji, and Gospel Library language code).
3. Run `npm run check:i18n` to verify full translation key coverage.

---

## Code of Conduct

Please note that this project is released with a [Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project, you agree to abide by its terms.

---

# コントリビューションガイド (Contributing Guide)

Scripture Habit への貢献に関心を持っていただきありがとうございます。開発者、デザイナー、翻訳者、日常のユーザーなど、経験のレベルを問わずどなたからの貢献も歓迎しています。

---

## 貢献の方法

1. **バグの報告**: Bug Report テンプレートを使用して Issue を作成し、発生した問題、再現手順、環境を記載してください。
2. **機能・改善の提案**: Feature Request テンプレートを使用して Issue を作成し、提案する機能や背景、期待する体験を記載してください。
3. **翻訳の改善**: 既存の翻訳の自然な言い回しの確認や、`scripture-habit/src/locales/` への新しい言語ファイルの追加。
4. **ドキュメントの改善**: 誤字脱字の修正、説明の追記、`docs/` フォルダ内の開発ガイドの改善。
5. **コードの実装**: 既存の Issue（特に `good first issue` ラベルが付いたもの）の対応や、バグ修正・機能追加の Pull Request の作成。

---

## 開発環境のセットアップ

### 前提条件

* **Node.js**: 24.x 以上
* **npm**: 10.x 以上
* **Git**

### 手順

1. **リポジトリのフォークとクローン**:
   ```bash
   git clone https://github.com/<your-username>/scripture-habit.git
   cd scripture-habit
   ```

2. **アプリフォルダに移動して依存関係をインストール**:
   ```bash
   cd scripture-habit
   npm install
   ```

3. **ローカル開発サーバーの起動**:
   ```bash
   npm run dev
   ```
   ブラウザで `http://localhost:5173` にアクセスして動作を確認できます。

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

## 変更と Pull Request の作成手順

### ブランチの命名規則

`main` ブランチから作業用ブランチを作成してください：
* `feat/機能名`（新機能の追加）
* `fix/修正内容`（バグ修正）
* `docs/ドキュメント内容`（ドキュメントの修正）
* `i18n/言語名`（翻訳の追加・修正）

### コミットメッセージの規則

Conventional Commits に準拠しています：
* `feat: add spanish audio playback support`
* `fix: correct streak reset calculation for utc offsets`
* `docs: update setup instructions in README`
* `chore: update dependency versions`

### Pull Request の流れ

1. 変更ブランチをご自身の GitHub フォークにプッシュします。
2. 本リポジトリの `main` ブランチに対して Pull Request を作成します。
3. PR テンプレートに沿って、変更内容、理由、確認方法を記入してください。
4. GitHub Actions による自動 CI テストがすべてパスすることを確認します。
5. メンテナーがレビューを行い、フィードバックをお返しします。

---

## 翻訳の追加・修正について

本プロジェクトの翻訳システムは一元化され、モジュール化されています：
* **UI翻訳ファイル**: `scripture-habit/src/locales/<言語コード>.ts`（`en.ts` がマスターファイル）
* **聖典の書名翻訳ファイル**: `scripture-habit/src/locales/books/<言語コード>.ts`
* **言語メタデータ設定**: `scripture-habit/src/config/languages.ts`

### 1. 既存言語の修正・改善
該当する `src/locales/<lang>.ts` や `src/locales/books/<lang>.ts` を直接修正し、Pull Request を送信してください。

### 2. 新しい言語の追加
新しい言語の追加は以下の簡単な手順で行えます：
1. `en.ts` をテンプレートとして、`src/locales/<lang>.ts` と `src/locales/books/<lang>.ts` を作成します。
2. `src/config/languages.ts` に新しい言語の設定（コード、ネイティブ言語名、翻訳キー、国旗絵文字、福音ライブラリ言語コード）を1行追加します。
3. `npm run check:i18n` を実行して、翻訳キーの漏れがないかを確認します。

---

## 行動規範 (Code of Conduct)

本プロジェクトには [行動規範 (CODE_OF_CONDUCT.md)](CODE_OF_CONDUCT.md) が適用されます。参加にあたっては、この規範の遵守をお願いいたします。

