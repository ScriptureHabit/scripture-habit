# ダッシュボード ＆ マイノートの設計と実装

このドキュメントでは、ダッシュボード（`src/components/dashboard`）、マイノート一覧（`src/components/mynotes`）、およびノートカード（`src/components/notecard`）の構成と機能について解説します。

---

## 1. 全体アーキテクチャの概要

ダッシュボードは、学習記録の確認、所属グループの切り替え、マイノートの検索・閲覧などを一括して行うホーム画面です。

```
                               ┌─────────────────────────┐
                               │       Dashboard         │
                               │   (メインコンテナ)       │
                               └────────────┬────────────┘
                                            │
        ┌──────────────────┬────────────────┼─────────────────┬──────────────────┐
        ▼                  ▼                ▼                 ▼                  ▼
useDashboardSync   useDashboardGroups useHabitPace/Warnings  DashboardLayout      MyNotes
(ユーザー同期)     (所属グループ同期)  (ペース設定/警告)   (概要・カレンダー) (検索・ノート一覧)
                                                                                  │
                                                                                  ▼
                                                                              NoteCard
                                                                        (カード表示・リンク)
```

### 主な機能
- **ユーザー情報の同期 (`useDashboardSync`)**: ログイン状態とユーザープロフィールのリアルタイム同期。
- **学習カレンダー (`StreakCalendar`)**: 当月の学習記録（投稿日）や次回のリマインダー目安を視覚的に表示。
- **習慣化ペース設定 (`useDashboardHabitPace`)**: 初回利用時に無理のない学習ペース（自動退出までの日数）を設定。
- **オンボーディングクエスト (`QuestCard`)**: 新規ユーザー向けに「グループ参加」「最初のノート投稿」の達成を案内。
- **マイノートの検索と分類 (`useMyNotes`)**: 聖典カテゴリ別の絞り込みや検索キーワードによる一覧表示。
- **週次 AI 振り返りレター (`useRecap`)**: 1週間の学びをもとに Gemini AI がパーソナライズされた振り返りレターを生成。
- **聖句ディープリンク (`NoteCard`)**: 公式の福音ライブラリ（アプリ / Web）へ直接アクセス。

---

## 2. ディレクトリ構造

```
src/components/
├── dashboard/
│   ├── dashboard.tsx                   # ダッシュボードのエントリーポイント
│   ├── dashboard.css                   # レイアウト・スタイリング
│   ├── components/
│   │   ├── dashboard-layout.tsx        # 画面ビュー切り替え
│   │   ├── dashboard-overview.tsx      # ストリーク・クエスト表示
│   │   ├── streak-calendar.tsx         # 学習実績カレンダー
│   │   └── quest-card.tsx              # オンボーディングクエストカード
│   └── hooks/
│       ├── use-dashboard-sync.ts       # 認証・ユーザーデータ同期
│       ├── use-dashboard-groups.ts     # 所属グループ管理
│       └── use-dashboard-habit-pace.ts # ペース設定管理
├── mynotes/
│   ├── my-notes.tsx                    # マイノート一覧画面
│   ├── note-detail-modal.tsx           # ノート詳細モーダル
│   └── hooks/
│       ├── use-my-notes.ts             # ノート取得・検索フック
│       └── use-recap.ts                # 週次AI振り返り生成フック
└── notecard/
    └── note-card.tsx                   # 個別ノートカード
```

---

## 3. 主要コンポーネントの実装概要

### ① 学習カレンダー (`StreakCalendar`)
当月の日付グリッドを生成し、ノートを投稿した日（`isStudied`）を色分けして視覚的に達成感を高めます。

### ② オンボーディングクエスト (`QuestCard`)
初心者が迷わないよう、最初のステップ（グループ参加・ノート投稿）をガイドします。両方達成すると紙吹雪でお祝いし、完了状態を保存します。

### ③ マイノート検索 (`useMyNotes`)
Firestore の `users/{uid}/notes` サブコレクションを検索します。聖典カテゴリでのフィルタリングや、キーワードによる `array-contains-any` 検索に対応しています。

---

## 4. 関連ドキュメント

- [AI振り返りレターの心理学的効用とリテンション](./ux-ai-reflection-letters.md)
- [ノート作成（NewNote）設計・実装ガイド](./newnote-construction-guide.md)
- [マイルストーン達成 & リテンション心理学](./logic-milestone-retention.md)
