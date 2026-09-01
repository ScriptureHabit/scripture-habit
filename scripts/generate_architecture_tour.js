import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const targetDirs = ['src', 'api'];
const extensions = ['.ts', '.tsx', '.js', '.jsx'];

const allNodes = [];
const allWires = [];
const nodeMap = new Map();

// Generate file-specific bilingual rich description based on domain dictionaries & heuristics
function generateFileDescription(relPath, content, meta) {
  const norm = relPath.replace(/\\/g, '/').toLowerCase();
  const base = path.basename(norm, path.extname(norm));

  // 1. Specific rich mappings for Scripture Habit codebase
  const dict = {
    'api-client': {
      summary: {
        ja: 'バックエンドAPIとのHTTP通信を一元管理し、認証トークンやApp Checkを自動付与するAPIクライアント',
        en: 'Centralized HTTP client managing backend API requests with auto Firebase token and App Check injection'
      },
      purpose: {
        ja: 'バックエンド（Expressサーバー）とのHTTP通信を1箇所に集約し、「全通信に認証トークンやセキュリティヘッダーを自動添付する」通信ハブです。',
        en: 'Acts as the single gateway for all backend HTTP traffic, automatically injecting Firebase Bearer tokens and security headers.'
      },
      breakdown: {
        ja: [
          '1. `apiClient.get / post / put / delete`: fetch をラップした直感的なREST通信メソッド群',
          '2. `getAuthToken()`: バックグラウンドで最新のFirebase認証トークンを取得してヘッダーへ自動添付',
          '3. `ApiError`: サーバーからのエラー応答（401, 404, 500等）を構造化された共通エラー型に変換'
        ],
        en: [
          '1. `apiClient.get / post / put / delete`: Intuitive wrapper methods over standard fetch for REST calls',
          '2. `getAuthToken()`: Automatically grabs the latest Firebase ID token and injects it into headers',
          '3. `ApiError`: Formats server errors (401, 404, 500) into standardized error instances'
        ]
      },
      proTip: {
        ja: 'コンポーネント内に生の fetch() を直書きせず、サービス層の API クライアントに集約することで、リトライやログ記録、トークン更新が全画面で自動化されます。',
        en: 'Never write raw fetch() inside React components. Putting a central API client in the Service Layer enables unified error handling, retries, and auth refresh across the app.'
      }
    },
    'login-form': {
      summary: {
        ja: 'ログイン入力フォームのバリデーション、セッション確立、エラー制御UI',
        en: 'Login form input validation, session creation, and error handling UI'
      },
      purpose: {
        ja: 'ユーザーがメール・パスワードを入力してログインするための対話画面です。入力値の即時バリデーションと視覚的フィードバックを提供します。',
        en: 'Interactive form for user email/password login, providing instant input validation and visual feedback.'
      },
      breakdown: {
        ja: [
          '1. `handleSubmit`: 入力されたメールアドレス・パスワードを検証し、認証フックに引き渡す',
          '2. `error`: 認証エラー（パスワード不一致や未登録など）を赤文字アラートで分かりやすく通知',
          '3. `Button / Input`: 共通のUIコンポーネントを組み合わせてアクセシブルなフォームを構築'
        ],
        en: [
          '1. `handleSubmit`: Validates email/password credentials and invokes the authentication hook',
          '2. `error`: Renders user-friendly alert banners when login fails (e.g. invalid password)',
          '3. `Button / Input`: Assembles reusable UI primitives for consistent styling and accessibility'
        ]
      },
      proTip: {
        ja: 'UIコンポーネント内には「見た目とユーザー操作の検知」だけを持たせ、通信や認証の重い処理はカスタムフック（useLoginForm）へ逃がすのがクリーンな設計です。',
        en: 'Keep UI components focused solely on rendering and user events, delegating all complex state and async auth logic to custom hooks (useLoginForm).'
      }
    },
    'use-login-form': {
      summary: {
        ja: 'ログインフォームの入力値管理、Firebase Auth認証実行、エラー制御フック',
        en: 'Manages login form input state, executes Firebase Auth, and handles errors'
      },
      purpose: {
        ja: 'ログイン画面のビジネスロジックを担当し、入力フォームの状態管理から Firebase Auth との認証通信までを一括制御します。',
        en: 'Encapsulates authentication business logic, managing form state and orchestrating Firebase Auth requests.'
      },
      breakdown: {
        ja: [
          '1. `email / password` 状態: useState でフォームの入力値をリアクティブに保持',
          '2. `handleLogin`: Firebase SDK の signInWithEmailAndPassword を呼び出しセッションを確立',
          '3. `isLoading / error`: 通信中のスピナー表示や失敗時のエラー文言を管理'
        ],
        en: [
          '1. `email / password` state: Tracks input values reactively with useState',
          '2. `handleLogin`: Dispatches signInWithEmailAndPassword to authenticate with Firebase Auth',
          '3. `isLoading / error`: Controls loading spinner state and error message rendering'
        ]
      },
      proTip: {
        ja: '認証が成功した後は、Auth Context が自動的に状態変化（onAuthStateChanged）を検知して画面を切り替えるため、手動の画面遷移を最小限に抑えられます。',
        en: 'Upon successful login, global Auth Context automatically picks up onAuthStateChanged and routes the user, eliminating manual redirect spaghetti.'
      }
    },
    'signup-form': {
      summary: {
        ja: '新規ユーザー登録フォームの入力検証、アカウント初期化、Firestore初期データ作成UI',
        en: 'User sign-up form validation, account initialization, and Firestore setup UI'
      },
      purpose: {
        ja: '新規ユーザーのアカウント登録を受け付け、パスワード強度チェックや利用規約の同意確認を行います。',
        en: 'Handles new user registration with live password strength indicators and Terms of Service consent.'
      },
      breakdown: {
        ja: [
          '1. `email / password / nickname`: 基本プロファイル項目の入力フィールド',
          '2. `passwordStrength`: 入力されたパスワードの安全性をリアルタイムに計算してバー表示',
          '3. `termsConsent`: 利用規約・プライバシーポリシーへの同意チェックボックス'
        ],
        en: [
          '1. `email / password / nickname`: Form fields collecting initial user profile information',
          '2. `passwordStrength`: Computes real-time password entropy with visual progress bars',
          '3. `termsConsent`: Enforces mandatory Terms of Service & Privacy Policy checkboxes'
        ]
      },
      proTip: {
        ja: 'アカウント作成直後にユーザーが迷わないよう、初期タイムゾーンと言語設定を自動検知して初期値にセットする工夫が施されています。',
        en: 'Auto-detecting browser timezone and language during registration prevents blank profile states on the very first session.'
      }
    },
    'use-signup-form': {
      summary: {
        ja: '新規登録のバリデーション、初期言語/タイムゾーン設定、アカウント作成フック',
        en: 'Handles registration validation, initial locale/timezone, and account creation'
      },
      purpose: {
        ja: 'アカウント登録の通信と、Firestore への初期ユーザープロファイル（ストリーク0日、タイムゾーン設定等）の自動セットアップを実行します。',
        en: 'Executes user registration and initializes the Firestore user document (streaks, timezone, locale).'
      },
      breakdown: {
        ja: [
          '1. `createUserWithEmailAndPassword`: Firebase Auth で安全に新規ユーザーを作成',
          '2. `setupInitialUserData`: Firestore の users/{uid} に初期プロファイルドキュメントを書き込み',
          '3. `validateInputs`: パスワード文字数やメールアドレス形式を厳格に事前チェック'
        ],
        en: [
          '1. `createUserWithEmailAndPassword`: Securely provisions new credentials via Firebase Auth',
          '2. `setupInitialUserData`: Populates initial profile document in Firestore users/{uid}',
          '3. `validateInputs`: Pre-validates email format and password complexity before sending requests'
        ]
      },
      proTip: {
        ja: 'Auth のユーザー作成と Firestore の初期化を非同期チェーンで確実に繋ぎ、失敗時はロールバックまたは適切な案内を出す堅牢設計です。',
        en: 'Chaining Auth creation and Firestore document setup ensures consistent database state without orphaned auth accounts.'
      }
    },
    'new-note': {
      summary: {
        ja: '新規ノート作成・編集画面UI、文字数カウント、聖句引用タグ付け',
        en: 'UI for creating and editing notes, character count validation, and scripture tagging'
      },
      purpose: {
        ja: 'ユーザーが聖句を読み、その感想やインサイトを記録・編集するためのメインエディタUIです。',
        en: 'Primary editor UI for reading scriptures and writing daily reflections and insights.'
      },
      breakdown: {
        ja: [
          '1. `ScriptureSelector`: 聖書・モルモン書などの聖句と章を選択するドロップダウン',
          '2. `ReflectionTextarea`: 学習メモ・感想を自由に入力するリッチなテキストエリア',
          '3. `GroupSharePicker`: 作成したノートを共有したいグループチャットを選択するチェックボックス'
        ],
        en: [
          '1. `ScriptureSelector`: Dropdown picker for selecting scripture books and chapters',
          '2. `ReflectionTextarea`: Rich textarea for inputting thoughts, questions, and insights',
          '3. `GroupSharePicker`: Checkboxes selecting group channels where the note card should be broadcasted'
        ]
      },
      proTip: {
        ja: '保存と同時に紙吹雪（Confetti）を舞わせ、グループチャットへカード投稿する「習慣化のドーパミン演出」をここから起動します。',
        en: 'Tapping save triggers celebratory confetti and broadcasts rich cards to selected groups, reinforcing the positive habit loop.'
      }
    },
    'use-note-submission': {
      summary: {
        ja: 'ノートデータのFirestore保存、画像添付、更新完了イベントの制御フック',
        en: 'Handles note persistence to Firestore, attachments, and submit lifecycle'
      },
      purpose: {
        ja: 'ノート作成時の検証・検索用トークン生成・APIへの送信・カレンダー草の更新・紙吹雪演出を一連のパイプラインとして統括します。',
        en: 'Coordinates validation, search token generation, API submission, streak heatmap update, and celebration feedback.'
      },
      breakdown: {
        ja: [
          '1. `handleSubmit`: ノート内容をバックエンドの /api/groups/post-note に POST 送信',
          '2. `triggerConfetti`: 投稿成功時に canvas-confetti を発火させて達成感を最大化',
          '3. `optimisticUpdate`: カレンダーやダッシュボードのストリーク表示を即座にインクリメント'
        ],
        en: [
          '1. `handleSubmit`: Dispatches note payload to backend /api/groups/post-note',
          '2. `triggerConfetti`: Fires canvas-confetti upon success to reward habit completion',
          '3. `optimisticUpdate`: Optimistically bumps streak counters and calendar heatmaps immediately'
        ]
      },
      proTip: {
        ja: 'トランザクション処理により、個人ノート保存・グループ共有・連続記録加算の3つが「全部成功するか全部元に戻るか」のACID特性を保証します。',
        en: 'Uses atomic database transactions ensuring private notes, group broadcasts, and streak calculations succeed or fail together.'
      }
    },
    'use-ai-generator': {
      summary: {
        ja: 'Gemini AIを活用した聖句の自動要約・振り返り質問・インサイト生成フック',
        en: 'Generates AI summaries, reflection questions, and insights via Gemini AI'
      },
      purpose: {
        ja: '選択された聖句に対して、Google Gemini AI が要約・歴史的背景・振り返りの問いかけをリアルタイム生成してユーザーの深い思索を助けます。',
        en: 'Leverages Google Gemini AI to generate contextual summaries, historical backgrounds, and reflection questions for scriptures.'
      },
      breakdown: {
        ja: [
          '1. `generateInsight`: 聖句名をパラメータにしてサーバーサイドのAIエンドポイントを呼び出し',
          '2. `streaming / loading`: AI の生成アニメーションとローディング状態を滑らかに制御',
          '3. `applyToNote`: 生成されたAIの問いかけや要約を1タップでノート本文に挿入'
        ],
        en: [
          '1. `generateInsight`: Calls backend Gemini AI endpoint passing selected scripture chapter',
          '2. `streaming / loading`: Manages smooth loading states and typing indicator animations',
          '3. `applyToNote`: Injects AI generated questions into note editor with a single tap'
        ]
      },
      proTip: {
        ja: 'AI API キーをクライアントに露出させず、バックエンドを経由してレートリミットをかけることで安全かつコスト効率よく運用されています。',
        en: 'API keys remain safely hidden on the server with strict rate limiting, protecting against quota abuse.'
      }
    },
    'dashboard': {
      summary: {
        ja: '習慣継続ストリーク、今日の進捗、未読通知、マイルストーンの総合ダッシュボードUI',
        en: 'Unified dashboard UI for habit streaks, daily progress, notifications, and milestones'
      },
      purpose: {
        ja: 'ユーザーがアプリを開いて最初に目にするメイン画面です。今日の学習状況、現在のストリーク日数、所属グループの団結力を一望できます。',
        en: 'Central hub greeting the user, displaying daily streak counters, study calendar heatmaps, and group unity scores.'
      },
      breakdown: {
        ja: [
          '1. `StreakCard`: 連続学習日数（Flame Badge）と自己ベスト記録を視覚的に表示',
          '2. `StudyCalendar`: GitHubの草のような日々の学習活動ヒートマップを描画',
          '3. `GroupRoster`: 参加中グループの今日の団結力（Unity %）をカード一覧で表示'
        ],
        en: [
          '1. `StreakCard`: Renders consecutive study days with fire badges and personal best records',
          '2. `StudyCalendar`: Visualizes GitHub-style activity heatmaps of daily scripture reading',
          '3. `GroupRoster`: Displays cards showing real-time group unity scores and recent activity'
        ]
      },
      proTip: {
        ja: '毎朝のモチベーションを高めるため、今日まだ学習していない場合は目立つ「今日の聖句を読む」アクションボタンが上部に配置されます。',
        en: 'Contextually displays prominent Call-to-Action buttons when study has not been recorded for the current day.'
      }
    },
    'use-today': {
      summary: {
        ja: '今日の日付、ストリーク達成判定、日次リセット状態の管理フック',
        en: 'Manages today\'s progress, consecutive streak calculation, and midnight reset'
      },
      purpose: {
        ja: 'ユーザーのローカルタイムゾーンに基づいて「今日」「昨日」を正確に判定し、日付が変わった瞬間に自動リセットを行います。',
        en: 'Calculates localized calendar dates and triggers automatic daily state resets at midnight.'
      },
      breakdown: {
        ja: [
          '1. `isStudiedToday`: studiedDates 配列に今日の日付文字列が存在するかを高速判定',
          '2. `todayString`: ユーザーの timeZone に合わせた YYYY-MM-DD 文字列を生成',
          '3. `midnightTimer`: 日付が変わった瞬間に画面を再描画して翌日の未達成状態へ移行'
        ],
        en: [
          '1. `isStudiedToday`: Rapidly checks if today\'s date string exists in the studiedDates array',
          '2. `todayString`: Formats YYYY-MM-DD strings localized to the user\'s configured timeZone',
          '3. `midnightTimer`: Automatically triggers calendar refresh when crossing midnight'
        ]
      },
      proTip: {
        ja: '日本時間（UTC+9）とニューヨーク時間（UTC-5）など、時差による「ストリーク途切れバグ」を防ぐためにサーバーとクライアントでタイムゾーン計算を完全一致させています。',
        en: 'Standardizing timezone calculations between client and server eliminates streak desync bugs across international time boundaries.'
      }
    },
    'group-chat': {
      summary: {
        ja: 'リアルタイムグループチャット画面UI、多言語メッセージ送受信、未読管理',
        en: 'Real-time group chat UI with multilingual messaging and unread markers'
      },
      purpose: {
        ja: 'グループメンバー同士が励まし合い、読んだ感想をリアルタイムに共有・議論するためのチャットルームUIです。',
        en: 'Real-time interactive chatroom for group members to share scripture reflections and encourage each other.'
      },
      breakdown: {
        ja: [
          '1. `MessageList`: バーチャルスクロールと React.memo で最適化された高速メッセージ一覧',
          '2. `ChatInput`: テキスト入力、返信（ReplyTo）、画像添付、絵文字ピッカーを統合',
          '3. `UnreadAnchor`: 前回の退出以降に届いた新着メッセージの位置に「ここから未読」バーを表示'
        ],
        en: [
          '1. `MessageList`: High-performance message list optimized with memoization and smooth scrolling',
          '2. `ChatInput`: Integrated input bar supporting text, threaded replies, image attachments, and emojis',
          '3. `UnreadAnchor`: Pins an unread dividing line where the user left off during their last session'
        ]
      },
      proTip: {
        ja: '外国語で投稿されたメッセージにはワンタップ「翻訳」ボタンが表示され、言語の壁を越えた国際的な習慣コミュニティを実現しています。',
        en: 'Provides instant on-demand translation buttons for foreign messages, enabling seamless multilingual community chats.'
      }
    },
    'chat-provider': {
      summary: {
        ja: 'グループチャットのリアルタイムFirestoreリスナーとメッセージ状態の供給',
        en: 'Provides real-time Firestore chat subscription and message state'
      },
      purpose: {
        ja: 'Firestore の onSnapshot リスナーを確立し、チャットの全メッセージ・未読数・参加メンバー状態を子コンポーネント全体へ配信します。',
        en: 'Establishes real-time Firestore onSnapshot listeners and distributes message stream state to all chat components.'
      },
      breakdown: {
        ja: [
          '1. `onSnapshot Listener`: 新着メッセージが届くたびに差分（docChanges）だけを効率的に受信',
          '2. `useReducer Engine`: メッセージ追加・編集・削除・楽観的UIロールバックを一元管理',
          '3. `Cleanup Function`: チャット画面を閉じた瞬間に通信を切断し、不要なクラウド課金を完全阻止'
        ],
        en: [
          '1. `onSnapshot Listener`: Subscribes to collection updates, receiving minimal diff changes',
          '2. `useReducer Engine`: Manages message lifecycle: additions, edits, deletions, and optimistic rollbacks',
          '3. `Cleanup Function`: Unsubscribes active stream listeners immediately on unmount to prevent memory leaks'
        ]
      },
      proTip: {
        ja: 'Context と Reducer を組み合わせることで、深い階層にある子コンポーネントへバケツリレー（Props Drilling）せずにアクションを dispatch できます。',
        en: 'Pairing Context with useReducer completely eliminates Props Drilling, allowing any child button to dispatch chat actions directly.'
      }
    },
    'auth-provider': {
      summary: {
        ja: 'Firebase Auth状態監視（onAuthStateChanged）とグローバル認証セッションの供給',
        en: 'Listens to Firebase Auth state changes and supplies global user session'
      },
      purpose: {
        ja: 'アプリ全体の「ログイン中・ログアウト中・認証確認中（ローディング）」の状態を監視し、全画面に安全な認証情報を提供します。',
        en: 'Monitors global authentication status (signed-in, signed-out, authenticating) and protects private routes.'
      },
      breakdown: {
        ja: [
          '1. `onAuthStateChanged`: ページリロード時もローカルストレージのトークンを復元して自動ログイン',
          '2. `currentUser / userData`: ログイン中のユーザーIDと Firestore のプロファイル情報を保持',
          '3. `isInitialized`: 認証チェックが完了するまで画面のチラつき（ローディングフラッシュ）を防止'
        ],
        en: [
          '1. `onAuthStateChanged`: Listens for credential changes and auto-restores sessions on page reload',
          '2. `currentUser / userData`: Exposes active user credentials and Firestore profile state',
          '3. `isInitialized`: Blocks route rendering until authentication initialization finishes, eliminating UI flickers'
        ]
      },
      proTip: {
        ja: '認証チェックが完了する前にプライベート画面を描画しないよう `if (!isInitialized) return <LoadingSpinner />` を挟むのがセキュアなSPAの鉄則です。',
        en: 'Guarding routes with `if (!isInitialized) return <LoadingSpinner />` prevents flashing unauthenticated content to logged-in users.'
      }
    },
    'app': {
      summary: {
        ja: '全画面ルーティング、遅延コンポーネントロード、グローバルProvider階層の統括構成',
        en: 'Configures client-side routes, lazy-loading, and global provider hierarchy'
      },
      purpose: {
        ja: 'アプリケーションの最上位ルートコンポーネントです。認証・多言語・テーマなどの Provider を正しい順序で重ね、URL ごとの画面描画をルーティングします。',
        en: 'Top-level root component configuring provider hierarchies (Auth, Theme, i18n) and client-side page routing.'
      },
      breakdown: {
        ja: [
          '1. `Provider Nesting`: LanguageProvider → AuthProvider → NotificationProvider の順で依存関係を解決',
          '2. `React.lazy / Suspense`: 各画面（Dashboard, GroupChat, MyNotes等）をコード分割して初回表示を超高速化',
          '3. `Route Guarding`: 未ログインユーザーをログイン画面へ自動リダイレクトする保護ルート設定'
        ],
        en: [
          '1. `Provider Nesting`: Wraps global contexts in proper dependency order (Language → Auth → Notifications)',
          '2. `React.lazy / Suspense`: Code-splits pages to minimize initial bundle size and boost page speed',
          '3. `Route Guarding`: Protects private application routes from unauthenticated access'
        ]
      },
      proTip: {
        ja: 'Provider の階層順序は重要です。例えば AuthProvider の中で多言語テキストを使うなら、LanguageProvider をより外側に配置する必要があります。',
        en: 'Provider hierarchy matters: Always wrap low-level context providers (i18n, Theme) outside high-level ones (Auth, Chat).'
      }
    },
    'firebase': {
      summary: {
        ja: 'Firebase Client SDK（Auth, Firestore, Analytics）の初期化とインスタンスのエクスポート',
        en: 'Initializes and exports Firebase Client SDK (Auth, Firestore, Analytics)'
      },
      purpose: {
        ja: 'Firebase の各種クラウドサービス（認証・データベース・キャッシュ設定）を一括初期化し、アプリ全体で共有するシングルトン接続を提供します。',
        en: 'Initializes Firebase Cloud SDK services and exports shared singleton instances (auth, db, analytics).'
      },
      breakdown: {
        ja: [
          '1. `initializeApp`: 環境変数（VITE_FIREBASE_*）を読み込んで Firebase プロジェクトに接続',
          '2. `getFirestore / initializeFirestore`: オフラインキャッシュ（IndexedDB永続化）を有効化',
          '3. `getAuth`: 認証インスタンスをエクスポートし、セキュリティトークンを管理'
        ],
        en: [
          '1. `initializeApp`: Connects to Firebase project using environment variables (VITE_FIREBASE_*)',
          '2. `initializeFirestore`: Configures local offline IndexedDB persistence for lightning-fast reads',
          '3. `getAuth`: Exports shared Authentication instance for user credential management'
        ]
      },
      proTip: {
        ja: 'Firestore の初期化で `enableIndexedDbPersistence` を設定しておくことで、地下鉄などのオフライン環境でも過去のノートを読み込めるようになります。',
        en: 'Enabling IndexedDB offline persistence ensures users can read scriptures and notes even without an active internet connection.'
      }
    }
  };

  // Match specific dictionary key
  for (const [key, val] of Object.entries(dict)) {
    if (base === key || base === key.replace(/-/g, '')) {
      return val;
    }
  }

  // 2. Intelligent Layer-aware Fallback Generator
  const layer = meta ? meta.layer : 1;
  const featureName = base.replace(/^(use-|comp-)/, '').replace(/-?(modal|card|form|provider|service|view|engine|logic)$/, '').replace(/-/g, ' ');

  const layerTemplates = {
    0: {
      summary: {
        ja: `「${featureName}」のルート設定とアプリケーション起動エントリポイント`,
        en: `Root entry point and configuration bootstrapping for ${featureName}`
      },
      purpose: {
        ja: `アプリケーションの土台として、グローバルな状態配信・ルーティング・初期化処理を司る起点モジュールです。`,
        en: `Foundation module orchestrating global providers, routing pipelines, and application bootstrapping.`
      },
      breakdown: {
        ja: [
          `1. 初期化ロジック: アプリ起動時に必要な設定を確実にロード`,
          `2. ルーティング & 分岐: URL や認証状態に応じた適切な画面の出し分け`,
          `3. コンテキスト供給: 下位の全コンポーネントで利用可能な基盤を提供`
        ],
        en: [
          `1. Initialization: Safely bootstraps application configuration on startup`,
          `2. Routing & Branching: Directs users to correct views based on authentication state`,
          `3. Global Contexts: Supplies shared services down to all nested components`
        ]
      },
      proTip: {
        ja: `ルート層をシンプルに保つことで、アプリ全体の起動パフォーマンスが向上し、予期せぬ初期化バグを防げます。`,
        en: `Keeping the entry layer lightweight improves initial load times and eliminates startup race conditions.`
      }
    },
    1: {
      summary: {
        ja: `「${featureName}」に関する画面表示とユーザー操作を受け付けるUIコンポーネント`,
        en: `UI component handling screen rendering and user interactions for ${featureName}`
      },
      purpose: {
        ja: `ユーザーに対して分かりやすいビジュアルを提供し、ボタンクリックやフォーム入力などの操作を検知して下位フックへ伝達します。`,
        en: `Presents intuitive visual interfaces to users, capturing user gestures and forwarding actions to underlying hooks.`
      },
      breakdown: {
        ja: [
          `1. 視覚的UIレンダリング: テーマや言語設定に応じたレスポンシブな画面描画`,
          `2. ユーザーイベント処理: onClick や onChange などの操作をスマートにハンドル`,
          `3. 状態の視覚化: ローディングスピナーやエラーアラートの適切な表示`
        ],
        en: [
          `1. Visual Rendering: Renders responsive interfaces matching active themes and locales`,
          `2. User Event Handling: Captures onClick/onChange inputs and triggers handlers`,
          `3. State Visualization: Contextually displays loading spinners and error alerts`
        ]
      },
      proTip: {
        ja: `UIコンポーネントの中に通信やデータ変換のコードを直接書かず、カスタムフックに任せることで、デザイン変更に強いコードになります。`,
        en: `Separating UI presentation from data fetching ensures component styling can be refactored without breaking business logic.`
      }
    },
    2: {
      summary: {
        ja: `「${featureName}」の状態管理・副作用・ビジネスロジックをカプセル化するカスタムフック`,
        en: `Custom hook encapsulating state management, side effects, and business logic for ${featureName}`
      },
      purpose: {
        ja: `画面（UI）と通信（API）の間に立ち、リアクティブな状態管理やバリデーション、データ整形を担当する頭脳の役割を果たします。`,
        en: `Serves as the brains between UI and APIs, managing reactive state, validations, and data transformations.`
      },
      breakdown: {
        ja: [
          `1. リアクティブ状態管理: useState や useReducer で画面に必要なデータをリアルタイム保持`,
          `2. 非同期アクションハンドラ: API 呼び出しや Firestore 更新などの非同期処理を実行`,
          `3. クリーンアップ & ライフサイクル: useEffect でリスナーの登録と確実な接続解除を制御`
        ],
        en: [
          `1. Reactive State: Manages component state using useState and useReducer`,
          `2. Async Action Handlers: Dispatches network requests and database updates`,
          `3. Lifecycle Management: Uses useEffect for automated setup and teardown`
        ]
      },
      proTip: {
        ja: `カスタムフックにロジックを抽出することで、同一の機能を別画面や別モーダルでも再利用できるようになります。`,
        en: `Extracting logic into custom hooks allows the same business logic to be shared across multiple screens and modals.`
      }
    },
    3: {
      summary: {
        ja: `「${featureName}」のデータ型スキーマ定義とグローバル状態コンテキスト`,
        en: `Data schema definitions and global context provider for ${featureName}`
      },
      purpose: {
        ja: `アプリ全体でやり取りされるデータの型（TypeScriptインターフェース）やバリデーション規則を定義し、型安全な状態配信を担います。`,
        en: `Defines TypeScript types, validation rules, and context providers for strict type-safe state distribution.`
      },
      breakdown: {
        ja: [
          `1. スキーマ & 型定義: ドキュメント構造やアクション型の厳格な型付け`,
          `2. Context API: 状態をアプリ全体へバケツリレーなしで届けるプロバイダー`,
          `3. 入力バリデーション: Zod や型ガードによる実行時データの検証`
        ],
        en: [
          `1. Type Schemas: Strongly types document structures and action objects`,
          `2. Context API: Supplies global state to nested trees without props drilling`,
          `3. Runtime Validation: Enforces schema correctness using Zod or custom type guards`
        ]
      },
      proTip: {
        ja: `型定義を中央集権化（types/）しておくことで、データベースの仕様変更があった際も TypeScript が修正箇所をすべて教えてくれます。`,
        en: `Centralizing type definitions ensures TypeScript immediately flags every file needing updates when data schemas change.`
      }
    },
    4: {
      summary: {
        ja: `「${featureName}」に関するバックエンド通信・トランザクション・外部API連携サービス`,
        en: `Backend service handling transactions, networking, and external APIs for ${featureName}`
      },
      purpose: {
        ja: `ネットワーク通信や複雑なデータ集計・トランザクション処理を実行し、クライアントへ安全にデータを返す役割を担います。`,
        en: `Executes database transactions, API calls, and computational workflows, returning structured data.`
      },
      breakdown: {
        ja: [
          `1. トランザクション制御: Firestore runTransaction 等によるデータ整合性の保護`,
          `2. セキュリティ & 認可: トークン検証や権限チェックによる不正アクセスの遮断`,
          `3. レスポンス正規化: 生データをフロントエンドが扱いやすい形式へ整形`
        ],
        en: [
          `1. Atomic Transactions: Guarantees ACID database consistency via transactions`,
          `2. Security & Auth: Enforces token validation and permission access control`,
          `3. Response Normalization: Formats raw data into clean frontend payloads`
        ]
      },
      proTip: {
        ja: `サービス層を独立させることで、フロントエンドのUI変更に影響されることなく、バックエンドの単体テスト（Vitest）を高速に実行できます。`,
        en: `Isolating the service layer enables lightning-fast automated unit testing independent of React UI rendering.`
      }
    },
    5: {
      summary: {
        ja: `「${featureName}」のインフラ構成・データベース永続化・セキュリティルール`,
        en: `Infrastructure setup, database persistence, and security rules for ${featureName}`
      },
      purpose: {
        ja: `クラウドインフラ（Firestore, Firebase Auth, Cloud Storage）との物理的な接続やセキュリティ境界を管理します。`,
        en: `Manages physical connections, offline storage caches, and security boundaries with cloud infrastructure.`
      },
      breakdown: {
        ja: [
          `1. SDK インスタンス管理: 初期化とシングルトン接続の維持`,
          `2. オフライン永続化: IndexedDB を活用したローカルキャッシュの制御`,
          `3. セキュリティルール: 悪意あるアクセスからデータベースを保護`
        ],
        en: [
          `1. SDK Instance Lifecycle: Maintains shared singleton connections to cloud services`,
          `2. Offline Storage: Configures IndexedDB caching for offline resilience`,
          `3. Security Rules: Protects database collections against unauthorized access`
        ]
      },
      proTip: {
        ja: `セキュリティルールを単体テスト（@firebase/rules-unit-testing）で自動検証しておくことで、本番環境での情報漏洩を確実に防止できます。`,
        en: `Automating Firestore Security Rules tests in CI/CD ensures private collections can never be exposed accidentally.`
      }
    }
  };

  return layerTemplates[layer] || layerTemplates[1];
}

