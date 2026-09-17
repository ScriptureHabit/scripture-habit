# 全体アーキテクチャ ＆ 構成リファレンス

> [!TIP]
> **インタラクティブ・アーキテクチャツアー**: [ブラウザでツアーを開く (アプリ起動 & 全体配線)](https://htmlpreview.github.io/?https://github.com/ScriptureHabit/scripture-habit/blob/main/docs/public/architecture-tour.html?tour=tour-root&lang=ja)

このドキュメントでは、Scripture Habit を支える技術基盤、ディレクトリの構造、データの流れ、および状態管理の設計方針について解説いたします。

---

## 1. 技術スタック

現代のWeb標準に根ざし、高速な応答性と心地よい開発体験を両立する技術を選定しております。

| レイヤー | 採用技術 | 役割と選定の理由 |
| :--- | :--- | :--- |
| **フロントエンド** | **React 19** + **Vite 8** | 高速なビルドとコンポーネント設計 |
| **画面遷移・ルーティング** | **React Router 7** | SPA における画面遷移とディープリンクの管理 |
| **状態管理・データ取得** | **Zustand 5** / **TanStack Query 5** | 軽量なUI状態管理と、効率的なAPIキャッシュの制御 |
| **リアルタイム通信** | **Firebase Client SDK 12** | Firestore の WebSocket リスナーによる即時の対話同期 |
| **バックエンド API** | **Node.js >= 22 (LTS 24)** + **Express 5** | Vercel Serverless 上で動作する堅牢なAPIゲートウェイ |
| **データベース** | **Cloud Firestore** | 柔軟で即時性に優れたリアルタイム NoSQL データベース |
| **認証基盤** | **Firebase Authentication** | サインイン（Google / メール）と JWT 検証 |
| **AI サービス** | **Gemini 3.1 Flash-Lite** | 多言語の自然な自動翻訳、問いかけの生成、振り返りレターの執筆 |

---

## 2. ディレクトリ構成と役割

役割の境界を明確にし、どこに何があるのかが直感的に見通せる構造を保っています。

```
scripture-habit/
├── api/                  # Vercel サーバーレス関数のエントリーポイント
├── api_internal/         # バックエンドのコアロジック（ルート・サービス・通知・Cron）
├── backend/              # ローカル開発用の Express サーバーラッパー (Port: 5000)
├── src/                  # フロントエンド（React 19 + Vite アプリケーション）
└── types/                # フロント／バックエンド共通の TypeScript 型定義・スキーマ
```

---

## 3. 全体システム構成図 (System Component Map)

Markdownプレビューアでの視認性と理解しやすさを高めるため、システム全体の構造を以下の3つの視点に分割し、縦横比を最適化して整理しています：
1. **ハイレベル全体俯瞰図**: フロントエンド、バックエンド、クラウド基盤の全体連携
2. **フロントエンド & 機能ワークフロー詳細**: クライアント構成、状態管理、学習・チャットフロー
3. **バックエンド API & インフラ詳細**: サーバーレスAPI、認証ガード、ドメインサービス、外部サービス連携

### 3.1 ハイレベル全体俯瞰図

React PWA クライアントから、信頼されたバックエンド API、およびリアルタイム Firestore へのデータフローと連携を示す全体概要です。

```mermaid
flowchart TD
    subgraph Client["📱 1. フロントエンド (React 19 / PWA)"]
        UI["アプリシェル & Contexts [app.tsx]"]
        Workflows["学習ワークフロー & グループチャット"]
        UI --> Workflows
    end

    subgraph Backend["☁️ 2. 信頼されたバックエンド (Express 5 / Vercel)"]
        Gateway["API ゲートウェイ & 認証ガード [api.ts]"]
        Services["ドメインサービス [note-service.ts]"]
        Gateway --> Services
    end

    subgraph Platform["🔥 3. クラウドプラットフォーム (Firebase / AI)"]
        DB[("Cloud Firestore (リアルタイム DB)")]
        AI["Gemini 3.1 & 定期メンテナンス"]
    end

    Workflows -->|"① 特権ミューテーション"| Gateway
    Workflows <==>|"② リアルタイム同期 onSnapshot"| DB
    Services -->|"③ トランザクション書き込み"| DB
    Services <-->|"AI 処理 & リテンションタスク"| AI

    classDef fe fill:#dbeafe,stroke:#2563eb,stroke-width:1.5px,color:#172554
    classDef be fill:#ffe4e6,stroke:#e11d48,stroke-width:1.5px,color:#881337
    classDef pl fill:#e0e7ff,stroke:#4f46e5,stroke-width:1.5px,color:#312e81
    class Client,UI,Workflows fe
    class Backend,Gateway,Services be
    class Platform,DB,AI pl
```

---

### 3.2 フロントエンド & 機能ワークフロー詳細

クライアントの起動、グローバル状態、学習ワークフロー、およびオフラインチャットキューの連携詳細です。

```mermaid
flowchart TD
    subgraph Core["📱 1. React クライアント基盤"]
        Bootstrap["クライアント起動 [main.tsx]"] --> AppShell["アプリシェル & ルーター [app.tsx]"]
        AppShell --> Contexts["認証・ロケール管理 [auth-provider.tsx]"]
        AppShell --> Stores["UI 状態 (Zustand) & PWA [sw.ts]"]
        Contexts --> SDK["Firebase Client SDK [firebase.ts]"]
    end

    subgraph Features["⚡ 2. 学習 & コミュニティワークフロー"]
        direction LR
        subgraph Study["学習 & 振り返り"]
            NoteWork["ノート投稿処理 [use-note-submission.ts]"]
            DashSync["ダッシュボード同期 [use-dashboard-sync.ts]"]
            MyNotes["ノート一覧・検索 [my-notes.tsx]"]
            LetterBox["レターボックス [use-letter-box.ts]"]
            MyNotes --> LetterBox
        end
        subgraph Chat["グループ & チャット"]
            ChatProvider["チャット Provider [group-chat-provider.tsx]"]
            ChatSync["ストリーム同期 [use-chat-sync-controller.ts]"]
            OfflineQueue["オフラインキュー [offline-chat-queue.ts]"]
            ChatProvider --> ChatSync
            ChatProvider -.-> OfflineQueue
        end
    end

    subgraph External["🔥 3. 外部連携ターゲット"]
        Firestore[("Cloud Firestore (リアルタイム DB)")]
        API["信頼されたバックエンド API [api.ts]"]
    end

    AppShell ==> Features
    NoteWork & ChatProvider -->|"API ミューテーション"| API
    OfflineQueue -.->|"未送信メッセージ再試行"| API
    NoteWork & DashSync & ChatSync <==>|"リアルタイム同期"| Firestore

    click Bootstrap "https://github.com/scripturehabit/scripture-habit/blob/main/src/main.tsx"
    click AppShell "https://github.com/scripturehabit/scripture-habit/blob/main/src/app.tsx"
    click Contexts "https://github.com/scripturehabit/scripture-habit/blob/main/src/context/auth-provider.tsx"
    click Stores "https://github.com/scripturehabit/scripture-habit/blob/main/src/sw.ts"
    click SDK "https://github.com/scripturehabit/scripture-habit/blob/main/src/firebase.ts"
    click NoteWork "https://github.com/scripturehabit/scripture-habit/blob/main/src/components/newnote/hooks/use-note-submission.ts"
    click DashSync "https://github.com/scripturehabit/scripture-habit/blob/main/src/components/dashboard/hooks/use-dashboard-sync.ts"
    click MyNotes "https://github.com/scripturehabit/scripture-habit/blob/main/src/components/mynotes/my-notes.tsx"
    click LetterBox "https://github.com/scripturehabit/scripture-habit/blob/main/src/components/letterbox/hooks/use-letter-box.ts"
    click ChatProvider "https://github.com/scripturehabit/scripture-habit/blob/main/src/components/groupchat/group-chat-provider.tsx"
    click ChatSync "https://github.com/scripturehabit/scripture-habit/blob/main/src/components/groupchat/hooks/core/use-chat-sync-controller.ts"
    click OfflineQueue "https://github.com/scripturehabit/scripture-habit/blob/main/src/utils/offline-chat-queue.ts"
    click API "https://github.com/scripturehabit/scripture-habit/blob/main/api/api.ts"

    classDef toneBlue fill:#dbeafe,stroke:#2563eb,stroke-width:1.5px,color:#172554
    classDef toneAmber fill:#fef3c7,stroke:#d97706,stroke-width:1.5px,color:#78350f
    classDef toneMint fill:#dcfce7,stroke:#16a34a,stroke-width:1.5px,color:#14532d
    classDef toneNeutral fill:#f1f5f9,stroke:#64748b,stroke-width:1.5px,color:#0f172a
    class Core,Bootstrap,AppShell,Contexts,Stores,SDK toneBlue
    class Study,NoteWork,DashSync,MyNotes,LetterBox toneAmber
    class Chat,ChatProvider,ChatSync,OfflineQueue toneMint
    class External,Firestore,API toneNeutral
```

---

### 3.3 バックエンド API & インフラ詳細

トリガーから Express パイプライン、ドメインサービス、Firestore トランザクション、および Gemini AI へと上から下へ流れる実行経路です。

```mermaid
flowchart TD
    subgraph group_triggers["1. エントリーポイント & トリガー"]
        direction LR
        node_serverless_entry["サーバーレス API エントリー<br/>Vercel Functions [api.ts]"]
        node_scheduled_ops["定期メンテナンスタスク<br/>Cron バッチ実行 [cron.ts]"]
    end

    subgraph group_api["2. 信頼されたバックエンド (Express 5)"]
        node_backend_app["Express アプリケーション [index.ts]"]
        node_api_middleware["認証 & 信頼ミドルウェア [middleware.ts]"]
        node_domain_routes["ドメイン別ルート (Groups, Notes, AI) [groups.ts]"]
        node_backend_services["ドメインサービス (習慣化 & 継続支援) [note-service.ts]"]

        node_backend_app --> node_api_middleware --> node_domain_routes --> node_backend_services
    end

    subgraph group_platform["3. プラットフォーム & 外部基盤"]
        direction LR
        node_firebase_security["Firebase セキュリティ & Admin SDK [firebase-admin.ts]"]
        node_firestore[("Firestore データベース<br/>リアルタイム NoSQL DB")]
        node_ai_integrations["Gemini 3.1 Flash-Lite<br/>AI サービス [ai.ts]"]

        node_firebase_security -->|"アクセス制御保護"| node_firestore
    end

    node_serverless_entry --> node_backend_app
    node_scheduled_ops -->|"定期バッチ実行"| node_backend_services

    node_backend_services -->|"Admin SDK ミューテーション"| node_firestore
    node_domain_routes -->|"振り返り・問い生成"| node_ai_integrations

    click node_serverless_entry "https://github.com/scripturehabit/scripture-habit/blob/main/api/api.ts"
    click node_scheduled_ops "https://github.com/scripturehabit/scripture-habit/blob/main/api_internal/routes/cron.ts"
    click node_backend_app "https://github.com/scripturehabit/scripture-habit/blob/main/backend/index.ts"
    click node_api_middleware "https://github.com/scripturehabit/scripture-habit/blob/main/api_internal/lib/middleware.ts"
    click node_domain_routes "https://github.com/scripturehabit/scripture-habit/blob/main/api_internal/routes/groups.ts"
    click node_backend_services "https://github.com/scripturehabit/scripture-habit/blob/main/api_internal/services/note-service.ts"
    click node_firebase_security "https://github.com/scripturehabit/scripture-habit/blob/main/api_internal/lib/firebase-admin.ts"
    click node_ai_integrations "https://github.com/scripturehabit/scripture-habit/blob/main/api_internal/routes/ai.ts"

    classDef toneRose fill:#ffe4e6,stroke:#e11d48,stroke-width:1.5px,color:#881337
    classDef toneIndigo fill:#e0e7ff,stroke:#4f46e5,stroke-width:1.5px,color:#312e81
    class group_triggers,node_serverless_entry,node_scheduled_ops,group_api,node_backend_app,node_api_middleware,node_domain_routes,node_backend_services toneRose
    class group_platform,node_firebase_security,node_firestore,node_ai_integrations toneIndigo
```

---

## 4. レイヤー設計と状態管理の分類

### ① 画面の表現とロジックの分離 (Logic-Component Split)
- **UIコンポーネント (`src/components/`)**: 画面の描画、スタイリング（Vanilla CSS）、およびレイアウトの構築に専念します。
- **カスタムフック (`src/hooks/`)**: サーバー通信、データの同期、およびビジネスロジックの処理を担います。

### ② 状態管理の役割分担
- **リアルタイムデータ（チャット・未読・ストリーク）**: Firestore の `onSnapshot` により、常に最新の状態を即時受信します。
- **サーバーAPI状態（システム設定・静的情報）**: TanStack Query により、適切なキャッシュと再取得を管理します。
- **グローバルUI状態（モーダル・テーマ）**: Zustand により、画面全体で共有する状態を軽量に保持します。
- **認証状態**: `AuthContext` を通じて、利用者のログイン状態を一元管理します。

---

## 5. データフロー：書き込みとリアルタイム同期の分離

Scripture Habit では、データの書き込みとリアルタイム同期の経路を分離した設計を採用しています。

```mermaid
flowchart TD
    classDef fe fill:#1e293b,stroke:#38bdf8,stroke-width:1.5px,color:#f8fafc;
    classDef be fill:#1e1b4b,stroke:#a855f7,stroke-width:1.5px,color:#f8fafc;
    classDef fb fill:#0f172a,stroke:#f59e0b,stroke-width:1.5px,color:#f8fafc;

    subgraph Frontend["1. 📱 フロントエンド (React / PWA)"]
        Component["UIコンポーネント"]:::fe --> Hook["カスタムフック (状態管理 & リアルタイム購読)"]:::fe
    end

    subgraph Backend["2. ☁️ バックエンド API (Express / Vercel)"]
        API["Express コントローラー (入力検証 & 認可)"]:::be --> Service["ビジネスロジック (Domain Services)"]:::be
    end

    subgraph Firebase["3. 🔥 Firebase クラウドインフラ"]
        Auth["Firebase Auth (JWT認証)"]:::fb
        DB[("Cloud Firestore (DB)")]:::fb
    end

    Hook -- "① API ミューテーション (投稿・更新)" --> API
    Auth -. "JWT トークン検証" .-> API
    Service -- "② トランザクション書き込み" --> DB
    DB ==>|③ リアルタイム同期 onSnapshot| Hook

    Frontend ~~~ Backend
    Backend ~~~ Firebase
```

### データフローの仕組み

1. **書き込み処理（ミューテーション）**
   利用者がノートの保存やメッセージ送信を行うと、フロントエンドのカスタムフックからバックエンド API へリクエストが送られます。  
   サーバー側で JWT による認証と Zod による入力値の検証を行った後、学習日数の加算、チャットへの同期、レベルの更新を **Firestore のトランザクション** で一括してデータベースに書き込みます。

2. **リアルタイム同期（購読処理）**
   データベースが更新されると、Firestore の `onSnapshot` リスナーを通じて、画面の再読み込みを行うことなく変更がクライアントへ即座に反映されます。  
   自身の操作はもちろん、同じグループに所属する他のメンバーのノート投稿や団結度（Unity）の更新もリアルタイムに受信します。

3. **書き込みと読み取りの分離**
   「更新処理はバックエンド API を経由してトランザクションで完結させ、データの反映はリアルタイムリスナーで同期する」という役割分担により、クライアント間でのデータの不整合を防ぎ、高い整合性を保ちます。

---

## 6. 関連ドキュメント

- [ネットワークと通信の最適化](./network-performance-optimization.md)
- [データベースとセキュリティ](./database-security.md)
- [API 設計とエラー処理](./api-middleware-error-handling.md)
- [開発 & 環境構築ガイド](./development-guide.md)
