import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

export default withMermaid(defineConfig({
  title: 'Scripture Habit',
  description: 'Technical Documentation & Architecture Guides',
  base: '/scripture-habit/',
  lastUpdated: true,
  cleanUrls: true,
  ignoreDeadLinks: [
    /^http:\/\/localhost/,
    /^http:\/\/127\.0\.0\.1/,
    /\/CONTRIBUTING/
  ],

  vite: {
    build: {
      target: 'esnext'
    },
    optimizeDeps: {
      include: ['mermaid', 'fastdom']
    }
  },

  locales: {
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: [
          { text: 'Home', link: '/' },
          { text: 'Architecture', link: '/architecture' },
          { text: 'Features', link: '/feature-chat-dashboard' },
          { text: 'Core Logic', link: '/logic-note-posting' },
          {
            text: 'API & References',
            items: [
              { text: '⚡ REST API (Scalar Playground)', link: '/api-reference' },
              { text: '📘 TypeScript Types & SDK', link: '/reference/' }
            ]
          },
          { text: 'Operations', link: '/development-guide' },
          { text: 'App', link: 'https://scripturehabit.app' }
        ],
        sidebar: [
          {
            text: 'Architecture Overview',
            items: [
              { text: 'Architecture & Structure', link: '/architecture' },
              { text: 'Network & Performance Optimization', link: '/network-performance-optimization' },
              { text: 'Database & Security', link: '/database-security' },
              { text: 'App Check & Security Gateway', link: '/security-architecture' },
              { text: 'API Middleware & Error Handling', link: '/api-middleware-error-handling' },
              { text: 'Firebase Security Rules & CQRS', link: '/firebase-security-rules' },
              { text: 'AI Context & Charter', link: '/ai-context' },
              { text: 'SEO & Dynamic Meta', link: '/seo-and-meta-management' },
              { text: 'Design System', link: '/design-system' }
            ]
          },
          {
            text: 'Key Features',
            items: [
              { text: 'Chat & Dashboard Synchronization', link: '/feature-chat-dashboard' },
              { text: 'Group Chat Construction Guide', link: '/groupchat-construction-guide' },
              { text: 'Note Creation (NewNote) Guide', link: '/newnote-construction-guide' },
              { text: 'Dashboard & MyNotes Guide', link: '/dashboard-mynotes-construction-guide' },
              { text: 'AI Integration (Gemini)', link: '/feature-ai-integration' },
              { text: 'Push Notifications & Background FCM', link: '/feature-notifications' }
            ]
          },
          {
            text: 'UX & Habit Building',
            items: [
              { text: 'Milestone Celebrations & Retention Psychology', link: '/logic-milestone-retention' },
              { text: 'Psychological Impact & Retention of AI Reflection Letters', link: '/ux-ai-reflection-letters' },
              { text: 'Small Group Dynamics (Max 5) & Peer Accountability', link: '/ux-small-groups-and-peer-accountability' }
            ]
          },
          {
            text: 'Core Logic',
            items: [
              { text: 'Note Posting Mechanism & Streaks', link: '/logic-note-posting' },
              { text: 'Gospel Library Scripture Mapper', link: '/gospel-library-mapper' },
              { text: 'Group Invites & Joining Pipeline', link: '/group-invites' },
              { text: 'Inactivity & Auto-Kick Engine', link: '/inactivity-and-autokick' },
              { text: 'URL Metadata & Speaker Extraction', link: '/url-metadata-extraction' },
              { text: 'I18n & Localization', link: '/logic-i18n' },
              { text: 'Unity Participation & Sync', link: '/unity-participation' },
              { text: 'Firestore Transactions & Counters', link: '/firestore-transactions-counters' },
              { text: 'Incremental Book Suggestions', link: '/incremental-book-suggestions' },
              { text: 'Profile Sync & Reaction Anonymization', link: '/profile-sync-anonymization' },
              { text: 'Timezone-Aware Streak Reminders', link: '/timezone-streak-reminders' },
              { text: 'Firestore Offline Persistence', link: '/firestore-offline-persistence' }
            ]
          },
          {
            text: 'API & Type Reference',
            items: [
              { text: '⚡ REST API Playground (Scalar)', link: '/api-reference' },
              { text: '📘 TypeScript Reference Overview', link: '/reference/' },
              { text: 'Schemas & Models (Zod)', link: '/reference/src/types/schemas/' },
              { text: 'User Types', link: '/reference/src/types/user/' },
              { text: 'Chat & Group Types', link: '/reference/src/types/chat/' },
              { text: 'Firestore Schemas', link: '/reference/types/firestore/' },
              { text: 'Firestore Converters', link: '/reference/src/utils/firestore-converters/' },
              { text: 'Gospel Library Mapper', link: '/reference/src/utils/gospel-library-mapper/' },
              { text: 'Note Logic & Streaks', link: '/reference/src/utils/note-logic/' },
              { text: 'Unity & Sync Math', link: '/reference/src/utils/unity-utils/' },
              { text: 'API Client & Endpoints', link: '/reference/src/utils/api-client/' },
              { text: 'Notification Helpers', link: '/reference/src/utils/notification-helper/' },
              { text: 'Supported Languages', link: '/reference/src/config/languages/' }
            ]
          },
          {
            text: 'Development & Operations',
            items: [
              { text: 'Development & Setup Guide', link: '/development-guide' },
              { text: 'Testing & Reliability Guide', link: '/testing-guide' },
              { text: 'CI/CD & Maintenance Automation', link: '/cicd-maintenance-automation' },
              { text: 'Maintenance & Batch Jobs (Cron)', link: '/maintenance-cron' },
              { text: 'Monitoring & Observability', link: '/monitoring-observability' },
              { text: 'Troubleshooting & FAQ', link: '/troubleshooting' }
            ]
          }
        ]
      }
    },
    ja: {
      label: '日本語',
      lang: 'ja',
      link: '/ja/',
      themeConfig: {
        nav: [
          { text: 'ホーム', link: '/ja/' },
          { text: 'アーキテクチャ', link: '/ja/architecture' },
          { text: '機能詳細', link: '/ja/feature-chat-dashboard' },
          { text: 'コアロジック', link: '/ja/logic-note-posting' },
          {
            text: 'API & 型定義',
            items: [
              { text: '⚡ REST API (Scalar プレイグラウンド)', link: '/ja/api-reference' },
              { text: '📘 TypeScript 型 & SDK', link: '/reference/' }
            ]
          },
          { text: '開発・運用', link: '/ja/development-guide' },
          { text: 'アプリを開く', link: 'https://scripturehabit.app' }
        ],
        sidebar: [
          {
            text: '全体アーキテクチャ',
            items: [
              { text: 'アーキテクチャ & 構成', link: '/ja/architecture' },
              { text: 'ネットワーク & パフォーマンス最適化', link: '/ja/network-performance-optimization' },
              { text: 'データベース & セキュリティ', link: '/ja/database-security' },
              { text: 'App Check & API 保護', link: '/ja/security-architecture' },
              { text: 'API ミドルウェア & エラーハンドリング', link: '/ja/api-middleware-error-handling' },
              { text: 'Firebase セキュリティルール & CQRS', link: '/ja/firebase-security-rules' },
              { text: 'AI コンテキスト & 開発憲章', link: '/ja/ai-context' },
              { text: 'SEO & 動的メタデータ管理', link: '/ja/seo-and-meta-management' },
              { text: 'デザインシステム', link: '/ja/design-system' }
            ]
          },
          {
            text: '主要機能の仕組み',
            items: [
              { text: 'チャット & ダッシュボード同期', link: '/ja/feature-chat-dashboard' },
              { text: 'グループチャット設計・実装ガイド', link: '/ja/groupchat-construction-guide' },
              { text: 'ノート作成（NewNote）設計・実装ガイド', link: '/ja/newnote-construction-guide' },
              { text: 'ダッシュボード ＆ マイノート設計・実装ガイド', link: '/ja/dashboard-mynotes-construction-guide' },
              { text: 'AI 統合 (Gemini)', link: '/ja/feature-ai-integration' },
              { text: 'プッシュ通知 & バックグラウンド FCM', link: '/ja/feature-notifications' }
            ]
          },
          {
            text: '続けやすさのUXデザイン',
            items: [
              { text: 'マイルストーン達成 & リテンション心理学', link: '/ja/logic-milestone-retention' },
              { text: 'AI振り返りレターの心理学的効用とリテンション', link: '/ja/ux-ai-reflection-letters' },
              { text: '少人数グループ（最大5人）とピア・アカウンタビリティの心理学', link: '/ja/ux-small-groups-and-peer-accountability' }
            ]
          },
          {
            text: 'コアロジック',
            items: [
              { text: 'ノート投稿メカニズム & ストリーク', link: '/ja/logic-note-posting' },
              { text: '福音ライブラリ聖句マッパー', link: '/ja/gospel-library-mapper' },
              { text: 'グループ招待 & 参加パイプライン', link: '/ja/group-invites' },
              { text: '非アクティブ判定 & 自動キックエンジン', link: '/ja/inactivity-and-autokick' },
              { text: 'URL メタデータ & 話者自動抽出', link: '/ja/url-metadata-extraction' },
              { text: '多言語化（i18n）アーキテクチャ', link: '/ja/logic-i18n' },
              { text: 'Unity 参加率計算 & 同期機構', link: '/ja/unity-participation' },
              { text: 'Firestore トランザクション & カウンター設計', link: '/ja/firestore-transactions-counters' },
              { text: '聖典サジェスト（ひらがな/カタカナ変換）', link: '/ja/incremental-book-suggestions' },
              { text: 'プロフィール同期 & リアクション匿名化', link: '/ja/profile-sync-anonymization' },
              { text: 'タイムゾーン対応ストリークリマインダー', link: '/ja/timezone-streak-reminders' },
              { text: 'Firestore オフラインキャッシュ & 永続化', link: '/ja/firestore-offline-persistence' }
            ]
          },
          {
            text: 'API & 型リファレンス',
            items: [
              { text: '⚡ REST API プレイグラウンド (Scalar)', link: '/ja/api-reference' },
              { text: '📘 TypeScript 型リファレンス概要', link: '/reference/' },
              { text: 'スキーマ & モデル (Zod)', link: '/reference/src/types/schemas/' },
              { text: 'ユーザー型定義', link: '/reference/src/types/user/' },
              { text: 'チャット & グループ型定義', link: '/reference/src/types/chat/' },
              { text: 'Firestore スキーマ定義', link: '/reference/types/firestore/' },
              { text: 'Firestore コンバーター', link: '/reference/src/utils/firestore-converters/' },
              { text: '福音ライブラリマッパー', link: '/reference/src/utils/gospel-library-mapper/' },
              { text: 'ノート投稿 & ストリークロジック', link: '/reference/src/utils/note-logic/' },
              { text: 'Unity 参加率計算ユーティリティ', link: '/reference/src/utils/unity-utils/' },
              { text: 'API クライアント & エンドポイント', link: '/reference/src/utils/api-client/' },
              { text: '通知ヘルパー', link: '/reference/src/utils/notification-helper/' },
              { text: '言語設定定義', link: '/reference/src/config/languages/' }
            ]
          },
          {
            text: '開発・運用ガイド',
            items: [
              { text: '開発 & 環境構築ガイド', link: '/ja/development-guide' },
              { text: 'テスト & 品質保証ガイド', link: '/ja/testing-guide' },
              { text: 'CI/CD & 自動化パイプライン', link: '/ja/cicd-maintenance-automation' },
              { text: 'バッチ & メンテナンス処理 (Cron)', link: '/ja/maintenance-cron' },
              { text: '監視 & オブザーバビリティ (Sentry)', link: '/ja/monitoring-observability' },
              { text: 'トラブルシューティング & FAQ', link: '/ja/troubleshooting' }
            ]
          }
        ]
      }
    }
  },

  themeConfig: {
    siteTitle: 'Scripture Habit Docs',
    socialLinks: [
      { icon: 'github', link: 'https://github.com/ScriptureHabit/scripture-habit' }
    ],
    search: {
      provider: 'local',
      options: {
        locales: {
          ja: {
            translations: {
              button: {
                buttonText: '検索',
                buttonAriaLabel: '検索'
              },
              modal: {
                noResultsText: '見つかりませんでした',
                resetButtonTitle: 'リセット',
                footer: {
                  selectText: '選択',
                  navigateText: '移動',
                  closeText: '閉じる'
                }
              }
            }
          }
        }
      }
    },
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © Scripture Habit Contributors'
    }
  }
}));
