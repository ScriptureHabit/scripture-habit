import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const targetDirs = ['src', 'api'];
const extensions = ['.ts', '.tsx', '.js', '.jsx'];

const allNodes = [];
const allWires = [];
const nodeMap = new Map();

// Generate file-specific bilingual description based on domain dictionaries & heuristics
function generateFileDescription(relPath, content, meta) {
  const norm = relPath.replace(/\\/g, '/').toLowerCase();
  const base = path.basename(norm, path.extname(norm));

  // 1. Specific file mappings for Scripture Habit codebase
  const dict = {
    'login-form': {
      ja: 'ログイン入力フォームのバリデーション、セッション確立、エラー制御UI',
      en: 'Login form input validation, session creation, and error handling UI'
    },
    'use-login-form': {
      ja: 'ログインフォームの入力値管理、Firebase Auth認証実行、エラー制御フック',
      en: 'Manages login form input state, executes Firebase Auth, and handles errors'
    },
    'signup-form': {
      ja: '新規ユーザー登録フォームの入力検証、アカウント初期化、Firestore初期データ作成UI',
      en: 'User sign-up form validation, account initialization, and Firestore setup UI'
    },
    'use-signup-form': {
      ja: '新規登録のバリデーション、初期言語/タイムゾーン設定、アカウント作成フック',
      en: 'Handles registration validation, initial locale/timezone, and account creation'
    },
    'user-profile-modal': {
      ja: 'ユーザーニックネーム・アイコン・タイムゾーン設定の編集モーダルUI',
      en: 'Modal UI for editing user nickname, avatar, and timezone settings'
    },
    'use-user-profile': {
      ja: 'ユーザープロファイル情報の取得、更新バリデーション、Firestore保存フック',
      en: 'Fetches user profile, validates changes, and saves updates to Firestore'
    },
    'auth-provider': {
      ja: 'Firebase Auth状態監視（onAuthStateChanged）とグローバル認証セッションの供給',
      en: 'Listens to Firebase Auth state changes and supplies global user session'
    },
    'use-auth': {
      ja: '現在のログインユーザー情報、認証トークン、ログイン/ログアウト操作へのアクセス',
      en: 'Provides access to current user session, auth token, and login/logout methods'
    },
    'forgot-password': {
      ja: 'パスワード再設定メール送信リクエストの入力画面UI',
      en: 'UI for requesting password reset emails'
    },
    'use-forgot-password': {
      ja: 'パスワード再設定メールの送信要求とエラー通知の管理フック',
      en: 'Manages password reset email dispatch and feedback notifications'
    },
    'new-note': {
      ja: '新規ノート作成・編集画面UI、文字数カウント、聖句引用タグ付け',
      en: 'UI for creating and editing notes, character count validation, and scripture tagging'
    },
    'use-note-form': {
      ja: 'ノート作成フォームの入力値・聖句選択状態・タグの管理フック',
      en: 'Manages note form inputs, scripture selections, and category tags'
    },
    'use-note-submission': {
      ja: 'ノートデータのFirestore保存、画像添付、更新完了イベントの制御フック',
      en: 'Handles note persistence to Firestore, attachments, and submit lifecycle'
    },
    'use-ai-generator': {
      ja: 'Gemini AIを活用した聖句の自動要約・振り返り質問・インサイト生成フック',
      en: 'Generates AI summaries, reflection questions, and insights via Gemini AI'
    },
    'note-logic': {
      ja: 'ノートデータの正規化、検索用トークン生成、Firestore保存データ構造の組み立て',
      en: 'Normalizes note data, generates search tokens, and constructs Firestore payload'
    },
    'my-notes': {
      ja: '保存済みノート一覧画面UI、聖句別・日付別フィルタリング、全文検索',
      en: 'List view for saved user notes with scripture/date filtering and full-text search'
    },
    'use-my-notes': {
      ja: 'ユーザーのノート一覧の非同期取得、ページネーション、検索クエリ管理フック',
      en: 'Asynchronously fetches user notes, manages pagination, and applies search filters'
    },
    'note-display': {
      ja: 'ノート詳細ビュー、リッチテキスト/Markdown表示、操作メニューUI',
      en: 'Detailed note view with Markdown rendering and action menus'
    },
    'note-card': {
      ja: '一覧画面用のコンパクトなノートカード表示コンポーネント',
      en: 'Compact card component for displaying note summaries in lists'
    },
    'dashboard': {
      ja: '習慣継続ストリーク、今日の進捗、未読通知、マイルストーンの総合ダッシュボードUI',
      en: 'Unified dashboard UI for habit streaks, daily progress, notifications, and milestones'
    },
    'use-today': {
      ja: '今日の日付、ストリーク達成判定、日次リセット状態の管理フック',
      en: 'Manages today\'s progress, consecutive streak calculation, and midnight reset'
    },
    'time-capsule': {
      ja: '未来の自分へのメッセージ暗号化、開封日タイマー設定、タイムカプセル作成UI',
      en: 'UI for composing encrypted letters to future self with unlock timers'
    },
    'use-time-capsule': {
      ja: 'タイムカプセルの作成・暗号化・Firestore保存・開封予定日管理フック',
      en: 'Handles encryption, Firestore storage, and unlock scheduling for time capsules'
    },
    'letter-box': {
      ja: '開封可能になった過去からの手紙一覧とレター開封モーダルUI',
      en: 'Inbox UI for viewing and unlocking available time capsule letters'
    },
    'use-letter-availability': {
      ja: 'タイムカプセルの開封予定日と現在日時を照合し、開封可能状態をリアルタイム判定',
      en: 'Compares capsule unlock dates with current time to determine availability'
    },
    'milestone': {
      ja: '習慣継続マイルストーン達成時の祝賀演出とカプセル報酬表示UI',
      en: 'Celebration screen and time-capsule rewards upon reaching habit milestones'
    },
    'use-milestone-capsule': {
      ja: 'マイルストーン達成判定と特別タイムカプセルのアンロック処理フック',
      en: 'Checks milestone thresholds and unlocks exclusive milestone capsules'
    },
    'recap-modal': {
      ja: '月間・年間の習慣達成率、ハイライトノートの振り返りスライドショーモーダル',
      en: 'Modal presenting monthly/annual habit recap statistics and highlighted notes'
    },
    'use-recap': {
      ja: '月間習慣データ・読了聖句数・投稿ノートの集計とリキャップスライド生成フック',
      en: 'Aggregates monthly habit statistics, scripture counts, and recap slide data'
    },
    'group-chat': {
      ja: 'リアルタイムグループチャット画面UI、多言語メッセージ送受信、未読管理',
      en: 'Real-time group chat UI with multilingual messaging and unread markers'
    },
    'chat-provider': {
      ja: 'グループチャットのリアルタイムFirestoreリスナーとメッセージ状態の供給',
      en: 'Provides real-time Firestore chat subscription and message state'
    },
    'use-group-translation': {
      ja: '多言語メンバー間チャットのリアルタイム自動翻訳とキャッシュ管理フック',
      en: 'Manages real-time translation for group messages with local caching'
    },
    'use-group-actions': {
      ja: 'グループ参加・退出・メンバー権限変更などのAPIアクション制御フック',
      en: 'Handles group join, leave, and member permission management actions'
    },
    'group-service': {
      ja: 'グループ関連のFirestoreトランザクション（作成・メンバー管理・招待コード検証）処理',
      en: 'Handles Firestore operations for group creation, members, and invite verification'
    },
    'invite-redirect': {
      ja: 'グループ招待URLのパラメータ解析、トークン検証、ワンクリック参加処理コンポーネント',
      en: 'Parses invite URLs, validates tokens, and executes 1-click group joining'
    },
    'use-unity-score': {
      ja: 'グループ全員の今日の習慣達成率から団結力（Unity Score）をリアルタイム算出',
      en: 'Calculates real-time group Unity Score from members daily habit completions'
    },
    'unity-modal': {
      ja: 'グループメンバー全員の習慣達成状況と団結力スコアを表示するモーダルUI',
      en: 'Modal displaying member habit progress and collective Unity Score'
    },
    'app': {
      ja: '全画面ルーティング、遅延コンポーネントロード、グローバルProvider階層の統括構成',
      en: 'Configures client-side routes, lazy-loading, and global provider hierarchy'
    },
    'main': {
      ja: 'React 19 Rootのマウント、Service Workerの初期登録エントリポイント',
      en: 'Mounts React 19 root and registers Service Worker'
    },
    'firebase': {
      ja: 'Firebase Client SDK（Auth, Firestore, Analytics）の初期化とインスタンスのエクスポート',
      en: 'Initializes and exports Firebase Client SDK (Auth, Firestore, Analytics)'
    },
    'firebase-config': {
      ja: '環境変数からのFirebaseプロジェクト設定ロードと初期構成オブジェクト',
      en: 'Loads Firebase project configuration and environment variables'
    },
    'languages': {
      ja: '多言語（日本語・英語など）切り替えドロップダウン・UIセレクター',
      en: 'Language selector dropdown and locale switcher UI'
    },
    'use-language': {
      ja: '現在の言語設定、翻訳辞書（t関数）、言語切り替えロジックを提供するフック',
      en: 'Provides active language, translation helper function, and locale switcher'
    },
    'language-provider': {
      ja: 'アプリ全体にi18n翻訳コンテキストと現在のロケール状態を供給するProvider',
      en: 'Supplies global i18n translation context and active locale to the app'
    },
    'pwa-update-handler': {
      ja: 'Service Workerの新規バージョン検知とPWAアプリアップデート催促バナーUI',
      en: 'Detects Service Worker updates and displays PWA refresh banner'
    },
    'seo-manager': {
      ja: '動的OGPメタタグ、ページタイトル、Twitter Cardメタデータの動的生成・更新',
      en: 'Dynamically updates page title, OpenGraph tags, and Twitter Card metadata'
    },
    'cookie-consent': {
      ja: 'Cookie利用同意バナーの表示とユーザー同意設定のローカル保存',
      en: 'Displays Cookie consent banner and persists user preference'
    },
    'sidebar': {
      ja: 'アプリ全体のグローバルナビゲーション、画面遷移リンク、ユーザー情報表示サイドバー',
      en: 'Global navigation sidebar with page links and user profile status'
    },
    'privacy-policy': {
      ja: 'プライバシーポリシー・個人情報保護方針の閲覧画面コンポーネント',
      en: 'Privacy policy and data protection terms view component'
    },
    'terms-of-service': {
      ja: '利用規約・サービス利用約款の閲覧画面コンポーネント',
      en: 'Terms of Service and legal disclosure view component'
    }
  };

  // Match specific dictionary key
  for (const [key, val] of Object.entries(dict)) {
    if (base === key || base === key.replace(/-/g, '')) {
      return val;
    }
  }

  // 2. Fallback heuristic pattern matcher
  if (base.startsWith('use-')) {
    const featureName = base.replace(/^use-/, '').replace(/-/g, ' ');
    return {
      ja: `「${featureName}」に関する状態管理と操作ロジックを提供するカスタムフック`,
      en: `Custom hook providing reactive state and handlers for ${featureName}`
    };
  }

  if (base.endsWith('-modal') || base.endsWith('modal')) {
    const featureName = base.replace(/-?modal$/, '').replace(/-/g, ' ');
    return {
      ja: `「${featureName}」の操作・確認ダイアログを表示するモーダルUIコンポーネント`,
      en: `Modal dialog component for ${featureName} actions`
    };
  }

  if (base.endsWith('-card') || base.endsWith('card')) {
    const featureName = base.replace(/-?card$/, '').replace(/-/g, ' ');
    return {
      ja: `「${featureName}」の情報をコンパクトに表示するカードコンポーネント`,
      en: `Card component displaying ${featureName} summary`
    };
  }

  if (norm.includes('/utils/') || norm.includes('/lib/')) {
    const featureName = base.replace(/-/g, ' ');
    return {
      ja: `「${featureName}」に関する共通ユーティリティ・フォーマット・ヘルパー関数群`,
      en: `Helper utilities and formatting functions for ${featureName}`
    };
  }

  if (norm.includes('/types/')) {
    const featureName = base.replace(/-/g, ' ');
    return {
      ja: `「${featureName}」に関するTypeScript型定義・データスキーマ`,
      en: `TypeScript type definitions and data schema for ${featureName}`
    };
  }

  // Fallback to layer category role
  return meta.role;
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
      document.getElementById('card-doc').innerText = (typeof node.doc === 'object' ? node.doc[currentLang] : node.doc) || (typeof node.role === 'object' ? node.role[currentLang] : node.role);

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
      document.getElementById('tour-curr-doc').innerText = (typeof step.doc === 'object' ? step.doc[currentLang] : step.doc) || (typeof step.role === 'object' ? step.role[currentLang] : step.role);
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
  // 1. Process English document (docs/*.md)
  const fullEnPath = path.join(projectRoot, item.file);
  if (fs.existsSync(fullEnPath)) {
    const enContent = fs.readFileSync(fullEnPath, 'utf8');
    const enCallout = `::: tip Interactive Architecture Tour
Explore the live data-flow blueprint and guided walkthrough for this feature:
- **Online (GitHub Browser Preview)**: [Open Interactive Tour (${item.titleEn})](https://htmlpreview.github.io/?https://github.com/ScriptureHabit/scripture-habit/blob/main/docs/public/architecture-tour.html?tour=${item.tourId}&lang=en)
- **VitePress / Local**: [Open ${item.titleEn} Tour](/architecture-tour.html?tour=${item.tourId}&lang=en)
:::`;

    let updatedEn;
    if (enContent.includes('::: tip Interactive Architecture Tour') || enContent.includes('::: tip 🚀 Interactive Architecture Tour')) {
      updatedEn = enContent.replace(/::: tip (?:🚀 )?Interactive Architecture Tour[\s\S]*?:::/, enCallout);
    } else {
      const h1Match = enContent.match(/^#\s+.+$/m);
      if (h1Match) {
        updatedEn = enContent.replace(h1Match[0], `${h1Match[0]}\n\n${enCallout}`);
      } else {
        updatedEn = `${enCallout}\n\n${enContent}`;
      }
    }
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
    const jaCallout = `::: tip インタラクティブ・アーキテクチャツアー
この機能のデータフローとステップ解説ツアーを体験できます：
- **オンライン（GitHubブラウザプレビュー）**: [インタラクティブツアーを開く (${item.titleJa})](https://htmlpreview.github.io/?https://github.com/ScriptureHabit/scripture-habit/blob/main/docs/public/architecture-tour.html?tour=${item.tourId}&lang=ja)
- **VitePress / ローカル**: [${item.titleJa} の解説ツアーを開く](/architecture-tour.html?tour=${item.tourId}&lang=ja)
:::`;

    let updatedJa;
    if (jaContent.includes('::: tip インタラクティブ・アーキテクチャツアー') || jaContent.includes('::: tip 🚀 Interactive Architecture Tour')) {
      updatedJa = jaContent.replace(/::: tip (?:🚀 )?(?:Interactive Architecture Tour|インタラクティブ・アーキテクチャツアー)[\s\S]*?:::/, jaCallout);
    } else {
      const h1Match = jaContent.match(/^#\s+.+$/m);
      if (h1Match) {
        updatedJa = jaContent.replace(h1Match[0], `${h1Match[0]}\n\n${jaCallout}`);
      } else {
        updatedJa = `${jaCallout}\n\n${jaContent}`;
      }
    }
    if (updatedJa !== jaContent) {
      fs.writeFileSync(fullJaPath, updatedJa, 'utf8');
      injectedCount++;
    }
  }
});

console.log(`🔗 Updated language-appropriate callouts across ${injectedCount} documentation files.`);
