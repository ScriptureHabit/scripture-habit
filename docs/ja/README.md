# 技術ドキュメント 総覧 (Technical Documentation Index)

**scripture-habit** の技術ドキュメントへようこそ。この場所には、アプリケーションの構造や機能、その背景にある設計思想、そして日々の実装における工夫を丁寧に書き留めております。

> [!TIP]
> **開発や改善にご興味のある方へ**  
> 最初からすべてのドキュメントを読み通す必要はまったくありません。ご関心のある機能や手引きをひとつ選び、小さなところからどうぞ気兼ねなく始めてみてください。

---

## 全体アーキテクチャ (Architecture)
- **[アーキテクチャ & ディレクトリ構成](architecture.md)**
  - フロントエンド、内部API、バックエンドの責務分担と、各層の境界定義。
- **[ネットワークと通信の最適化](network-performance-optimization.md)**
  - オフライン時の送信待ち行列（Service Worker Sync）とバイナリ通信（MessagePack）による最適化。
  - 多層キャッシュ（Redis、Axios）、データ圧縮、フォント配信などによる応答速度の向上。
- **[データベースとセキュリティ](database-security.md)**
  - Firestore のデータモデル設計、権限の適切な分離、および対話履歴のアーカイブ構造。
- **[App Check & API 保護](security-architecture.md)**
  - 不正なアクセスを防ぐ App Check 検証と、適切なレート制限の仕組み。
- **[API 設計とエラー処理](api-middleware-error-handling.md)**
  - Express ミドルウェアの構成、共通エラー処理、および Sentry による確実なエラー監視。
- **[Firebase セキュリティルール](firebase-security-rules.md)**
  - データベース層における厳格な認証検証（`isAuthenticated`）と App Check の確認。
- **[AI コンテキストガイド & 開発指針](ai-context.md)**
  - 開発支援AIに共有すべき前提知識と、状態管理・コンポーネント分離の設計原則。
- **[PWA とモバイルライフサイクル](hybrid-mobile-lifecycle.md)**
  - Service Worker による更新配信、OS別のインストール案内、およびアプリ内ブラウザ（WebView）への安全な対応。
- **[SEO とメタデータ管理](seo-and-meta-management.md)**
  - 検索エンジンへの適切な案内、多言語URLの構造、およびSNS共有画像の動的生成。
- **[UI/UX デザインシステム](design-system.md)**
  - 配色設計（カラーパレット）、グラスモーフィズム、文字の佇まい（タイポグラフィ）、および画面応答設計。

---

## 主要機能の仕組み (Features)
- **[チャット & ダッシュボード同期](feature-chat-dashboard.md)**
  - リアルタイムリスナーの管理と、未読状態の確実な同期処理。
- **[グループチャットの設計と実装](groupchat-construction-guide.md)**
  - リアルタイム対話の構成、状態管理、カスタムフック、および各種モーダルの設計。
- **[ノート作成・編集（NewNote）の設計と実装](newnote-construction-guide.md)**
  - フォームの状態管理、URLメタデータの取得、AIによる振り返り質問の提示、および共有設定。
- **[ダッシュボード ＆ マイノートの設計と実装](dashboard-mynotes-construction-guide.md)**
  - カレンダー表示、日々の学習ペース計算、ノートの検索、および週次振り返りの仕組み。
- **[AI 統合 (Gemini)](feature-ai-integration.md)**
  - Gemini 3.1 Flash-Lite を活用した自動翻訳、振り返りレターの生成、およびプロンプトの設計思想。
- **[プッシュ通知システム](feature-notifications.md)**
  - FCM トークン管理、バックグラウンドでの通知受信、およびOS通知トレイの整理。

---

## 続けやすさのUXデザイン (UX & Habit Building)
- **[マイルストーン達成 & リテンション心理学](logic-milestone-retention.md)**
  - 連続記録が途切れたときの挫折を防ぐ「合計日数モデル」の導入。
  - 10日および25日刻みのマイルストーンと、記念カードによる達成感の可視化。
- **[AI振り返りレターの心理学的効用とリテンション](ux-ai-reflection-letters.md)**
  - 「AIからの手紙が継続の力になっている」というユーザーの声の考察。
  - 日常で努力を認められる機会の少なさと、AIによる寄り添いと内省の役割。
