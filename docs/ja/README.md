# 技術ドキュメント インデックス (Technical Documentation Index)

**scripture-habit** の技術ドキュメントへようこそ。このディレクトリには、アプリケーションのアーキテクチャ、機能、設計思想、および実装の詳細が記載されています。

---

## 全体アーキテクチャ (Architecture)
- **[アーキテクチャ & ディレクトリ構成](architecture.md)**
  - フロントエンド、内部API、バックエンドの責務分担とレイヤー定義。
- **[ネットワーク・通信の最適化](network-performance-optimization.md)**
  - オフライン時のメッセージ送信キュー（Service Worker Sync）とバイナリ通信（MessagePack）。
  - 多層キャッシュ（Redis、Axios）、データ圧縮、フォント配信などの高速化手法。
- **[データベース & セキュリティ](database-security.md)**
  - Firestore のデータモデル設計、権限分離、およびチャット履歴のアーカイブ構造。
- **[App Check & API 保護](security-architecture.md)**
  - 不正アクセスを防ぐ App Check 検証とレート制限。
- **[API 設計 & エラーハンドリング](api-middleware-error-handling.md)**
  - Express ミドルウェア構成、共通エラーハンドリング、および Sentry によるエラー監視。
- **[Firebase セキュリティルール](firebase-security-rules.md)**
  - データベース層での認証チェック（`isAuthenticated`）と App Check 検証。
- **[AI コンテキストガイド & 開発ルール](ai-context.md)**
  - 開発AI向けの必須ルールと、状態管理・コンポーネント分離の設計方針。
- **[SEO & メタデータ管理](seo-and-meta-management.md)**
  - 検索エンジンのインデックス設定、多言語URL対応、およびSNS共有用サムネイルの生成。

---

## 主要機能の仕組み (Features)
- **[チャット & ダッシュボード同期](feature-chat-dashboard.md)**
  - リアルタイムリスナーの管理と、未読ステータスの同期処理。
- **[グループチャットの設計と実装](groupchat-construction-guide.md)**
  - リアルタイムチャットの構成、状態管理、カスタムフック、および各種モーダル設計。
- **[ノート作成・編集（NewNote）の設計と実装](newnote-construction-guide.md)**
  - フォーム状態管理、URLメタデータ取得、AI振り返り質問、および共有設定。
- **[ダッシュボード ＆ マイノートの設計と実装](dashboard-mynotes-construction-guide.md)**
  - カレンダー表示、学習ペースの計算、ノート検索、および週次ふり返り機能。
- **[AI 統合 (Gemini)](feature-ai-integration.md)**
  - Gemini 3.1 Flash-Lite を活用した自動翻訳、振り返りレター、およびプロンプト設計。
- **[プッシュ通知システム](feature-notifications.md)**
  - FCM トークン管理、バックグラウンド受信、およびOS通知トレイの整理。

---

## 続けやすさのUXデザイン (UX & Habit Building)
- **[マイルストーン達成 & リテンション心理学](logic-milestone-retention.md)**
  - 連続ストリークが途切れたときの挫折を防ぐための合計日数モデルへの移行。
  - 10日および25日刻みのマイルストーン設定と、記念画像による達成感の可視化。
- **[AI振り返りレターの心理学的効用とリテンション](ux-ai-reflection-letters.md)**
  - 「AIからの手紙が継続の大きな動機になっている」というユーザーフィードバックの考察。
  - 日常で褒められる機会の少なさと、AIによる安心感のある振り返り・肯定の役割。
- **[少人数グループ（最大5人）とピア・アカウンタビリティの心理学](ux-small-groups-and-peer-accountability.md)**
  - グループ上限を5人に制限している理由（責任の希薄化防止と親密な関係の維持）。
  - 親友や恋人など信頼関係のあるグループが続きやすい理由と、見知らぬ人同士を支える機能。

---

## コアロジック (Core Logic)
- **[ノート投稿 & ストリーク計算](logic-note-posting.md)**
  - ノート投稿の一連の流れと、合計日数・レベルの計算処理。
- **[福音ライブラリマッパー](gospel-library-mapper.md)**
  - 聖典の巻・章の解析と、公式アプリへのハイライト付きディープリンク生成。
- **[グループ招待 & 参加処理](group-invites.md)**
  - 招待リンクの作成、有効期限の管理、およびグループ定員チェック。
- **[非アクティブ判定 & 自動整理](inactivity-and-autokick.md)**
  - 長期間活動のないメンバーの判定と、グループオーナー権限の自動移譲。
- **[URL メタデータ & 話者抽出](url-metadata-extraction.md)**
  - 記事タイトルや話者名を安全に取得・解析する仕組みとキャッシュ処理。
- **[多言語対応 (i18n)](logic-i18n.md)**
  - 言語切り替えの仕組みと、AIを活用した自動翻訳。
