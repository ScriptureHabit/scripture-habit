# データベースとスキーマの設計

このドキュメントでは、**scripture-habit** の安定したバックエンドを維持するために使用されているデータアーキテクチャ、エンティティ関係（ER）モデル、スキーマ計画、およびデータベースパターンについて定義します。

---

## 📂 エンティティ関係 (ER) モデル

当プロジェクトのデータモデルは、リアルタイム同期の必要性と長期的なデータ保存のバランスを取るために、階層構造を採用しています。

```mermaid
erDiagram
    USERS ||--o{ NOTES : "個人用コピー"
    USERS ||--o{ GROUP_STATES : "既読マーカー"
    USERS ||--o{ PRIVATE_TOKENS : "機密FCMトークン"
    USERS ||--o{ LETTERS : "励ましのお手紙"
    
    GROUPS ||--o{ MESSAGES : "active chat"
    GROUPS ||--o{ MEMBERS_STATS : "individual progress"
    
    USERS }|--o{ GROUPS : "多対多（メンバーシップ）"
    
    USERS ||--o{ CHEERS : "ソーシャルチア（応援）"
    USERS ||--o{ REPORTS : "通報"
    
    USERS {
        string uid PK
        string nickname
        int streakCount
        int totalNotes
    }
    
    GROUPS {
        string groupId PK
        string ownerUserId FK
        string[] members
        int membersCount
        timestamp lastMessageAt
        boolean isPublic
    }
    
    MESSAGES {
        string id PK
        string text
        string senderId FK
        timestamp createdAt
        boolean isNote
        timestamp expireAt
    }
    
    LETTERS {
        string letterId PK
        string text
        timestamp createdAt
        string type
    }
    
    CHEERS {
        string cheerId PK
        string senderUid FK
        string targetUid FK
        timestamp createdAt
    }
    
    REPORTS {
        string reportId PK
        string reporterId FK
        string targetId
        string reason
        timestamp createdAt
    }
```

---

## 🌳 Firestore の階層パス構造

これらのコレクションとドキュメントが、Firestore の階層的なパスレイアウト（コレクション ➔ ドキュメント ➔ サブコレクション ➔ ドキュメント）内で物理的にどのように構成されているかをビジュアル化します。

```mermaid
%%{init: {'theme': 'neutral'}}%%
graph TD
    classDef root fill:#334155,stroke:#0f172a,color:#ffffff,font-weight:bold,font-size:14px;
    classDef collection fill:#e0f2fe,stroke:#0284c7,color:#0369a1,font-weight:bold,font-size:13px;
    classDef document fill:#fef3c7,stroke:#d97706,color:#92400e,font-weight:bold,font-size:13px;

    Root["Firestore ルート"]:::root

    Root --> Users["users / コレクション"]:::collection
    Root --> Groups["groups / コレクション"]:::collection
    Root --> Cheers["cheers / コレクション"]:::collection
    Root --> Reports["reports / コレクション"]:::collection

    Users --> UserDoc["{uid} / ドキュメント"]:::document
    Groups --> GroupDoc["{groupId} / ドキュメント"]:::document
    Cheers --> CheerDoc["{cheerId} / ドキュメント (ソーシャルチア)"]:::document
    Reports --> ReportDoc["{reportId} / ドキュメント (通報)"]:::document

    UserDoc --> Private["private / サブコレクション"]:::collection
    UserDoc --> Notes["notes / サブコレクション"]:::collection
    UserDoc --> GroupStates["groupStates / サブコレクション"]:::collection
    UserDoc --> Letters["letters / サブコレクション"]:::collection

    Private --> TokensDoc["tokens / ドキュメント (FCMトークンなど)"]:::document
    Notes --> NoteDoc["{noteId} / ドキュメント (勉強ノートのコピー)"]:::document
    GroupStates --> GStateDoc["{groupId} / ドキュメント (既読マーカー)"]:::document
    Letters --> LetterDoc["{letterId} / ドキュメント (励まし)"]:::document

    GroupDoc --> Messages["messages / サブコレクション"]:::collection
    GroupDoc --> Members["members / サブコレクション"]:::collection

    Messages --> MsgDoc["{messageId} / ドキュメント (アクティブチャット / TTL 30日)"]:::document
    Members --> MemberDoc["{userId} / ドキュメント (進捗・統計)"]:::document
```

