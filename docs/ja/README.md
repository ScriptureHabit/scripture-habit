# 技術ドキュメント インデックス (Technical Documentation Index)

**scripture-habit** の技術ドキュメントへようこそ。このディレクトリには、アプリケーションのアーキテクチャ、機能、およびコアロジックに関する詳細が記載されています。

---

## 📚 一般アーキテクチャ (General Architecture)
- **[アーキテクチャ & 構成](architecture.md)**
  - ディレクトリ構成のハイレベルな概要。
  - レイヤー定義（API、内部、バックエンド、フロントエンド）。
- **[データベース & セキュリティ](database-security.md)**
  - Firestore の構造とパスベースの権限。
  - メール確認と AppCheck 保護ガード。
- **[App Check & API 保護](security-architecture.md)**
  - ゲートウェイミドルウェアガード、トークン検証、および開発バイパス制御ポリシー。
- **[API ミドルウェア アーキテクチャ & 標準エラーハンドリング](api-middleware-error-handling.md)**
  - Express CORS 検証、Vercel TrailingSlash 修正、レート制限、カスタム AppError クラス、およびグローバル Sentry トラッキング。
- **[Firebase セキュリティルール & CQRS 書込分離](firebase-security-rules.md)**
  - 多層認証、カスタム検証制限、およびバックエンド専用の CQRS 書き込みルール。
- **[AI コンテキストガイド & 開発憲章](ai-context.md)**
  - LLM（開発用AI）向けの必須指示、およびリポジトリ全体のシステム設計制約。
  - 状態境界、ロジック・コンポーネント分離の原則、およびトランザクション整合性ルール。
- **[SEO & 動的メタデータ管理](seo-and-meta-management.md)**
  - 動的なページインデックス処理、robots メタルール、多言語正規パス（canonical）、および Open Graph サムネイルのレンダリング。

---

## 💬 機能ディープダイブ (Feature Deep-Dives)
- **[チャット & ダッシュボード同期](feature-chat-dashboard.md)**
  - リアルタイム Firestore リスナーの詳細な説明。
  - データと UI の分離。
  - 未読ステータスの同期方法。
- **[AI 統合](feature-ai-integration.md)**
  - Gemini 3.1 Flash-Lite の統合方法。
  - 翻訳、週次ふり返り（Weekly Recaps）、および自動化。
- **[通知システム](feature-notifications.md)**
  - FCM トークンストレージ、ステータスの回復、およびサービスワーカーのインストール。
  - OS 通知トレイ制御（ストリーク通知やグループメッセージのクリア）。

---

## ⚙️ コアロジック & メカニズム (Core Logic & Mechanisms)
- **[ノート投稿メカニズム](logic-note-posting.md)**
  - ノート投稿のエンドツーエンドフロー。
  - 詳細なストリークおよびレベル計算ロジック。
- **[福音ライブラリマッパー](gospel-library-mapper.md)**
  - 多言語対応の聖典および巻（ボリューム）のマッピングエンジン。
  - 文字の正規化、正規表現による章の解析、および聖句ハイライトへのディープリンク。
- **[グループ招待 & 参加パイプライン](group-invites.md)**
  - 安全なグループメンバー登録と一意の招待コード生成。
  - レート制限された参加試行、ローカライズされたメタデータプレビューカード、および有効期限。
- **[非アクティブ & 自動キックエンジン](inactivity-and-autokick.md)**
  - 評価しきい値、ローテーションスケジューラー、自己修復サブコレクション、およびオーナー権限の譲渡ロジック。
- **[URL メタデータ & 話者抽出](url-metadata-extraction.md)**
  - ページタイトルと話者を解析するためのクライアント／サーバー・パイプライン。
  - SSRF 保護、Firebase セキュリティガード、およびデュアルフェッチ（二重取得）フォールバック処理。
  - 最適化された 2 層キャッシュ（メモリー + ローカルストレージ）とフロントエンドフック。
- **[I18n & 多言語対応: グローバル展開](logic-i18n.md)**
  - フロントエンドのコンテキストと言語切り替え、バックエンドのテンプレートシステム。
  - 自動化された AU 翻訳（オーストラリア英語等）戦略。
- **[団結度（Unity）参加 & 同期アーキテクチャ](unity-participation.md)**
  - グループ同期の計算、リアルタイムメッセージ同期のクライアント側オーバーライド、およびトリプルフォールバック参加日資格フィルタリング。