// Classify layer / column for auto-layout
function classifyFile(relPath) {
  const normalized = relPath.replace(/\\/g, '/');

  if (normalized === 'src/main.tsx' || normalized === 'src/app.tsx') {
    return {
      layer: 0,
      category: { ja: 'Root / エントリ', en: 'Entry / Root' },
      col: 'entry',
      color: '#6366f1',
      badge: 'Root',
      role: {
        ja: 'アプリケーションのエントリポイント・ルート配線',
        en: 'Application entry point and root router / provider setup'
      }
    };
  }
  // Hooks check (including subcomponent hooks)
  if (normalized.includes('/hooks/') || normalized.includes('/use-') || path.basename(normalized).startsWith('use-')) {
    return {
      layer: 2,
      category: { ja: 'カスタムフック', en: 'Custom Hooks' },
      col: 'hook',
      color: '#ec4899',
      badge: 'Hook',
      role: {
        ja: 'UIと状態/ロジックを橋渡しし、リアクティブな状態を管理',
        en: 'Bridges UI with state/logic and manages reactive component lifecycles'
      }
    };
  }
  // Context & Store
  if (normalized.includes('/context/') || normalized.includes('/contexts/') || normalized.includes('/store/')) {
    return {
      layer: 3,
      category: { ja: 'Context & 状態', en: 'Context & State' },
      col: 'state',
      color: '#f59e0b',
      badge: 'State',
      role: {
        ja: 'アプリ全体に共有されるグローバル状態と認証セッションを供給',
        en: 'Provides global shared state, auth sessions, and user context'
      }
    };
  }
  // Types & Schemas
  if (normalized.includes('/types/') || normalized.includes('/locales/') || normalized.includes('schema')) {
    return {
      layer: 3,
      category: { ja: '型定義 & スキーマ', en: 'Types & Schemas' },
      col: 'state',
      color: '#8b5cf6',
      badge: 'Type',
      role: {
        ja: 'データ型定義・スキーマ・多言語リソース',
        en: 'Data contracts, TypeScript schemas, and i18n locale resources'
      }
    };
  }
  // Services & APIs
  if (normalized.includes('/services/') || normalized.includes('/service/') || normalized.startsWith('api/')) {
    return {
      layer: 4,
      category: { ja: 'サービス & API', en: 'Services & APIs' },
      col: 'service',
      color: '#10b981',
      badge: 'Service',
      role: {
        ja: 'ビジネスロジックの実行、外部通信、Firestoreトランザクション処理',
        en: 'Executes core business logic, network communication, and database transactions'
      }
    };
  }
  // Utils & Helpers
  if (normalized.includes('/utils/') || normalized.includes('/lib/')) {
    return {
      layer: 4,
      category: { ja: 'ユーティリティ', en: 'Utils & Helpers' },
      col: 'service',
      color: '#06b6d4',
      badge: 'Util',
      role: {
        ja: '共通ユーティリティ・フォーマッター・計算ヘルパー',
        en: 'Reusable utilities, date/text formatters, and calculation helpers'
      }
    };
  }
  // Infra & Backend
  if (normalized.includes('firebase') || normalized.includes('config') || normalized.includes('sw.')) {
    return {
      layer: 5,
      category: { ja: 'インフラ & DB', en: 'Infra & Backend' },
      col: 'infra',
      color: '#a855f7',
      badge: 'Infra',
      role: {
        ja: 'クラウドインフラ（Firebase Auth / Firestore / PWA ServiceWorker）との直接接続',
        en: 'Direct cloud integrations (Firebase Auth, Firestore, Service Worker)'
      }
    };
  }
  // UI Components
  if (normalized.includes('/components/') || normalized.includes('/groups/')) {
    return {
      layer: 1,
      category: { ja: 'UI コンポーネント', en: 'UI Components' },
      col: 'ui',
      color: '#38bdf8',
      badge: 'UI',
      role: {
        ja: 'ユーザー操作を受け付け、画面表示とイベントを発火',
        en: 'Handles user interaction, screen rendering, and event dispatching'
      }
    };
  }
  return {
    layer: 1,
    category: { ja: 'その他モジュール', en: 'Other Modules' },
    col: 'ui',
    color: '#94a3b8',
    badge: 'Module',
    role: {
      ja: 'サポートモジュール',
      en: 'Supporting component or utility module'
    }
  };
}

function scanDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(projectRoot, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git', '__tests__', 'mocks', 'test-results', 'coverage'].includes(entry.name)) {
        continue;
      }
      scanDirectory(fullPath);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (extensions.includes(ext) && !entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        const lineCount = lines.length;
        const meta = classifyFile(relPath);
        const doc = generateFileDescription(relPath, content, meta);

        const node = {
          id: relPath,
          name: entry.name,
          path: relPath,
          layer: meta.layer,
          category: meta.category,
          col: meta.col,
          color: meta.color,
          badge: meta.badge,
          role: meta.role,
          doc,
          lineCount,
          x: 0,
          y: 0
        };

        allNodes.push(node);
        nodeMap.set(relPath, { content, node });
      }
    }
  }
}

targetDirs.forEach(d => scanDirectory(path.join(projectRoot, d)));

// Resolve imports
const importRegex = /(?:import|export)\s+(?:(?:(?:\* as \w+|{[^}]+}|\w+)\s+from\s+)?['"]([^'"]+)['"])/g;

function resolveImport(sourceRelPath, importPath) {
  if (!importPath.startsWith('.')) {
    if (importPath.startsWith('@/')) {
      importPath = './src/' + importPath.slice(2);
    } else {
      return null;
    }
  }

  const sourceDir = path.dirname(path.join(projectRoot, sourceRelPath));
  const resolvedBase = path.resolve(sourceDir, importPath);

  const candidates = [
    resolvedBase,
    resolvedBase + '.ts',
    resolvedBase + '.tsx',
    resolvedBase + '.js',
    resolvedBase + '.jsx',
    path.join(resolvedBase, 'index.ts'),
    path.join(resolvedBase, 'index.tsx')
  ];

  for (const cand of candidates) {
    const candRel = path.relative(projectRoot, cand).replace(/\\/g, '/');
    if (nodeMap.has(candRel)) {
      return candRel;
    }
  }
  return null;
}

for (const [relPath, { content }] of nodeMap.entries()) {
  let match;
  const found = new Set();
  while ((match = importRegex.exec(content)) !== null) {
    const target = resolveImport(relPath, match[1]);
    if (target && target !== relPath && !found.has(target)) {
      found.add(target);
      allWires.push({
        source: relPath,
        target
      });
    }
  }
}

// Auto-layout by column & layer
const layerColumns = [
  { layer: 0, x: 60, title: { ja: '🚀 Root / エントリ', en: '🚀 Root / Entry' } },
  { layer: 1, x: 420, title: { ja: '🎨 UI コンポーネント', en: '🎨 UI Components' } },
  { layer: 2, x: 800, title: { ja: '⚡ カスタムフック', en: '⚡ Custom Hooks' } },
  { layer: 3, x: 1180, title: { ja: '📦 状態 & スキーマ', en: '📦 Context & Schemas' } },
  { layer: 4, x: 1560, title: { ja: '⚙️ サービス & API', en: '⚙️ Services & APIs' } },
  { layer: 5, x: 1940, title: { ja: '🔥 インフラ & DB', en: '🔥 Infra & Backend' } }
];

const nodesByLayer = {};
for (let i = 0; i <= 5; i++) {
  nodesByLayer[i] = [];
}

allNodes.forEach(node => {
  nodesByLayer[node.layer].push(node);
});

// Calculate positions
Object.keys(nodesByLayer).forEach(l => {
  nodesByLayer[l].sort((a, b) => a.name.localeCompare(b.name));
  const colDef = layerColumns[l];
  nodesByLayer[l].forEach((node, idx) => {
    node.x = colDef.x;
    node.y = 80 + idx * 88;
  });
});

// Precompute Downstream Tours
const connMap = new Map();
allNodes.forEach(n => connMap.set(n.id, { in: [], out: [] }));
allWires.forEach(w => {
  if (connMap.has(w.source)) connMap.get(w.source).out.push(w.target);
  if (connMap.has(w.target)) connMap.get(w.target).in.push(w.source);
});

