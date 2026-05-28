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

## 🔬 詳細技術解説 (Deep-Dive Detail Guides)
- **[ノート投稿 & ストリーク計算のコアロジック詳細](details/note-posting-streak.md)**
  - 投稿トランザクション処理シーケンス、タイムゾーン判定ロジック、および36時間猶予期間アルゴリズムの図解とコード解説。
- **[AI (Gemini) 統合・多言語翻訳・週次要約パイプライン詳細](details/ai-integration.md)**
  - 推論高速化設定（思考最小化）、キャッシュ戦略、一括翻訳 JSON パースバッチ処理、クールダウン自己修復リカバリーのシーケンスとフロー図解・コード解説。
- **[App Check & API ゲートウェイ保護セキュリティ詳細](details/api-gateway-security.md)**
  - 多層防御セキュリティトポロジー、本番環境バイパス防止二重ガード、Playwright 自動テスト用の特例ドメイン判定、暗号ハッシュ型レートリミット（SHA-256キー生成器）のシーケンスと判定ツリー図解・コード解説。
- **[福音ライブラリマッパー & 多言語書籍サジェストエンジン詳細](details/gospel-scripture-mapper.md)**
  - 全角標準化・正規表現・アンカーハイライトURL生成のパース決定パイプライン、Unicode NFKC 標準化、ひらがな・カタカナ発音コードシフト、および4段階優先度ソートカスケードの図解・コード解説。
- **[不活動（Inactivity）自動判定・自動キック・オーナー権限自動移譲エンジン詳細](details/inactivity-autokick.md)**
  - 2層式クエリ（getAll）によるデータベースRead数削減、Cronバッチダブルローテーション、不活動メンバー自動削除、およびオーナー不活動時の権限移譲・ゴーストグループ解散フローのシーケンスと決定木図解・コード解説。
- **[グループチャット インタラクションエンジン — コアロジック詳細](details/group-chat-interactions.md)**
  - 楽観的メッセージパイプライン（temp-ID→実ID解決+ロールバック）、リアクショントグル・3件プレビューキャッシュ、400msデバウンスバッチ翻訳キュー、タイムゾーン対応エールシステム、二重送信防止ガード、SNS共有ハンドラーのシーケンスとフロー図解・コード解説。
- **[プッシュ通知システム — 詳細設計ガイド](details/push-notifications.md)**
  - デバイストークン登録フロー、2層構造の非公開 Firestore トークン保護、無効トークンの自動修復自己クリーンアップサイクル、言語別動的マルチキャスト配信分割、およびOS通知トレイのコンテキスト対応インテリジェント消去のシーケンス図・フロー図解・コード解説。
- **[ユーザープロフィール同期 & アカウント削除パイプライン詳細](details/profile-sync-deletion.md)**
  - アクティブホライズン同期境界、ページネーションカーソルによる一括処理、複数エンティティの動的同時更新、個人ノート用検索プレフィックスインデックス自動再構築、およびGDPR準拠の退会時スタンプ匿名化クリーンアップのシーケンス図・決定木フロー図解・コード解説。
- **[Firestore トランザクション & 分散カウンタシャード詳細設計](details/firestore-transactions-counters.md)**
  - Read-before-Write トランザクション制御（非同期 IIFE スコープ分離）、複数ドキュメントのアトミック同時更新、10シャード型分散カウンタ書き込み、トランザクション安全な並行一括読み取り（getAll）、超高速サーバーサイド集計（count）、退避済みアーカイブ考慮の合算、および統合テスト用 N+1 回避グローバル 300-Read 監査システムのシーケンス図・詳細フロー解説・コード解説。
- **[PWA & Capacitor ハイブリッドモバイルライフサイクル詳細](details/hybrid-mobile-lifecycle.md)**
  - サービスワーカーのバックグラウンド更新プロンプト（SKIP_WAITING + 3秒自動フォールバック）、OS適応型のPWAインストール誘導（iOS共有ポップアップ指示）、アプリ内 WebView サンドボックス脱出ゲート（ユニバーサル Android Intents + LINE 外部ブラウザオーバーライド）、および App Check 保護付きタイムゾーン動的深夜 UI リセット同期のシーケンス図・フロー詳細・コード解説。
- **[Firestore オフライン永続化 & 複数タブ同期ロジック詳細](details/firestore-offline-persistence.md)**
  - `persistentMultipleTabManager` による複数タブ排他制御（共有ロック / Web Locks API）、アクティブ・マスタータブの自動選出とセカンダリタブへのブロードキャスト通信マージ、 IndexedDB に裏打ちされたオフライン書き込みキューと通信復帰時の自動フラッシュ、iOS Safari プライベートモード等のIndexedDB規制下における安全なメモリキャッシュ・フォールバック（try-catchガード）、および自動 E2E テスト（`navigator.webdriver`）における LocalStorage 高速認証セッション同期のシーケンス図・動作フロー詳細・コード解説。
- **[URL メタデータ抽出 & 発表者自動解析システム詳細](details/url-metadata-extraction.md)**
  - フロントエンド側の 2階層キャッシュ（メモリキャッシュ + LocalStorage safeStorage）、バックエンド側の SSRF（Server-Side Request Forgery）防御フィルター（プライベートIP・ローカルホストブロック）、教会の多言語説教ローカライズに対応する Dual-Fetch フォールバックと3文字言語パラメータマッピング、`cheerio` によるアトミック HTML スクレイピングと著者表示（byline）の自動クレンジング、および Firebase Auth & App Check トークン付与によるセキュアな API 通信のフロー図・シーケンス図・コード解説。
- **[タイムゾーン対応ストリーク自動リマインダー設計詳細](details/timezone-streak-reminders.md)**
  - JavaScript `Intl` API を活用したサーバー側動的現地時間・サマータイム自動判定マッピング、最大10タイムゾーンごとの Firestore インデックス制限回避用の分割クエリ（inクエリ）、スウェーデンロケール（`sv-SE`）を用いた YYYY-MM-DD 現地時間提出判定、言語グループ別のマルチキャスト配信自動分類、および送信エラー結果（FCMレスポンス）から無効デバイスを特定して一括削除し、最後のアクティブトークン消去時に公開フラグを自己修復するクローズドループのシーケンス図・動作フロー詳細・コード解説。

---

## 🎨 デザイン & UX (Design & UX)
- **[UI/UX デザインシステム](design-system.md)**
  - グローバル CSS 変数（トークン）、ビジュアルデザイン、およびモバイルファーストのルール。
  - アニメーションパターンとタイポグラフィ標準。

---

> [!TIP]
> 各ドキュメントには、データフローやインタラクションを可視化するための **Mermaid ダイアグラム** が含まれています。最適な表示を得るために、Mermaid のレンダリングをサポートするツール（GitHub や VS Code の拡張機能など）でご覧ください。