- **[団結度（Unity）の同期](unity-participation.md)**
  - グループ全員の今日の学習参加率の計算とリアルタイム同期。
- **[Firestore トランザクション & カウンター設計](firestore-transactions-counters.md)**
  - データの整合性を保つトランザクション処理と、分散カウンターの仕組み。
- **[聖典書籍のインクリメンタル提案](incremental-book-suggestions.md)**
  - 日本語の読み仮名や多言語に対応した、聖典名の入力補完ロジック。
- **[ユーザー情報の同期 & 匿名化](profile-sync-anonymization.md)**
  - プロフィール更新時のグループチャットへの反映と、退会時のデータ匿名化。
- **[タイムゾーン対応のリマインダー通知](timezone-streak-reminders.md)**
  - ユーザーごとの現地時間（夜の時間帯）に合わせたプッシュ通知の配信。

---

## 開発・運用ガイド (Development & Operations)
- **[開発 & 環境構築ガイド](development-guide.md)**
  - ローカル環境の立ち上げ手順とデプロイの流れ。
- **[トラブルシューティング & FAQ](troubleshooting.md)**
  - よくある問題の解決策（App Check や認証のバイパス設定など）。
- **[テスト & 信頼性ガイド](testing-guide.md)**
  - Vitest による単体テスト、セキュリティルール検証、および Playwright による E2E テスト。
- **[CI/CD & 自動化ガイド](cicd-maintenance-automation.md)**
  - GitHub Actions によるテスト自動化、本番デプロイ、および定期実行ジョブ（Cron）。
- **[定期メンテナンスジョブ](maintenance-cron.md)**
  - 非アクティブユーザーの整理やカウンター集計などのバッチ処理。
- **[監視 & エラー追跡](monitoring-observability.md)**
  - Sentry によるエラー監視とパフォーマンス測定。
- **[Firestore のオフライン永続化](firestore-offline-persistence.md)**
  - IndexedDB を使ったオフラインキャッシュと、複数タブ間での排他制御。
- **[Unity 深夜リセットフック](client-unity-midnight-reset.md)**
  - 深夜0時の日付変更を検知して団結度をリセットする仕組み。

---

## 詳細な技術解説 (Technical Deep-Dives)
- **[ノート投稿 & ストリーク計算の詳細](details/note-posting-streak.md)**
  - トランザクション処理シーケンス、タイムゾーン判定、36時間猶予期間のコード解説。
- **[AI (Gemini) 翻訳 & 週次要約の詳細](details/ai-integration.md)**
  - API呼び出しの最適化、キャッシュ戦略、一括翻訳バッチ処理のフロー解説。
- **[App Check & セキュリティの詳細](details/api-gateway-security.md)**
  - 多層防御の仕組み、CI/CD環境での例外処理、IPベースのレート制限。
- **[福音ライブラリマッパーの詳細](details/gospel-scripture-mapper.md)**
  - 文字正規化、入力補完の優先度ソート、ディープリンク生成のコード解説。
- **[非アクティブ判定 & 自動整理の詳細](details/inactivity-autokick.md)**
  - データベース負荷を抑えた定期スキャン、自動キック、オーナー移譲の処理手順。
- **[グループチャット処理の詳細](details/group-chat-interactions.md)**
  - 楽観的UI更新、リアクション処理、翻訳キュー、エール送信の仕組み。
- **[プッシュ通知配信の詳細](details/push-notifications.md)**
  - トークン管理、無効トークンの自動削除、言語別の配信分割処理。
- **[プロフィール同期 & 退会処理の詳細](details/profile-sync-deletion.md)**
  - 複数データの一括更新と、退会時のプライバシー保護・データ匿名化。
- **[分散カウンター & トランザクションの詳細](details/firestore-transactions-counters.md)**
  - 10シャード分散カウンター、読み取りコスト削減、集計クエリの最適化。
- **[オフライン永続化 & 複数タブ同期の詳細](details/firestore-offline-persistence.md)**
  - Web Locks API によるマスタータブ選出、オフライン書き込みキューの管理。
- **[URL メタデータ抽出の詳細](details/url-metadata-extraction.md)**
  - 2層キャッシュ（メモリ+LocalStorage）、SSRF防御、HTMLパース処理。
- **[タイムゾーン別リマインダーの詳細](details/timezone-streak-reminders.md)**
  - Intl API による現地時間計算、分割クエリ、配信エラー時の自己修復。

---

## デザインシステム (Design System)
- **[UI/UX デザインシステム](design-system.md)**
  - CSS 変数（カラー・タイポグラフィ・スペーシング）、コンポーネントスタイル、およびアニメーション設計。

---

> [!TIP]
> 各ドキュメントには、データフローや処理手順を可視化するための **Mermaid ダイアグラム** が含まれています。