function buildTourForNode(startNodeId) {
  const steps = [];
  const visited = new Set();
  const queue = [startNodeId];

  while (queue.length > 0) {
    const currId = queue.shift();
    if (visited.has(currId)) continue;
    visited.add(currId);

    const n = allNodes.find(x => x.id === currId);
    if (!n) continue;

    const outNodes = (connMap.get(currId)?.out || []).map(id => allNodes.find(x => x.id === id)).filter(Boolean);
    const inNodes = (connMap.get(currId)?.in || []).map(id => allNodes.find(x => x.id === id)).filter(Boolean);

    steps.push({
      nodeId: n.id,
      name: n.name,
      path: n.path,
      category: n.category,
      badge: n.badge,
      color: n.color,
      role: n.role,
      doc: n.doc,
      lineCount: n.lineCount,
      outSummary: outNodes.map(o => o.name).join(', '),
      inSummary: inNodes.map(i => i.name).join(', ')
    });

    outNodes.sort((a, b) => a.layer - b.layer);
    outNodes.forEach(child => {
      if (!visited.has(child.id)) {
        queue.push(child.id);
      }
    });
  }

  steps.sort((a, b) => {
    const nodeA = allNodes.find(x => x.id === a.nodeId);
    const nodeB = allNodes.find(x => x.id === b.nodeId);
    return (nodeA?.layer || 0) - (nodeB?.layer || 0);
  });

  return steps;
}

// 24 Curated preset tours with exact UI entry points
const presetTours = [
  // 🔐 認証 & アカウント
  {
    id: 'tour-login',
    group: 'auth',
    title: { ja: '🔐 ユーザー認証・ログイン (LoginForm)', en: '🔐 User Authentication & Login (LoginForm)' },
    startNode: 'src/components/loginform/login-form.tsx',
    altKw: 'loginform'
  },
  {
    id: 'tour-signup',
    group: 'auth',
    title: { ja: '📝 新規登録 & 初期設定 (SignupForm)', en: '📝 User Registration & Setup (SignupForm)' },
    startNode: 'src/components/signupform/signup-form.tsx',
    altKw: 'signupform'
  },
  {
    id: 'tour-profile',
    group: 'auth',
    title: { ja: '👤 プロファイル & 設定編集 (UserProfileModal)', en: '👤 User Profile & Settings (UserProfileModal)' },
    startNode: 'src/components/userprofilemodal/user-profile-modal.tsx',
    altKw: 'userprofilemodal'
  },
  {
    id: 'tour-forgot',
    group: 'auth',
    title: { ja: '🔑 パスワード再設定 (ForgotPassword)', en: '🔑 Password Reset Flow (ForgotPassword)' },
    startNode: 'src/components/forgotpassword/forgot-password.tsx',
    altKw: 'forgotpassword'
  },

  // 📖 聖句・ノート・習慣トラッカー
  {
    id: 'tour-newnote',
    group: 'notes',
    title: { ja: '✍️ 新規ノート作成 & 聖句タグ (NewNote)', en: '✍️ Create New Note & Scripture Tags (NewNote)' },
    startNode: 'src/components/newnote/new-note.tsx',
    altKw: 'newnote'
  },
  {
    id: 'tour-mynotes',
    group: 'notes',
    title: { ja: '📚 マイノート一覧・フィルタ (MyNotes)', en: '📚 My Notes List & Filtering (MyNotes)' },
    startNode: 'src/components/mynotes/my-notes.tsx',
    altKw: 'mynotes'
  },
  {
    id: 'tour-notedisplay',
    group: 'notes',
    title: { ja: '📄 ノート詳細 & カード表示 (NoteDisplay)', en: '📄 Note Details & Card Rendering (NoteDisplay)' },
    startNode: 'src/components/notedisplay/note-display.tsx',
    altKw: 'notedisplay'
  },
  {
    id: 'tour-dashboard',
    group: 'notes',
    title: { ja: '📊 習慣ダッシュボード & 記録 (Dashboard)', en: '📊 Habit Dashboard & Streaks (Dashboard)' },
    startNode: 'src/components/dashboard/dashboard.tsx',
    altKw: 'dashboard'
  },
  {
    id: 'tour-timecapsule',
    group: 'notes',
    title: { ja: '⏱️ タイムカプセル・未来の手紙 (TimeCapsule)', en: '⏱️ Time Capsule & Letters to Future Self (TimeCapsule)' },
    startNode: 'src/components/timecapsule/time-capsule.tsx',
    altKw: 'timecapsule'
  },
  {
    id: 'tour-letterbox',
    group: 'notes',
    title: { ja: '📬 レターボックス・手紙開封 (LetterBox)', en: '📬 Letter Box & Unlocking System (LetterBox)' },
    startNode: 'src/components/letterbox/letter-box.tsx',
    altKw: 'letterbox'
  },
  {
    id: 'tour-milestone',
    group: 'notes',
    title: { ja: '🏆 マイルストーン達成 (Milestone)', en: '🏆 Milestone Achievements (Milestone)' },
    startNode: 'src/components/milestone/milestone.tsx',
    altKw: 'milestone'
  },
  {
    id: 'tour-recap',
    group: 'notes',
    title: { ja: '🎬 習慣リキャップ・振り返り (RecapModal)', en: '🎬 Habit Recap & Reflections (RecapModal)' },
    startNode: 'src/components/recapmodal/recap-modal.tsx',
    altKw: 'recapmodal'
  },

  // 💬 グループ & コミュニティ
  {
    id: 'tour-groupchat',
    group: 'groups',
    title: { ja: '💬 グループチャット & 多言語翻訳 (GroupChat)', en: '💬 Group Chat & Multilingual Translation (GroupChat)' },
    startNode: 'src/components/groupchat/group-chat.tsx',
    altKw: 'groupchat'
  },
  {
    id: 'tour-groupform',
    group: 'groups',
    title: { ja: '👥 グループ作成 & 設定 (GroupForm)', en: '👥 Create & Configure Group (GroupForm)' },
    startNode: 'src/components/groupform/group-form.tsx',
    altKw: 'groupform'
  },
  {
    id: 'tour-groupcard',
    group: 'groups',
    title: { ja: '🎴 グループカード & 一覧 (GroupCard)', en: '🎴 Group Cards & Roster (GroupCard)' },
    startNode: 'src/groups/group-card.tsx',
    altKw: 'group-card'
  },
  {
    id: 'tour-groupoptions',
    group: 'groups',
    title: { ja: '⚙️ グループ設定・権限管理 (GroupOptions)', en: '⚙️ Group Settings & Permissions (GroupOptions)' },
    startNode: 'src/components/groupoptions/group-options.tsx',
    altKw: 'groupoptions'
  },
  {
    id: 'tour-invite',
    group: 'groups',
    title: { ja: '🔗 招待リンク & リダイレクト (InviteRedirect)', en: '🔗 Invite Links & Redirects (InviteRedirect)' },
    startNode: 'src/components/inviteredirect/invite-redirect.tsx',
    altKw: 'inviteredirect'
  },

  // ⚙️ プラットフォーム・UI・PWA
  {
    id: 'tour-root',
    group: 'platform',
    title: { ja: '🚀 アプリ起動 & ルート配線 (App.tsx)', en: '🚀 App Bootstrapping & Routing (App.tsx)' },
    startNode: 'src/app.tsx',
    altKw: 'app.tsx'
  },
  {
    id: 'tour-languages',
    group: 'platform',
    title: { ja: '🌐 多言語切り替え & 国際化 (Languages)', en: '🌐 Language Switcher & i18n (Languages)' },
    startNode: 'src/components/languages/languages.tsx',
    altKw: 'languages'
  },
  {
    id: 'tour-pwa',
    group: 'platform',
    title: { ja: '📱 PWA オフライン & アップデート (PwaUpdateHandler)', en: '📱 PWA Offline & Updates (PwaUpdateHandler)' },
    startNode: 'src/components/pwaupdatehandler/pwa-update-handler.tsx',
    altKw: 'pwaupdatehandler'
  },
  {
    id: 'tour-seo',
    group: 'platform',
    title: { ja: '🔍 SEO & OGPメタタグ管理 (SeoManager)', en: '🔍 SEO & OpenGraph Meta Management (SeoManager)' },
    startNode: 'src/components/seo-manager.tsx',
    altKw: 'seo-manager'
  },
  {
    id: 'tour-welcome',
    group: 'platform',
    title: { ja: '🎈 ウェルカムモーダル & オンボーディング (WelcomeStoryModal)', en: '🎈 Welcome Modal & Onboarding (WelcomeStoryModal)' },
    startNode: 'src/components/welcomestorymodal/welcome-story-modal.tsx',
    altKw: 'welcomestorymodal'
  },
  {
    id: 'tour-sidebar',
    group: 'platform',
    title: { ja: '📑 サイドバー & ナビゲーション (Sidebar)', en: '📑 Sidebar & Navigation (Sidebar)' },
    startNode: 'src/components/sidebar/sidebar.tsx',
    altKw: 'sidebar'
  },
  {
    id: 'tour-legal',
    group: 'platform',
    title: { ja: '⚖️ プライバシー & 利用規約 (PrivacyPolicy)', en: '⚖️ Privacy Policy & Terms (PrivacyPolicy)' },
    startNode: 'src/components/privacypolicy/privacy-policy.tsx',
    altKw: 'privacypolicy'
  }
];

function findStartNode(pt) {
  if (nodeMap.has(pt.startNode)) return pt.startNode;
  const kw = (pt.altKw || pt.id.replace('tour-', '')).toLowerCase();
  const candidates = allNodes.filter(n => n.id.toLowerCase().includes(kw));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    if (a.layer !== b.layer) return a.layer - b.layer;
    return a.id.length - b.id.length;
  });
  return candidates[0].id;
}

const prebuiltTours = {};
presetTours.forEach(pt => {
  const startId = findStartNode(pt);
  if (startId && nodeMap.has(startId)) {
    prebuiltTours[pt.id] = {
      id: pt.id,
      group: pt.group,
      title: pt.title,
      steps: buildTourForNode(startId)
    };
  }
});

const graphData = {
  nodes: allNodes,
  wires: allWires,
  columns: layerColumns,
  tours: prebuiltTours
};