---

## 🗺️ スキーマ計画と非正規化 (Denormalization)

### 1. `groups`
* **非正規化戦略**: `memberPreviews`（ニックネーム / 写真）と `lastMessageAt` をルートのグループドキュメントに直接保存します。これにより、クライアントのダッシュボードは二次的なドキュメントリクエストを行うことなく、アクティブなグループを即座に表示できます。
* **アクティビティ追跡**: メッセージコレクション全体をクエリすることなくグループのアクティビティを計算するために、`dailyActivity` にアクティブユーザー ID のリストを保存します。

### 2. `users`（プロファイル同期）
* **Shared ID**: 同期の問題を防ぐため、ドキュメント ID は Firebase Auth の UID と一致させます。
* **冗長性**: ユーザーのアクティブなグループを表示する際の検索を高速化するため、`groupIds`（配列）をユーザーオブジェクトに保存します。

### 3. サブコレクション（データの隔離）
* **`/messages`**: 軽量でリアルタイムなメッセージ更新のために最適化されています。
* **`/members`**: メインのグループドキュメントには大きすぎる、グループごとのメンバー統計情報（スタディポイント、個人の進捗）を保存します。

---

> [!IMPORTANT]
> ### 🛡️ セキュリティルールと書き込み権限
> 検証ルール（`isAuthenticated()`、`isAppCheckVerified()`）、メンバーシップのルックアップ、およびバックエンド専用の書き込み検証ポリシーの詳細については、**[Firebaseセキュリティルールと書き込み分離](firebase-security-rules.md)** を参照してください。
> すべてのクライアント更新およびトランザクションルーチンは、**[Firestoreトランザクションとカウンターサービスの設計](firestore-transactions-counters.md)** に記載されています。

---

## 📦 チャットの自動クリーンアップ (Firestore TTL)

Firestore のドキュメントサイズ制限（ドキュメントあたり 1MB）を回避し、クライアントのリアルタイム同期を軽量に保つため、アプリケーションはチャット履歴に対して Firestore のネイティブ機能である **Time-to-Live (TTL)** 自動削除を採用しています。

```
       [ クライアントチャットリスナー ] ─── 購読 (Subscribed) ───► [ groups/{id}/messages ] (アクティブ領域)
                                                                        │
                                                             (Firestore ネイティブ TTL)
                                                                        ▼
                                                                30日後に自動削除
                                                              (expireAt フィールド)
```

### メカニズム:
* **アクティブコレクション**: メッセージは `/messages` に保存され、作成から30日後に失効する `expireAt` タイムスタンプが自動的に付与されます。
* **Firestore TTL サービス**: Google Cloud Firestore がバックグラウンドで期限切れのメッセージドキュメントを自動的にスキャンし、削除します。
* **帯域幅とストレージの節約**: 手動のアーカイブ処理（ArchiveService）やクローンジョブを必要とせず、アクティブなチャットリスナーが常に軽量に保たれ、クライアント同期によるモバイルデータ通信やメモリ消費が抑制されます。

---

## 🔐 プライベートデータの隔離

機密性の高いユーザーの認証情報や設定トークンは、一般的なクエリから切り離して保存されます：
`users/{uid}/private/tokens`

* **アクセスルール**: このサブコレクションへのアクセスはデータベースレベルで制限されています。グループのメンバーもグループのオーナーも、これらのドキュメントを表示することはできません。Admin SDK と該当するユーザー本人だけが、トークンを読み書きできます。