- **[少人数グループ（最大5人）とピア・アカウンタビリティの心理学](ux-small-groups-and-peer-accountability.md)**
  - グループの上限を5人に定めている理由（責任の希薄化防止と親密さの維持）。
  - 親しい間柄で習慣が続きやすい理由と、見知らぬ人同士でも安心して支え合える仕組み。
- **[将来の自分への手紙（タイムカプセル）と習慣化心理学](ux-letters-to-future-self.md)**
  - 自己連続性（Future Self Continuity）と事前コミットメントによる継続意欲の向上。
  - 社会的証明バッジ、サボり防止のSOSメッセージ、当時の記録を添えた開封演出と次の目標への循環。

---

## コアロジック (Core Logic)
- **[ノート投稿 & ストリーク計算](logic-note-posting.md)**
  - ノート投稿の一連の流れと、合計学習日数・レベルの確実な計算処理。
- **[福音ライブラリマッパー](gospel-library-mapper.md)**
  - 聖典の巻・章・節の解析と、公式学習ページへのハイライト付きディープリンク生成。
- **[グループ招待 & 参加処理](group-invites.md)**
  - 招待リンクの生成、有効期限の管理、およびグループ定員の検証。
- **[非アクティブ判定 & 自動整理](inactivity-and-autokick.md)**
  - 長期間活動のないメンバーの判定と、グループオーナー権限の自動移譲・整理。
- **[URL メタデータ & 話者抽出](url-metadata-extraction.md)**
  - 記事の表題や話者名を安全に取得・解析する仕組みと、キャッシュによる高速化。
- **[多言語対応 (i18n)](logic-i18n.md)**
  - 言語切り替えの仕組みと、AIを活用した自然な翻訳処理。
- **[団結度（Unity）の同期](unity-participation.md)**
  - グループ全員の当日の学習参加率の計算と、リアルタイムな同期処理。
- **[Firestore トランザクション & カウンター設計](firestore-transactions-counters.md)**
  - データの整合性を保つトランザクション処理と、分散カウンターの仕組み。
- **[聖典書籍のインクリメンタル提案](incremental-book-suggestions.md)**
  - 日本語の読み仮名や多言語に対応した、聖典名の入力補完ロジック。
- **[ユーザー情報の同期 & 匿名化](profile-sync-anonymization.md)**
  - プロフィール更新時のグループへの即時反映と、退会時におけるデータの適切な匿名化。
- **[タイムゾーン対応のリマインダー通知](timezone-streak-reminders.md)**
  - 世界各地の現地時間（夜20:00）に合わせた、きめ細やかなプッシュ通知の配信。
- **[Firestore のオフライン永続化](firestore-offline-persistence.md)**
  - IndexedDB を活用したオフラインキャッシュと、複数タブ間での排他制御。

---

## 開発・運用ガイド (Development & Operations)
- **[開発 & 環境構築ガイド](development-guide.md)**
  - ローカル環境の立ち上げ手順と、本番デプロイまでの流れ。
- **[トラブルシューティング & FAQ](troubleshooting.md)**
  - 開発中によく遭遇する問題の解決策（App Check や認証のバイパス設定など）。
- **[テスト & 信頼性ガイド](testing-guide.md)**
  - Vitest による単体テスト、セキュリティルールの検証、および Playwright による E2E テスト。
- **[CI/CD & 自動化ガイド](cicd-maintenance-automation.md)**
  - GitHub Actions によるテスト自動化、本番デプロイ、および定期実行ジョブ（Cron）。
- **[定期メンテナンスジョブ](maintenance-cron.md)**
  - 非アクティブユーザーの整理やカウンター集計を行うバッチ処理の仕組み。
- **[監視 & エラー追跡](monitoring-observability.md)**
  - Sentry によるエラーの検知と、パフォーマンスの継続的な測定。
- **[Unity 深夜リセットフック](client-unity-midnight-reset.md)**
  - 深夜0時の日付変更を検知し、団結度を自然に更新・リセットする仕組み。

---

> [!TIP]
> 各ドキュメントには、データの流れや処理の手順を分かりやすくお伝えするための **Mermaid ダイアグラム（図解）** を添えております。