- **[Firestore トランザクション & カウンターサービス設計](firestore-transactions-counters.md)**
  - トランザクション時の動的な「書込前の読込（read-before-write）」順序制御、アトミックな複数ドキュメント更新、および分散カウンターシャード。
- **[インクリメンタル聖典書籍提案エンジン](incremental-book-suggestions.md)**
  - 多言語 Unicode 正規化、日本語ひらがな・カタカナ発音コードシフト、および 4 段階の優先度ソート。
- **[ユーザープロファイル同期 & リアクション匿名化](profile-sync-anonymization.md)**
  - ユーザー詳細情報のグループチャットおよび検索インデックスへの同期。
  - アカウント削除時の個人データの匿名化。
- **[タイムゾーン対応ストリーク通知](timezone-streak-reminders.md)**
  - JavaScript の `Intl` ライブラリを使用した動的なタイムゾーン解決。
  - 分割クエリチャック処理、多言語マルチキャスト送信、および自己修復 FCM トークン削除クリーンアップ。

---

## 🛠️ 運用 & 開発 (Operations & Development)
- **[開発 & 環境構築ガイド](development-guide.md)**
  - ローカルセットアップ、モバイル開発（Capacitor）、およびデプロイ手順。
- **[技術トラブルシューティング & FAQ](troubleshooting.md)**
  - Capacitor ループバックエラー、Android のクリアテキスト通信（非SSL通信設定）、AppCheck テストバイパス、およびキーストア SHA-1 調整。
- **[テスト & 信頼性ガイド](testing-guide.md)**
  - Vitest を使用したユニットテストおよび統合テスト環境、Firebase セキュリティルール検証、Playwright を使用した E2E 自動テスト。
- **[CI/CD & メンテナンス自動化ガイド](cicd-maintenance-automation.md)**
  - GitHub Actions 継続的インテグレーション、ローカル Java Firebase エミュレーター、Playwright パイプライン実行、Vercel 本番環境 CD デプロイ、および日次の非アクティブスキャン用 Cron トリガー。
- **[Capacitor アプリ署名 & リリースガイド](hybrid-mobile-release-guide.md)**
  - モバイルストアリリースのコンパイル、Android キーストアバンドル署名、Google 認証用 SHA フィンガープリント登録、iOS プロビジョニングプロファイル、および APNs 証明書バインド。
- **[メンテナンス & バッチジョブ](maintenance-cron.md)**
  - 非アクティブチェック、オーナー権限譲渡、およびカウンター集計。
  - アーカイブおよび自己修復メカニズム。
- **[監視 & オブザーバビリティ](monitoring-observability.md)**
  - Sentry 統合、vConsole、および PWA ライフサイクル。
  - エラーのサイレンス化とパフォーマンストレーシング。
- **[PWA & Capacitor ハイブリッドモバイルライフサイクル](hybrid-mobile-lifecycle.md)**
  - サービスワーカー背景キャッシュの更新プロンプト、iOS 共有バーの操作説明オーバーレイ、および Capacitor エミュレータ非暗号化ネットワーク設定。
  - アプリ内 WebView サンドボックスブラウザチェック、および動的な OS 脱出プロトコル（LINE 外部ブラウザオーバーライド、Android Chrome インテント）。
- **[Firestore オフライン持続性 & 複数タブ同期](firestore-offline-persistence.md)**
  - IndexedDB キャッシュ設定、マルチタブ共有ロック、フェイルオーバー try-catch ブロック、および自動ランナー webdriver 最適化。
- **[クライアント側 団結度（Unity）深夜リセットフック](client-unity-midnight-reset.md)**
  - 1分未満のタイムゾーン日付反転ポーリングを実行する React ライフサイクルフック。
  - OS のスリープ/ウェイク同期フォーカスフック、二重トークン認証ゲートウェイハンドシェイク。

---

## 🎨 デザイン & UX (Design & UX)
- **[UI/UX デザインシステム](design-system.md)**
  - グローバル CSS 変数（トークン）、ビジュアルデザイン、およびモバイルファーストのルール。
  - アニメーションパターンとタイポグラフィ標準。

---

> [!TIP]
> 各ドキュメントには、データフローやインタラクションを可視化するための **Mermaid ダイアグラム** が含まれています。最適な表示を得るために、Mermaid のレンダリングをサポートするツール（GitHub や VS Code の拡張機能など）でご覧ください。
