# 開発および環境セットアップ

このガイドでは、ローカル、Web、およびモバイル環境向けに **scripture-habit** プラットフォームをセットアップ、ビルド、デプロイする方法について説明します。

---

## 環境変数

`.env` ファイルに以下の変数が含まれていることを確認してください。

| 変数 | スコープ | 用途 |
| :--- | :--- | :--- |
| `VITE_FIREBASE_...` | フロントエンド | React アプリ用の公開 Firebase 設定。 |
| `GEMINI_API_KEY` | バックエンド | Gemini 3.1 AI 機能にアクセスするための API キー。 |
| `CRON_SECRET` | バックエンド | メンテナンス/cron リクエストの認証用共有シークレット。 |
| `VITE_SENTRY_DSN` | フロントエンド | Sentry のエラーおよびパフォーマンスレポート用エンドポイント。 |

---

## ローカル開発ワークフロー

### 1. フロントエンド (Vite)
Vite 開発サーバーを実行するには：
```bash
npm install
npm run dev
```

### 2. バックエンド (Node/Express)
バックエンドコードは `api_internal` に配置されています（Vercel 用にルートレベルで設定されています）。
```bash
npm run server
```
- **ノート**: ローカルでは、サーバーはポート 3001（設定可能）で動作します。ローカルテスト中は、フロントエンドの `API_BASE` が正しく設定されていることを確認してください。

---

## モバイル開発 (Capacitor)

モバイルアプリは **Capacitor 8** を使用しています。

### Android 開発（ライブリロード）
リアルタイム更新を反映しながら Android で開発およびテストを行うには、**ライブリロード（Livereload）**を使用します。
```bash
# 1. ネイティブプラグインの同期
npx cap sync android

# 2. ライブリロードで実行
# [LOCAL_IP] をマシンの IP（例：192.168.1.10）に置き換えてください
npx cap run android --livereload --external
```
これにより、Android の WebView が Vite 開発サーバーに接続され、ライブアップデートを適用しながらネイティブ機能（Google 認証など）をテストできます。

### よくあるトラブルシューティング
- **HTTPS/SSL**: Capacitor の WebView は、ローカル IP への HTTP トラフィックをブロックすることがあります。ローカル開発用には、`AndroidManifest.xml` で `android:usesCleartextTraffic` が `true` に設定されていることを確認してください。
- **プラグインの同期**: 新しい `@capacitor` パッケージを追加した場合は、ネイティブプロジェクトを更新するために必ず `npx cap sync` を実行してください。

---

## デプロイおよびインフラストラクチャ

### 1. バックエンド: Vercel Functions
バックエンドは Vercel 上でサーバーレス関数として動作します。
- **ルーティング**: `vercel.json` はすべての `/api/*` リクエストを `api/api.ts` エントリーポイントにマッピングします。
- **コールドスタート**: コールドスタート時間を短縮するため、`api_internal/lib/firebase-admin.ts` はメインのリクエストハンドラーの外部で初期化されます。

### 2. フロントエンド: Firebase Hosting
フロントエンドは Firebase Hosting にデプロイされます。
```bash
npm run build
firebase deploy --only hosting
```
- **アセット**: Vite はビルド中に JS および CSS ファイルを最小化（minify）します。
- **キャッシュ制御**: `firebase.json` は、即時アップデートのために `index.html` がキャッシュされないように設定されている一方、静的アセットは 1 年間キャッシュされます。

---

## コードスタイルと型安全性
- **型チェック**: プルリクエストを送信する前に `tsc -b` を実行し、`/types` 内の型が正しいことを確認してください。
- **リンター**: React フックの依存関係（`useEffect` 配列）をチェックするように ESLint が設定されています。