// Generate HTML
const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scripture Habit - Interactive Architecture Tour & Blueprint</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      user-select: none;
    }
    body {
      background-color: #080c14;
      color: #f3f4f6;
      overflow: hidden;
      width: 100vw;
      height: 100vh;
    }
    #canvas-container {
      width: 100%;
      height: 100%;
      position: relative;
      background-size: 32px 32px;
      background-image: 
        radial-gradient(circle, rgba(56, 189, 248, 0.12) 1px, transparent 1px),
        linear-gradient(to right, rgba(255, 255, 255, 0.015) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
      cursor: grab;
    }
    #canvas-container:active {
      cursor: grabbing;
    }
    #viewport {
      position: absolute;
      top: 0;
      left: 0;
      transform-origin: 0 0;
      width: 6000px;
      height: 8000px;
    }
    .column-header {
      position: absolute;
      font-size: 0.85rem;
      font-weight: 700;
      color: #94a3b8;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 8px 16px;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      backdrop-filter: blur(8px);
      z-index: 1;
      pointer-events: none;
      transition: top 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s ease;
    }
    svg#wire-layer {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2;
    }
    .wire {
      fill: none;
      stroke: rgba(71, 85, 105, 0.35);
      stroke-width: 1.8;
      transition: stroke 0.2s, stroke-width 0.2s;
    }
    .wire.active {
      stroke: #38bdf8;
      stroke-width: 3.5;
      filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.9));
    }
    .wire-pulse {
      fill: none;
      stroke: #38bdf8;
      stroke-width: 3;
      stroke-dasharray: 8 16;
      animation: dash 1.5s linear infinite;
      opacity: 0.9;
    }
    @keyframes dash {
      to {
        stroke-dashoffset: -48;
      }
    }

    /* Nodes */
    .flow-node {
      position: absolute;
      width: 250px;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      box-shadow: 0 8px 20px -4px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(8px);
      z-index: 3;
      cursor: pointer;
      transition: box-shadow 0.2s, border-color 0.2s, opacity 0.2s, transform 0.2s, left 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), top 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .flow-node:hover {
      border-color: #38bdf8;
      box-shadow: 0 0 20px rgba(56, 189, 248, 0.35);
      z-index: 10;
    }
    .flow-node.highlighted {
      border-color: #38bdf8;
      box-shadow: 0 0 25px rgba(56, 189, 248, 0.7);
      z-index: 20;
    }
    .flow-node.tour-current {
      border-color: #ec4899 !important;
      box-shadow: 0 0 50px rgba(236, 72, 153, 1), 0 0 20px rgba(56, 189, 248, 0.9) !important;
      transform: scale(1.08) !important;
      z-index: 50 !important;
      opacity: 1 !important;
      filter: none !important;
    }
    .flow-node.tour-target {
      border-color: #38bdf8 !important;
      box-shadow: 0 0 35px rgba(56, 189, 248, 0.85) !important;
      transform: scale(1.02) !important;
      z-index: 40 !important;
      opacity: 1 !important;
      filter: none !important;
    }
    .flow-node.dimmed {
      opacity: 0.05 !important;
      filter: grayscale(90%) brightness(0.3) !important;
      pointer-events: none !important;
    }
    .node-header {
      padding: 6px 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top-left-radius: 7px;
      border-top-right-radius: 7px;
    }
    .node-badge {
      font-size: 0.62rem;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      color: #080c14;
    }
    .node-loc {
      font-size: 0.65rem;
      color: #64748b;
      font-family: monospace;
    }
    .node-title {
      font-size: 0.82rem;
      font-weight: 600;
      color: #fff;
      padding: 6px 10px 0 10px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .node-path {
      font-size: 0.65rem;
      color: #64748b;
      padding: 2px 10px 8px 10px;
      font-family: monospace;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .node-ports {
      display: flex;
      justify-content: space-between;
      padding: 4px 10px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 0.65rem;
      color: #94a3b8;
    }
    .pin {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #475569;
      margin: 0 4px;
      vertical-align: middle;
    }
    .pin.active {
      background: #38bdf8;
      box-shadow: 0 0 6px #38bdf8;
    }

    /* HUD */
    .hud {
      position: absolute;
      background: rgba(15, 23, 42, 0.88);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      padding: 14px;
      z-index: 100;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
    }
    #top-bar {
      top: 16px;
      left: 16px;
      max-width: 440px;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    h1 {
      font-size: 1.05rem;
      font-weight: 700;
      background: linear-gradient(135deg, #38bdf8 0%, #a855f7 100%);
      background-clip: text;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .lang-switcher {
      display: flex;
      gap: 4px;
    }
    .lang-btn {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #cbd5e1;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 0.68rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .lang-btn.active {
      background: #38bdf8;
      color: #080c14;
      font-weight: 700;
      border-color: #38bdf8;
    }
    .stats {
      font-size: 0.72rem;
      color: #94a3b8;
      display: flex;
      gap: 12px;
      margin-bottom: 10px;
    }
    .stat-val {
      font-weight: 700;
      color: #38bdf8;
    }
    .select-box {
      width: 100%;
      background: #1e293b;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      color: #fff;
      padding: 7px 10px;
      font-size: 0.8rem;
      outline: none;
      margin-bottom: 8px;
      cursor: pointer;
    }
    .select-box:focus {
      border-color: #38bdf8;
    }
    #search-box {
      width: 100%;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      color: #fff;
      padding: 6px 10px;
      font-size: 0.78rem;
      outline: none;
      margin-bottom: 8px;
    }
    .btn {
      background: #1e293b;
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #cbd5e1;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 0.72rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn:hover {
      background: #334155;
      color: #fff;
      border-color: #38bdf8;
    }
    .btn.active {
      background: #38bdf8;
      color: #080c14;
      font-weight: 700;
    }
    .btn-pink {
      background: #ec4899;
      color: #fff;
      border-color: #ec4899;
      font-weight: 700;
    }
    .btn-pink:hover {
      background: #db2777;
    }

    /* Tour Player HUD */
    #tour-player {
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      width: 560px;
      display: none;
      animation: slideUp 0.3s ease-out;
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translate(-50%, 20px); }
      to { opacity: 1; transform: translate(-50%, 0); }
    }
    .tour-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .tour-step-badge {
      font-size: 0.72rem;
      font-weight: 700;
      background: #ec4899;
      color: #fff;
      padding: 2px 8px;
      border-radius: 12px;
    }
    .tour-progress {
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      overflow: hidden;
      margin-bottom: 10px;
    }
    .tour-progress-bar {
      height: 100%;
      background: linear-gradient(to right, #38bdf8, #ec4899);
      width: 0%;
      transition: width 0.3s ease;
    }
    .tour-body {
      background: rgba(0, 0, 0, 0.25);
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 10px;
      font-size: 0.75rem;
      line-height: 1.5;
    }
    .tour-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Info Card */
    #info-card {
      top: 16px;
      right: 16px;
      width: 320px;
      display: none;
    }
    .card-title {
      font-weight: 700;
      font-size: 0.9rem;
      color: #fff;
      margin-bottom: 4px;
    }
    .card-path {
      font-size: 0.7rem;
      color: #94a3b8;
      font-family: monospace;
      word-break: break-all;
      margin-bottom: 8px;
    }
    .card-stats {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 6px;
      margin: 8px 0;
      text-align: center;
      background: rgba(255, 255, 255, 0.04);
      padding: 8px;
      border-radius: 6px;
      font-size: 0.7rem;
    }
    .card-list {
      max-height: 120px;
      overflow-y: auto;
      font-size: 0.68rem;
      color: #cbd5e1;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding-top: 6px;
      margin-top: 6px;
    }
    .card-list-item {
      padding: 2px 0;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div id="canvas-container">
    <div id="viewport">
      <svg id="wire-layer"></svg>
      <div id="columns-container"></div>
      <div id="nodes-container"></div>
    </div>
  </div>

  <!-- Main Top HUD -->
  <div id="top-bar" class="hud">
    <div class="header-row">
      <h1 id="i18n-title">⚡ Scripture Habit Docs</h1>
      <div class="lang-switcher">
        <button class="lang-btn active" id="lang-ja" onclick="setLanguage('ja')">🇯🇵 JA</button>
        <button class="lang-btn" id="lang-en" onclick="setLanguage('en')">🇺🇸 EN</button>
      </div>
    </div>

    <div class="stats">
      <span><span id="i18n-nodes-lbl">全ノード</span>: <span class="stat-val">${graphData.nodes.length}</span></span>
      <span><span id="i18n-wires-lbl">配線</span>: <span class="stat-val">${graphData.wires.length}</span></span>
    </div>

    <!-- Tour Preset Selector -->
    <div id="i18n-tour-label" style="font-weight: 600; font-size: 0.72rem; color: #94a3b8; margin-bottom: 4px;">📖 機能別ステップ解説ツアー:</div>
    <select id="tour-select" class="select-box" onchange="onSelectPresetTour(this.value)"></select>

    <input type="text" id="search-box" placeholder="🔍 ファイル名を検索 (Enterでジャンプ)..." />
    <div style="display: flex; gap: 6px;">
      <button class="btn" id="i18n-btn-reset" onclick="resetView()">🎯 視点リセット</button>
      <button class="btn" id="btn-anim" onclick="togglePulse()">⚡ 送受信パルス: OFF</button>
    </div>
  </div>

  <!-- Tour Player HUD -->
  <div id="tour-player" class="hud">
    <div class="tour-header">
      <div>
        <span id="tour-step-badge" class="tour-step-badge">STEP 1 / 5</span>
        <span id="tour-title" style="font-weight: 700; font-size: 0.85rem; margin-left: 8px; color: #fff;"></span>
      </div>
      <button class="btn" id="i18n-tour-exit" style="padding: 2px 8px;" onclick="stopTour()">✕ 終了</button>
    </div>

    <div class="tour-progress">
      <div id="tour-progress-bar" class="tour-progress-bar"></div>
    </div>

    <div class="tour-body">
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span id="tour-curr-node" style="font-weight: 700; color: #38bdf8; font-size: 0.85rem;"></span>
        <span id="tour-curr-layer" class="node-badge"></span>
      </div>
      <div id="tour-curr-doc" style="color: #e2e8f0; margin-bottom: 6px;"></div>
      <div style="font-size: 0.7rem; color: #94a3b8; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 4px;">
        <div><b id="i18n-in-lbl">⬅️ 入力元:</b> <span id="tour-in-summary" style="color: #cbd5e1;"></span></div>
        <div><b id="i18n-out-lbl">➡️ 送信先:</b> <span id="tour-out-summary" style="color: #38bdf8;"></span></div>
      </div>
    </div>

    <div class="tour-controls">
      <button class="btn" id="tour-btn-prev" onclick="prevTourStep()">⏮️ 前のステップ</button>
      <button class="btn" id="tour-btn-autoplay" onclick="toggleAutoplay()">▶️ 自動再生</button>
      <button class="btn btn-pink" id="tour-btn-next" onclick="nextTourStep()">次のステップ ⏭️</button>
    </div>
  </div>

  <!-- Info Card (Click Explore Mode) -->
  <div id="info-card" class="hud">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <span id="card-badge" class="node-badge"></span>
      <button class="btn" id="i18n-card-close" style="padding: 2px 6px; font-size: 0.65rem;" onclick="clearFocus()">✕ 閉じる</button>
    </div>
    <div id="card-name" class="card-title" style="margin-top: 6px;"></div>
    <div id="card-path" class="card-path"></div>
    <button class="btn btn-pink" id="i18n-start-node-tour" style="width: 100%; margin-bottom: 8px;" onclick="startDynamicTourFromSelected()">⚡ このファイルからツアーを開始</button>
    <div class="card-stats">
      <div><b id="card-loc">0</b><br><span id="i18n-stat-loc">行数</span></div>
      <div><b id="card-out">0</b><br><span id="i18n-stat-out">参照先</span></div>
      <div><b id="card-in">0</b><br><span id="i18n-stat-in">被参照</span></div>
    </div>
    <div id="card-doc" style="font-size: 0.72rem; color: #cbd5e1; margin-bottom: 6px; padding: 4px; background: rgba(255,255,255,0.03); border-radius: 4px;"></div>
    <div id="i18n-conns-lbl" style="font-weight: 600; font-size: 0.7rem; color: #94a3b8;">🔗 接続ファイル:</div>
    <div id="card-connections" class="card-list"></div>
  </div>

  <script>
    const data = ${JSON.stringify(graphData)};

    // UI Translation Strings
    const i18n = {
      ja: {
        title: "⚡ Scripture Habit アーキテクチャ解説ツアー",
        nodesLbl: "全ノード",
        wiresLbl: "配線",
        tourSelectLabel: "📖 機能別ステップ解説ツアー:",
        tourSelectPlaceholder: "-- ツアーを選択して解説を開始 (${Object.keys(prebuiltTours).length}コース) --",
        searchPlaceholder: "🔍 ファイル名を検索 (Enterでジャンプ)...",
        resetView: "🎯 視点リセット",
        pulseOn: "⚡ 送受信パルス: ON",
        pulseOff: "⚡ 送受信パルス: OFF",
        exit: "✕ 終了",
        close: "✕ 閉じる",
        inLbl: "⬅️ 入力元:",
        outLbl: "➡️ 送信先:",
        prevStep: "⏮️ 前のステップ",
        nextStep: "次のステップ ⏭️",
        finishTour: "✕ ツアー終了",
        autoPlay: "▶️ 自動再生",
        pause: "⏸️ 一時停止",
        tourFinished: "🎉 ツアーが完了しました！",
        startNodeTour: "⚡ このファイルからツアーを開始",
        loc: "行数",
        outbound: "参照先",
        inbound: "被参照",
        conns: "🔗 接続ファイル:",
        inNone: "なし (起点)",
        outNone: "なし (終端)",
        notFound: "該当するファイルが見つかりませんでした",
        optgroups: {
          auth: "🔐 認証 & アカウント",
          notes: "📖 聖句・ノート・習慣トラッカー",
          groups: "💬 グループ & コミュニティ",
          platform: "⚙️ プラットフォーム・UI・PWA"
        }
      },
      en: {
        title: "⚡ Scripture Habit Architecture Tour",
        nodesLbl: "Total Nodes",
        wiresLbl: "Wires",
        tourSelectLabel: "📖 Feature-by-Feature Guided Tours:",
        tourSelectPlaceholder: "-- Select a tour to begin walkthrough (${Object.keys(prebuiltTours).length} tours) --",
        searchPlaceholder: "🔍 Search file by name (Press Enter)...",
        resetView: "🎯 Reset View",
        pulseOn: "⚡ Signal Pulse: ON",
        pulseOff: "⚡ Signal Pulse: OFF",
        exit: "✕ Exit",
        close: "✕ Close",
        inLbl: "⬅️ Inbound from:",
        outLbl: "➡️ Outbound to:",
        prevStep: "⏮️ Prev Step",
        nextStep: "Next Step ⏭️",
        finishTour: "✕ Finish Tour",
        autoPlay: "▶️ Auto-play",
        pause: "⏸️ Pause",
        tourFinished: "🎉 Tour completed!",
        startNodeTour: "⚡ Start tour from this file",
        loc: "LOC",
        outbound: "Imports",
        inbound: "Used by",
        conns: "🔗 Connected Files:",
        inNone: "None (Origin)",
        outNone: "None (Terminal)",
        notFound: "Matching file not found",
        optgroups: {
          auth: "🔐 Auth & Accounts",
          notes: "📖 Scripture, Notes & Habits",
          groups: "💬 Groups & Community",
          platform: "⚙️ Platform, UI & PWA"
        }
      }
    };

    let currentLang = 'ja';

    // Precalculate connections
    const connMap = new Map();
    data.nodes.forEach(n => connMap.set(n.id, { in: [], out: [] }));
    data.wires.forEach(w => {
      if (connMap.has(w.source)) connMap.get(w.source).out.push(w.target);
      if (connMap.has(w.target)) connMap.get(w.target).in.push(w.source);
    });

    let zoom = 0.55;
    let panX = 40;
    let panY = 20;
    let isPulseActive = false;
    let selectedNodeId = null;

    // Cache original positions
    data.nodes.forEach(n => {
      n.origX = n.x;
      n.origY = n.y;
    });

    // Tour State
    let activeTour = null;
    let currentStepIdx = 0;
    let autoplayTimer = null;

    const viewport = document.getElementById('viewport');
    const nodesContainer = document.getElementById('nodes-container');
    const colsContainer = document.getElementById('columns-container');
    const wireLayer = document.getElementById('wire-layer');
    const container = document.getElementById('canvas-container');

    // Language Toggle Function
    function setLanguage(lang) {
      currentLang = lang;
      document.getElementById('lang-ja').classList.toggle('active', lang === 'ja');
      document.getElementById('lang-en').classList.toggle('active', lang === 'en');

      const t = i18n[lang];
      document.getElementById('i18n-title').innerText = t.title;
      document.getElementById('i18n-nodes-lbl').innerText = t.nodesLbl;
      document.getElementById('i18n-wires-lbl').innerText = t.wiresLbl;
      document.getElementById('i18n-tour-label').innerText = t.tourSelectLabel;
      document.getElementById('search-box').placeholder = t.searchPlaceholder;
      document.getElementById('i18n-btn-reset').innerText = t.resetView;
      document.getElementById('btn-anim').innerText = isPulseActive ? t.pulseOn : t.pulseOff;
      document.getElementById('i18n-tour-exit').innerText = t.exit;
      document.getElementById('i18n-card-close').innerText = t.close;
      document.getElementById('i18n-in-lbl').innerText = t.inLbl;
      document.getElementById('i18n-out-lbl').innerText = t.outLbl;
      document.getElementById('tour-btn-prev').innerText = t.prevStep;
      document.getElementById('tour-btn-next').innerText = t.nextStep;
      document.getElementById('tour-btn-autoplay').innerText = autoplayTimer ? t.pause : t.autoPlay;
      document.getElementById('i18n-start-node-tour').innerText = t.startNodeTour;
      document.getElementById('i18n-stat-loc').innerText = t.loc;
      document.getElementById('i18n-stat-out').innerText = t.outbound;
      document.getElementById('i18n-stat-in').innerText = t.inbound;
      document.getElementById('i18n-conns-lbl').innerText = t.conns;

      // Update Column Headers
      colsContainer.innerHTML = '';
      data.columns.forEach(col => {
        const header = document.createElement('div');
        header.className = 'column-header';
        header.id = 'col-header-' + col.layer;
        header.innerText = typeof col.title === 'object' ? col.title[lang] : col.title;
        header.style.left = col.x + 'px';
        header.style.top = '20px';
        colsContainer.appendChild(header);
      });

      // Update Dropdown Options
      populateTourDropdown();

      // Update Active Tour HUD if running
      if (activeTour) {
        document.getElementById('tour-title').innerText = typeof activeTour.title === 'object' ? activeTour.title[lang] : activeTour.title;
        renderTourStep();
      }
      if (selectedNodeId) {
        focusNode(selectedNodeId);
      }
    }

    function populateTourDropdown() {
      const select = document.getElementById('tour-select');
      const curVal = select.value;
      select.innerHTML = '';

      const t = i18n[currentLang];
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.innerText = t.tourSelectPlaceholder;
      select.appendChild(defaultOpt);

      const groups = ['auth', 'notes', 'groups', 'platform'];
      groups.forEach(gKey => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = t.optgroups[gKey];

        Object.values(data.tours).filter(tour => tour.group === gKey).forEach(tour => {
          const opt = document.createElement('option');
          opt.value = tour.id;
          opt.innerText = typeof tour.title === 'object' ? tour.title[currentLang] : tour.title;
          optgroup.appendChild(opt);
        });

        select.appendChild(optgroup);
      });

      select.value = curVal;
    }

    // Pan & Zoom
    let isDraggingCanvas = false;
    let startX, startY;

    container.addEventListener('mousedown', (e) => {
      if (e.target === container || e.target === viewport || e.target.tagName === 'svg') {
        isDraggingCanvas = true;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (isDraggingCanvas) {
        panX = e.clientX - startX;
        panY = e.clientY - startY;
        updateTransform();
      }
    });

    window.addEventListener('mouseup', () => {
      isDraggingCanvas = false;
    });

    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      zoom = Math.max(0.15, Math.min(2.0, zoom * factor));
      updateTransform();
    });

    function updateTransform() {
      viewport.style.transform = 'translate(' + panX + 'px, ' + panY + 'px) scale(' + zoom + ')';
    }

    // Render Nodes
    function renderNodes() {
      nodesContainer.innerHTML = '';
      data.nodes.forEach(node => {
        const div = document.createElement('div');
        div.className = 'flow-node';
        div.id = 'node-' + node.id.replace(/[^a-zA-Z0-9]/g, '_');
        div.setAttribute('data-node-id', node.id);
        div.style.left = node.x + 'px';
        div.style.top = node.y + 'px';

        const conns = connMap.get(node.id) || { in: [], out: [] };

        div.innerHTML = \`
          <div class="node-header" style="background: \${node.color}22;">
            <span class="node-badge" style="background: \${node.color};">\${node.badge}</span>
            <span class="node-loc">\${node.lineCount} LOC</span>
          </div>
          <div class="node-title" title="\${node.name}">\${node.name}</div>
          <div class="node-path" title="\${node.path}">\${node.path}</div>
          <div class="node-ports">
            <div><span class="pin \${conns.in.length > 0 ? 'active' : ''}"></span> In: \${conns.in.length}</div>
            <div>Out: \${conns.out.length} <span class="pin \${conns.out.length > 0 ? 'active' : ''}"></span></div>
          </div>
        \`;

        div.addEventListener('click', (e) => {
          e.stopPropagation();
          focusNode(node.id);
        });

        nodesContainer.appendChild(div);
      });

      drawWires();
    }

    // Draw Bezier Wires
    function drawWires() {
      wireLayer.innerHTML = '';
      const nodeDict = new Map(data.nodes.map(n => [n.id, n]));

      // Active wire set calculation
      const activeWireSet = new Set();
      if (activeTour) {
        const step = activeTour.steps[currentStepIdx];
        if (step) {
          (connMap.get(step.nodeId)?.out || []).forEach(o => activeWireSet.add(step.nodeId + '->' + o));
        }
      } else if (selectedNodeId) {
        (connMap.get(selectedNodeId)?.out || []).forEach(o => activeWireSet.add(selectedNodeId + '->' + o));
        (connMap.get(selectedNodeId)?.in || []).forEach(i => activeWireSet.add(i + '->' + selectedNodeId));
      }

      data.wires.forEach(w => {
        const from = nodeDict.get(w.source);
        const to = nodeDict.get(w.target);
        if (!from || !to) return;

        const isWireActive = activeWireSet.has(w.source + '->' + w.target);

        // Skip non-active wires during tour/selection for high clarity
        if ((selectedNodeId || activeTour) && !isWireActive) return;

        const x1 = from.x + 250;
        const y1 = from.y + 40;
        const x2 = to.x;
        const y2 = to.y + 40;

        const dx = Math.max(40, Math.abs(x2 - x1) * 0.45);
        const d = 'M ' + x1 + ' ' + y1 + ' C ' + (x1 + dx) + ' ' + y1 + ', ' + (x2 - dx) + ' ' + y2 + ', ' + x2 + ' ' + y2;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('class', 'wire ' + (isWireActive ? 'active' : ''));
        wireLayer.appendChild(path);

        if (isPulseActive || isWireActive) {
          const pulse = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          pulse.setAttribute('d', d);
          pulse.setAttribute('class', 'wire-pulse');
          if (isWireActive) {
            pulse.style.stroke = '#38bdf8';
            pulse.style.strokeWidth = '4';
          }
          wireLayer.appendChild(pulse);
        }
      });
    }

    // Node Focus in Explore Mode
    function focusNode(id) {
      if (activeTour) stopTour();
      selectedNodeId = id;
      const node = data.nodes.find(n => n.id === id);
      if (!node) return;

      const conns = connMap.get(id) || { in: [], out: [] };
      const related = new Set([id, ...conns.in, ...conns.out]);

      document.querySelectorAll('.flow-node').forEach(el => {
        const nodeId = el.getAttribute('data-node-id');
        if (nodeId && (nodeId === id || related.has(nodeId))) {
          el.classList.add('highlighted');
          el.classList.remove('dimmed');
        } else {
          el.classList.remove('highlighted');
          el.classList.add('dimmed');
        }
      });

      // Show Info Card
      const card = document.getElementById('info-card');
      card.style.display = 'block';
      const badge = document.getElementById('card-badge');
      badge.innerText = typeof node.category === 'object' ? node.category[currentLang] : node.category;
      badge.style.background = node.color;
      document.getElementById('card-name').innerText = node.name;
      document.getElementById('card-path').innerText = node.path;
      document.getElementById('card-loc').innerText = node.lineCount;
      document.getElementById('card-out').innerText = conns.out.length;
      document.getElementById('card-in').innerText = conns.in.length;

      const docObj = typeof node.doc === 'object' ? node.doc : {};
      const purpose = docObj.purpose ? docObj.purpose[currentLang] : (docObj.summary ? docObj.summary[currentLang] : '');
      const breakdown = docObj.breakdown ? (docObj.breakdown[currentLang] || []).map(b => '<div style="padding: 2px 0;">' + b + '</div>').join('') : '';
      const proTip = docObj.proTip ? docObj.proTip[currentLang] : '';

      let docHtml = '';
      if (purpose) {
        docHtml += '<div style="margin-bottom: 6px; font-weight: 600; color: #f8fafc;">💡 ' + purpose + '</div>';
      }
      if (breakdown) {
        docHtml += '<div style="margin-bottom: 6px; padding: 6px; background: rgba(56, 189, 248, 0.06); border-radius: 6px; border-left: 2px solid #38bdf8; font-size: 0.72rem; color: #cbd5e1;">' + breakdown + '</div>';
      }
      if (proTip) {
        docHtml += '<div style="font-size: 0.7rem; color: #ec4899; background: rgba(236, 72, 153, 0.08); padding: 4px 6px; border-radius: 4px; margin-bottom: 6px;">💡 <b>Pro Tip:</b> ' + proTip + '</div>';
      }
      if (!docHtml) {
        docHtml = (typeof node.role === 'object' ? node.role[currentLang] : node.role) || '';
      }
      document.getElementById('card-doc').innerHTML = docHtml;

      const list = document.getElementById('card-connections');
      list.innerHTML = '';
      const t = i18n[currentLang];
      conns.out.forEach(o => {
        const item = document.createElement('div');
        item.className = 'card-list-item';
        item.innerHTML = '<span style="color: #38bdf8;">➔ ' + t.outbound + ':</span> ' + o;
        list.appendChild(item);
      });
      conns.in.forEach(i => {
        const item = document.createElement('div');
        item.className = 'card-list-item';
        item.innerHTML = '<span style="color: #a855f7;">⬅ ' + t.inbound + ':</span> ' + i;
        list.appendChild(item);
      });

      drawWires();
    }

    function clearFocus() {
      selectedNodeId = null;
      document.querySelectorAll('.flow-node').forEach(el => {
        el.classList.remove('highlighted', 'dimmed', 'tour-current', 'tour-target');
      });
      document.getElementById('info-card').style.display = 'none';
      drawWires();
    }

    // ==========================================
    // TOUR ENGINE (STORY MODE WITH COMPACT STAGE)
    // ==========================================
    function startTour(tourObj) {
      if (!tourObj || !tourObj.steps || tourObj.steps.length === 0) {
        alert(i18n[currentLang].notFound);
        return;
      }
      clearFocus();
      activeTour = tourObj;
      currentStepIdx = 0;

      // Arrange nodes on compact horizontal tour stage
      const tourNodeSet = new Set(tourObj.steps.map(s => s.nodeId));
      tourObj.steps.forEach(s => {
        (connMap.get(s.nodeId)?.out || []).forEach(o => tourNodeSet.add(o));
      });

      const stageLayers = {};
      tourNodeSet.forEach(nodeId => {
        const n = data.nodes.find(x => x.id === nodeId);
        if (n) {
          if (!stageLayers[n.layer]) stageLayers[n.layer] = [];
          stageLayers[n.layer].push(n);
        }
      });

      const rowGap = 110;

      // Dynamically position column headers cleanly above the topmost node of each active layer
      data.columns.forEach(c => {
        const header = document.getElementById('col-header-' + c.layer);
        if (header) {
          const nodesInLayer = stageLayers[c.layer];
          if (nodesInLayer && nodesInLayer.length > 0) {
            const totalInLayer = nodesInLayer.length;
            const startY = Math.max(90, 360 - ((totalInLayer - 1) * rowGap) / 2);
            header.style.top = (startY - 48) + 'px';
            header.style.opacity = '1';
          } else {
            header.style.opacity = '0.08';
          }
        }
      });

      Object.keys(stageLayers).forEach(layerKeyStr => {
        const layerKey = Number(layerKeyStr);
        const nodesInLayer = stageLayers[layerKey];
        const totalInLayer = nodesInLayer.length;
        const colDef = data.columns.find(c => c.layer === layerKey) || { x: 420 };
        const colCenterX = colDef.x;
        const startY = Math.max(90, 360 - ((totalInLayer - 1) * rowGap) / 2);

        nodesInLayer.forEach((n, rowIndex) => {
          n.x = colCenterX;
          n.y = startY + rowIndex * rowGap;

          const el = document.getElementById('node-' + n.id.replace(/[^a-zA-Z0-9]/g, '_'));
          if (el) {
            el.style.left = n.x + 'px';
            el.style.top = n.y + 'px';
          }
        });
      });

      // Animate wires as nodes morph into stage positions
      let animFrames = 0;
      function glideLoop() {
        drawWires();
        animFrames++;
        if (animFrames < 25) requestAnimationFrame(glideLoop);
      }
      requestAnimationFrame(glideLoop);

      document.getElementById('tour-player').style.display = 'block';
      document.getElementById('tour-title').innerText = typeof tourObj.title === 'object' ? tourObj.title[currentLang] : tourObj.title;

      renderTourStep();
    }

    function renderTourStep() {
      if (!activeTour) return;
      const step = activeTour.steps[currentStepIdx];
      if (!step) return;

      const t = i18n[currentLang];
      const total = activeTour.steps.length;
      document.getElementById('tour-step-badge').innerText = 'STEP ' + (currentStepIdx + 1) + ' / ' + total;
      document.getElementById('tour-progress-bar').style.width = (((currentStepIdx + 1) / total) * 100) + '%';

      document.getElementById('tour-curr-node').innerText = step.name;
      const badge = document.getElementById('tour-curr-layer');
      badge.innerText = typeof step.category === 'object' ? step.category[currentLang] : step.category;
      badge.style.background = step.color;

      const docObj = typeof step.doc === 'object' ? step.doc : {};
      const purpose = docObj.purpose ? docObj.purpose[currentLang] : (docObj.summary ? docObj.summary[currentLang] : '');
      const breakdown = docObj.breakdown ? (docObj.breakdown[currentLang] || []).map(b => '<div style="padding: 2px 0;">' + b + '</div>').join('') : '';
      const proTip = docObj.proTip ? docObj.proTip[currentLang] : '';

      let docHtml = '';
      if (purpose) {
        docHtml += '<div style="margin-bottom: 6px; font-weight: 600; color: #f8fafc;">💡 ' + purpose + '</div>';
      }
      if (breakdown) {
        docHtml += '<div style="margin-bottom: 6px; padding: 6px; background: rgba(56, 189, 248, 0.06); border-radius: 6px; border-left: 2px solid #38bdf8; font-size: 0.72rem; color: #cbd5e1;">' + breakdown + '</div>';
      }
      if (proTip) {
        docHtml += '<div style="font-size: 0.7rem; color: #ec4899; background: rgba(236, 72, 153, 0.08); padding: 4px 6px; border-radius: 4px; margin-bottom: 6px;">💡 <b>Pro Tip:</b> ' + proTip + '</div>';
      }
      if (!docHtml) {
        docHtml = (typeof step.role === 'object' ? step.role[currentLang] : step.role) || '';
      }
      document.getElementById('tour-curr-doc').innerHTML = docHtml;

      document.getElementById('tour-in-summary').innerText = step.inSummary || t.inNone;
      document.getElementById('tour-out-summary').innerText = step.outSummary || t.outNone;

      // Get destination nodes (送信先)
      const outNodeIds = new Set(connMap.get(step.nodeId)?.out || []);

      // Update Node Highlight
      document.querySelectorAll('.flow-node').forEach(el => {
        const nodeId = el.getAttribute('data-node-id');
        if (nodeId === step.nodeId) {
          el.classList.add('tour-current');
          el.classList.remove('dimmed', 'highlighted', 'tour-target');
        } else if (outNodeIds.has(nodeId)) {
          el.classList.add('tour-target');
          el.classList.remove('dimmed', 'highlighted', 'tour-current');
        } else {
          el.classList.add('dimmed');
          el.classList.remove('highlighted', 'tour-current', 'tour-target');
        }
      });

      // Update Next / Prev button states
      const nextBtn = document.getElementById('tour-btn-next');
      const prevBtn = document.getElementById('tour-btn-prev');
      const isLastStep = currentStepIdx === total - 1;

      if (isLastStep) {
        nextBtn.innerText = t.finishTour;
      } else {
        nextBtn.innerText = t.nextStep;
      }

      if (currentStepIdx === 0) {
        prevBtn.style.opacity = '0.35';
        prevBtn.style.pointerEvents = 'none';
      } else {
        prevBtn.style.opacity = '1';
        prevBtn.style.pointerEvents = 'auto';
      }

      // Fly Camera to active step node on the compact stage
      const targetNode = data.nodes.find(n => n.id === step.nodeId);
      if (targetNode) {
        zoom = 0.85;
        panX = window.innerWidth / 3 - targetNode.x * zoom - 125 * zoom;
        panY = window.innerHeight / 2 - targetNode.y * zoom - 40 * zoom;
        updateTransform();
      }

      drawWires();
    }

    function nextTourStep() {
      if (!activeTour) return;
      if (currentStepIdx < activeTour.steps.length - 1) {
        currentStepIdx++;
        renderTourStep();
      } else {
        stopTour();
      }
    }

    function prevTourStep() {
      if (!activeTour) return;
      if (currentStepIdx > 0) {
        currentStepIdx--;
        renderTourStep();
      }
    }

    function stopTour() {
      stopAutoplay();
      activeTour = null;
      document.getElementById('tour-player').style.display = 'none';
      document.getElementById('tour-select').value = '';

      // Restore column headers to default top 20px
      data.columns.forEach(c => {
        const header = document.getElementById('col-header-' + c.layer);
        if (header) {
          header.style.top = '20px';
          header.style.opacity = '1';
        }
      });

      // Restore original positions
      data.nodes.forEach(n => {
        n.x = n.origX;
        n.y = n.origY;
        const el = document.getElementById('node-' + n.id.replace(/[^a-zA-Z0-9]/g, '_'));
        if (el) {
          el.style.left = n.x + 'px';
          el.style.top = n.y + 'px';
        }
      });

      let animFrames = 0;
      function returnLoop() {
        drawWires();
        animFrames++;
        if (animFrames < 25) requestAnimationFrame(returnLoop);
      }
      requestAnimationFrame(returnLoop);

      clearFocus();
      resetView();
    }

    function toggleAutoplay() {
      const t = i18n[currentLang];
      if (autoplayTimer) {
        stopAutoplay();
      } else {
        document.getElementById('tour-btn-autoplay').innerText = t.pause;
        autoplayTimer = setInterval(() => {
          if (currentStepIdx < activeTour.steps.length - 1) {
            nextTourStep();
          } else {
            stopAutoplay();
          }
        }, 3200);
      }
    }

    function stopAutoplay() {
      if (autoplayTimer) {
        clearInterval(autoplayTimer);
        autoplayTimer = null;
      }
      document.getElementById('tour-btn-autoplay').innerText = i18n[currentLang].autoPlay;
    }

    function onSelectPresetTour(tourId) {
      if (!tourId) {
        stopTour();
        return;
      }
      const tour = data.tours[tourId];
      if (tour) {
        startTour(tour);
      }
    }

    function buildClientTour(startNodeId) {
      const steps = [];
      const visited = new Set();
      const queue = [startNodeId];

      while (queue.length > 0) {
        const currId = queue.shift();
        if (visited.has(currId)) continue;
        visited.add(currId);

        const n = data.nodes.find(x => x.id === currId);
        if (!n) continue;

        const outNodes = (connMap.get(currId)?.out || []).map(id => data.nodes.find(x => x.id === id)).filter(Boolean);
        const inNodes = (connMap.get(currId)?.in || []).map(id => data.nodes.find(x => x.id === id)).filter(Boolean);

        steps.push({
          nodeId: n.id,
          name: n.name,
          path: n.path,
          category: n.category,
          badge: n.badge,
          color: n.color,
          role: n.role,
          doc: n.doc,
          lineCount: n.lineCount,
          outSummary: outNodes.map(o => o.name).join(', '),
          inSummary: inNodes.map(i => i.name).join(', ')
        });

        outNodes.sort((a, b) => (a.layer || 0) - (b.layer || 0));
        outNodes.forEach(child => {
          if (!visited.has(child.id)) {
            queue.push(child.id);
          }
        });
      }

      steps.sort((a, b) => {
        const nodeA = data.nodes.find(x => x.id === a.nodeId);
        const nodeB = data.nodes.find(x => x.id === b.nodeId);
        return (nodeA?.layer || 0) - (nodeB?.layer || 0);
      });

      return steps;
    }

    function startDynamicTourFromSelected() {
      if (!selectedNodeId) return;
      const node = data.nodes.find(n => n.id === selectedNodeId);
      if (!node) return;

      const dynamicTour = {
        id: 'dynamic-' + node.id,
        title: {
          ja: '⚡ ' + node.name + ' から始まるデータフロー',
          en: '⚡ Data flow starting from ' + node.name
        },
        steps: buildClientTour(node.id)
      };

      startTour(dynamicTour);
    }

    // Search
    const searchBox = document.getElementById('search-box');
    searchBox.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const query = searchBox.value.trim().toLowerCase();
        if (!query) return;
        const found = data.nodes.find(n => n.name.toLowerCase().includes(query) || n.path.toLowerCase().includes(query));
        if (found) {
          focusNode(found.id);
          panX = window.innerWidth / 2 - found.x * zoom - 120 * zoom;
          panY = window.innerHeight / 2 - found.y * zoom - 40 * zoom;
          updateTransform();
        } else {
          alert(i18n[currentLang].notFound);
        }
      }
    });

    function resetView() {
      panX = 40;
      panY = 20;
      zoom = 0.55;
      updateTransform();
    }

    function togglePulse() {
      isPulseActive = !isPulseActive;
      const btn = document.getElementById('btn-anim');
      const t = i18n[currentLang];
      btn.innerText = isPulseActive ? t.pulseOn : t.pulseOff;
      btn.classList.toggle('active', isPulseActive);
      drawWires();
    }

    container.addEventListener('click', (e) => {
      if (e.target === container || e.target === viewport || e.target.tagName === 'svg') {
        if (!activeTour) clearFocus();
      }
    });

    // Initialize UI and Language
    const urlParams = new URLSearchParams(window.location.search);
    const initLang = urlParams.get('lang') || 'ja';
    setLanguage(initLang === 'en' ? 'en' : 'ja');
    updateTransform();
    renderNodes();

    // Auto-start tour from URL parameter (?tour=tour-groupchat or #tour-groupchat)
    const tourParam = urlParams.get('tour') || window.location.hash.replace('#', '');
    if (tourParam && data.tours[tourParam]) {
      document.getElementById('tour-select').value = tourParam;
      startTour(data.tours[tourParam]);
    }
  </script>
</body>
</html>
`;

// Write to docs/architecture-tour.html, code-flow.html, and docs/public/architecture-tour.html
fs.writeFileSync(path.join(projectRoot, 'docs', 'architecture-tour.html'), html, 'utf8');
fs.writeFileSync(path.join(projectRoot, 'code-flow.html'), html, 'utf8');

const docsPublic = path.join(projectRoot, 'docs', 'public');
if (!fs.existsSync(docsPublic)) {
  fs.mkdirSync(docsPublic, { recursive: true });
}
fs.writeFileSync(path.join(docsPublic, 'architecture-tour.html'), html, 'utf8');

console.log(`✅ Generated Bilingual Architecture Tour with ${allNodes.length} nodes, ${allWires.length} wires, and ${Object.keys(prebuiltTours).length} preset tours!`);

// Generate 24 VS Code CodeTour (.tour) files into .tours/
const toursDir = path.join(projectRoot, '.tours');
if (!fs.existsSync(toursDir)) {
  fs.mkdirSync(toursDir, { recursive: true });
}

const tourFileNames = {
  'tour-login': 'arch-01-user-authentication-and-login.tour',
  'tour-signup': 'arch-02-user-registration-and-setup.tour',
  'tour-profile': 'arch-03-user-profile-and-settings.tour',
  'tour-forgot': 'arch-04-password-reset-flow.tour',
  'tour-newnote': 'arch-05-create-new-note-and-scripture-tags.tour',
  'tour-mynotes': 'arch-06-my-notes-list-and-search.tour',
  'tour-notedisplay': 'arch-07-note-details-and-card-rendering.tour',
  'tour-dashboard': 'arch-08-habit-dashboard-and-streaks.tour',
  'tour-timecapsule': 'arch-09-time-capsule-and-future-letters.tour',
  'tour-letterbox': 'arch-10-letter-box-and-unlocking-system.tour',
  'tour-milestone': 'arch-11-milestone-achievements.tour',
  'tour-recap': 'arch-12-habit-recap-and-reflections.tour',
  'tour-groupchat': 'arch-13-group-chat-and-multilingual-translation.tour',
  'tour-groupform': 'arch-14-create-and-configure-group.tour',
  'tour-groupcard': 'arch-15-group-cards-and-roster.tour',
  'tour-groupoptions': 'arch-16-group-settings-and-permissions.tour',
  'tour-invite': 'arch-17-invite-links-and-redirects.tour',
  'tour-root': 'arch-18-app-bootstrapping-and-routing.tour',
  'tour-languages': 'arch-19-language-switcher-and-i18n.tour',
  'tour-pwa': 'arch-20-pwa-offline-and-updates.tour',
  'tour-seo': 'arch-21-seo-and-opengraph-meta-management.tour',
  'tour-welcome': 'arch-22-welcome-modal-and-onboarding.tour',
  'tour-sidebar': 'arch-23-sidebar-and-navigation.tour',
  'tour-legal': 'arch-24-privacy-policy-and-terms.tour'
};

const layerJaNames = {
  0: 'ルート / エントリー',
  1: 'UI コンポーネント層',
  2: 'カスタムフック層',
  3: '状態 & スキーマ層',
  4: 'サービス & API層',
  5: 'インフラ & データベース層'
};

const layerEnNames = {
  0: 'Root / Entry',
  1: 'UI Component Layer',
  2: 'Custom Hook Layer',
  3: 'State & Schema Layer',
  4: 'Service & API Layer',
  5: 'Infra & Database Layer'
};

let archTourCount = 0;
presetTours.forEach((pt, pIdx) => {
  const tourData = prebuiltTours[pt.id];
  if (!tourData) return;

  const fileName = tourFileNames[pt.id] || `arch-${String(pIdx + 1).padStart(2, '0')}-${pt.id.replace('tour-', '')}.tour`;
  const tourFilePath = path.join(toursDir, fileName);

  const cleanTitleJa = pt.title.ja.replace(/^[^\w\s\u3000-\u30FF\u4E00-\u9FA0\uFF00-\uFFEF]+/, '').trim();
  const cleanTitleEn = pt.title.en.replace(/^[^\w\s]+/, '').trim();
  const numStr = String(pIdx + 1).padStart(2, '0');

  const tourObj = {
    $schema: "https://aka.ms/codetour-schema",
    title: `Architecture ${numStr}: ${cleanTitleEn} / ${cleanTitleJa}`,
    tags: [
      "Architecture",
      "End-to-End Flow",
      pt.group,
      pt.id
    ],
    steps: tourData.steps.map((step, sIdx) => {
      const stepNum = sIdx + 1;
      const totalSteps = tourData.steps.length;
      const node = allNodes.find(n => n.id === step.nodeId);
      const layerNum = node ? node.layer : 1;
      const layerJa = layerJaNames[layerNum] || 'モジュール層';
      const layerEn = layerEnNames[layerNum] || 'Module Layer';

      const inSummaryEn = step.inSummary ? step.inSummary : 'None (Entry Point)';
      const outSummaryEn = step.outSummary ? step.outSummary : 'None (Terminal Leaf)';
      const inSummaryJa = step.inSummary ? step.inSummary : 'なし (起点 / エントリーポイント)';
      const outSummaryJa = step.outSummary ? step.outSummary : 'なし (終端 / 末端モジュール)';

      const doc = step.doc || {};
      const purposeEn = (doc.purpose && doc.purpose.en) ? doc.purpose.en : ((doc.summary && doc.summary.en) ? doc.summary.en : 'Handles application processing in this architectural layer.');
      const purposeJa = (doc.purpose && doc.purpose.ja) ? doc.purpose.ja : ((doc.summary && doc.summary.ja) ? doc.summary.ja : 'この階層におけるデータ処理と操作を担当します。');

      const breakdownListEn = (doc.breakdown && Array.isArray(doc.breakdown.en)) ? doc.breakdown.en : [
        `1. Module Execution: Handles incoming actions and state updates`,
        `2. Downstream Forwarding: Dispatches events to lower architectural layers`
      ];
      const breakdownListJa = (doc.breakdown && Array.isArray(doc.breakdown.ja)) ? doc.breakdown.ja : [
        `1. モジュールの実行: 上位からのアクションやデータ更新を安全に処理`,
        `2. 下位へのリレー: 次の階層へイベントやデータを伝達`
      ];

      const breakdownEn = breakdownListEn.join('\n');
      const breakdownJa = breakdownListJa.join('\n');

      const proTipEn = (doc.proTip && doc.proTip.en) ? doc.proTip.en : `Maintaining clear separation of concerns in Layer ${layerNum} keeps components modular, reusable, and easily testable.`;
      const proTipJa = (doc.proTip && doc.proTip.ja) ? doc.proTip.ja : `第${layerNum}層の関心事を明確に分離しておくことで、コンポーネントの再利用性とテスト容易性が大幅に向上します。`;

      const desc = [
        `### Step ${stepNum}/${totalSteps}. ${step.badge} ${step.name} (${layerEn})`,
        ``,
        `#### 💡 Architectural Purpose & Why It Exists`,
        `${purposeEn}`,
        ``,
        `#### 🔍 Beginner's Code Breakdown`,
        `${breakdownEn}`,
        ``,
        `#### 🔄 Data Flow Relay`,
        `- **Inbound from**: ${inSummaryEn}`,
        `- **Outbound to**: ${outSummaryEn}`,
        ``,
        `#### 💡 Pro Tip: Best Practices`,
        `${proTipEn}`,
        ``,
        `---`,
        ``,
        `### Step ${stepNum}/${totalSteps}. ${step.badge} ${step.name} (${layerJa})`,
        ``,
        `#### 💡 アーキテクチャ上の設計意図（なぜこの層にこのファイルが必要？）`,
        `${purposeJa}`,
        ``,
        `#### 🔍 初心者向けコードの読み解きポイント（主要関数と仕組み）`,
        `${breakdownJa}`,
        ``,
        `#### 🔄 データの流れ（データリレー）`,
        `- **⬅️ 入力元**: ${inSummaryJa}`,
        `- **➡️ 送信先**: ${outSummaryJa}`,
        ``,
        `#### 💡 プロの知恵・なぜこう書くのか？`,
        `${proTipJa}`
      ].join('\n');

      return {
        file: step.path.replace(/\\/g, '/'),
        description: desc,
        line: 1
      };
    })
  };

  fs.writeFileSync(tourFilePath, JSON.stringify(tourObj, null, 2), 'utf8');
  archTourCount++;
});

console.log(`📦 Generated ${archTourCount} CodeTour (.tour) files in .tours/`);


// Automatic Doc Callout Link Mapping (Clean language-separated, no emojis)
const docTourMappings = [
  { file: 'docs/architecture.md', tourId: 'tour-root', titleJa: 'アプリ起動 & 全体配線', titleEn: 'App Bootstrapping & Routing' },
  { file: 'docs/database-security.md', tourId: 'tour-login', titleJa: 'ユーザー認証・ログイン', titleEn: 'User Authentication & Login' },
  { file: 'docs/firebase-security-rules.md', tourId: 'tour-login', titleJa: 'ユーザー認証・ログイン', titleEn: 'User Authentication & Login' },
  { file: 'docs/groupchat-construction-guide.md', tourId: 'tour-groupchat', titleJa: 'グループチャット & 多言語翻訳', titleEn: 'Group Chat & Multilingual Translation' },
  { file: 'docs/feature-chat-dashboard.md', tourId: 'tour-groupchat', titleJa: 'グループチャット & 多言語翻訳', titleEn: 'Group Chat & Multilingual Translation' },
  { file: 'docs/group-invites.md', tourId: 'tour-invite', titleJa: '招待リンク & リダイレクト', titleEn: 'Invite Links & Redirects' },
  { file: 'docs/unity-participation.md', tourId: 'tour-groupchat', titleJa: 'グループチャット & 団結力', titleEn: 'Group Chat & Unity Score' },
  { file: 'docs/newnote-construction-guide.md', tourId: 'tour-newnote', titleJa: '新規ノート作成 & 聖句タグ', titleEn: 'Create New Note & Scripture Tags' },
  { file: 'docs/logic-note-posting.md', tourId: 'tour-newnote', titleJa: '新規ノート作成 & 投稿フロー', titleEn: 'Note Posting Flow' },
  { file: 'docs/dashboard-mynotes-construction-guide.md', tourId: 'tour-dashboard', titleJa: '習慣ダッシュボード & 記録', titleEn: 'Habit Dashboard & Streaks' },
  { file: 'docs/ux-letters-to-future-self.md', tourId: 'tour-timecapsule', titleJa: 'タイムカプセル・未来の手紙', titleEn: 'Time Capsule & Future Letters' },
  { file: 'docs/logic-milestone-retention.md', tourId: 'tour-milestone', titleJa: 'マイルストーン達成 & カプセル報酬', titleEn: 'Milestone Achievements' },
  { file: 'docs/ux-ai-reflection-letters.md', tourId: 'tour-recap', titleJa: '習慣リキャップ & 振り返り', titleEn: 'Habit Recap & Reflections' },
  { file: 'docs/feature-ai-integration.md', tourId: 'tour-newnote', titleJa: 'Gemini AI聖句インサイト & ノート生成', titleEn: 'Gemini AI Insights & Notes' },
  { file: 'docs/logic-i18n.md', tourId: 'tour-languages', titleJa: '多言語切り替え & 国際化', titleEn: 'Language Switcher & i18n' },
  { file: 'docs/seo-and-meta-management.md', tourId: 'tour-seo', titleJa: 'SEO & OGPメタタグ管理', titleEn: 'SEO & OpenGraph Meta Management' },
  { file: 'docs/hybrid-mobile-lifecycle.md', tourId: 'tour-pwa', titleJa: 'PWA オフライン & アップデート', titleEn: 'PWA Offline & Lifecycle' },
  { file: 'docs/gospel-library-mapper.md', tourId: 'tour-newnote', titleJa: '聖句リンク & 福音ライブラリ連携', titleEn: 'Gospel Library Mapper' },
  { file: 'docs/firestore-transactions-counters.md', tourId: 'tour-groupchat', titleJa: 'グループ & トランザクション処理', titleEn: 'Group Transactions & Counters' },
  { file: 'docs/firestore-offline-persistence.md', tourId: 'tour-pwa', titleJa: 'PWA オフライン永続化', titleEn: 'Offline Persistence' },
  { file: 'docs/inactivity-and-autokick.md', tourId: 'tour-groupoptions', titleJa: 'グループ設定 & メンバー管理', titleEn: 'Group Settings & Auto-kick' },
  { file: 'docs/profile-sync-anonymization.md', tourId: 'tour-profile', titleJa: 'プロファイル & 設定編集', titleEn: 'User Profile & Settings' },
  { file: 'docs/client-unity-midnight-reset.md', tourId: 'tour-dashboard', titleJa: '習慣ダッシュボード & 日次リセット', titleEn: 'Habit Dashboard & Reset' },
  { file: 'docs/development-guide.md', tourId: 'tour-root', titleJa: 'アプリ起動 & 全体配線', titleEn: 'App Bootstrapping & Routing' }
];

let injectedCount = 0;
docTourMappings.forEach(item => {
  const calloutRegex = /(?::*>*\s*\[!TIP\][^\n]*\n(?:>[^\n]*\n?)*|:{1,}\s*(?:tip|::: tip)[\s\S]*?:{1,})/;

  // 1. Process English document (docs/*.md)
  const fullEnPath = path.join(projectRoot, item.file);
  if (fs.existsSync(fullEnPath)) {
    const enContent = fs.readFileSync(fullEnPath, 'utf8');
    const enCallout = `> [!TIP]\n> **Interactive Architecture Tour**: [Open Live Tour (${item.titleEn})](https://htmlpreview.github.io/?https://github.com/ScriptureHabit/scripture-habit/blob/main/docs/public/architecture-tour.html?tour=${item.tourId}&lang=en)`;

    let updatedEn;
    if (calloutRegex.test(enContent)) {
      updatedEn = enContent.replace(calloutRegex, enCallout);
    } else {
      const h1Match = enContent.match(/^#\s+.+$/m);
      if (h1Match) {
        updatedEn = enContent.replace(h1Match[0], `${h1Match[0]}\n\n${enCallout}`);
      } else {
        updatedEn = `${enCallout}\n\n${enContent}`;
      }
    }
    // Clean up excessive 3+ consecutive newlines
    updatedEn = updatedEn.replace(/\n{3,}/g, '\n\n');
    if (updatedEn !== enContent) {
      fs.writeFileSync(fullEnPath, updatedEn, 'utf8');
      injectedCount++;
    }
  }

  // 2. Process Japanese document (docs/ja/*.md)
  const relJaPath = item.file.replace(/^docs\//, 'docs/ja/');
  const fullJaPath = path.join(projectRoot, relJaPath);
  if (fs.existsSync(fullJaPath)) {
    const jaContent = fs.readFileSync(fullJaPath, 'utf8');
    const jaCallout = `> [!TIP]\n> **インタラクティブ・アーキテクチャツアー**: [ブラウザでツアーを開く (${item.titleJa})](https://htmlpreview.github.io/?https://github.com/ScriptureHabit/scripture-habit/blob/main/docs/public/architecture-tour.html?tour=${item.tourId}&lang=ja)`;

    let updatedJa;
    if (calloutRegex.test(jaContent)) {
      updatedJa = jaContent.replace(calloutRegex, jaCallout);
    } else {
      const h1Match = jaContent.match(/^#\s+.+$/m);
      if (h1Match) {
        updatedJa = jaContent.replace(h1Match[0], `${h1Match[0]}\n\n${jaCallout}`);
      } else {
        updatedJa = `${jaCallout}\n\n${jaContent}`;
      }
    }
    // Clean up excessive 3+ consecutive newlines
    updatedJa = updatedJa.replace(/\n{3,}/g, '\n\n');
    if (updatedJa !== jaContent) {
      fs.writeFileSync(fullJaPath, updatedJa, 'utf8');
      injectedCount++;
    }
  }
});

console.log(`🔗 Updated language-appropriate callouts across ${injectedCount} documentation files.`);

