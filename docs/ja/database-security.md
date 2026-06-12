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
    
    GROUPS ||--o{ MESSAGES : "アクティブなチャット"
    GROUPS ||--o{ MESSAGE_BUCKETS : "アーカイブされた履歴"
    GROUPS ||--o{ MEMBERS_STATS : "個人の進捗"
    
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
graph TD
    Root[Firestore ルート]
    
    %% Users Root Collection
    Root --> Users[users / コレクション]
    Users --> UserDoc["{uid} / ドキュメント"]
    UserDoc --> UserPrivate[private / サブコレクション]
    UserPrivate --> TokenDoc["tokens / ドキュメント (FCMトークンなど)"]
    UserDoc --> UserNotes[notes / サブコレクション]
    UserNotes --> NoteDoc["{noteId} / ドキュメント (勉強ノートのコピー)"]
    UserDoc --> GroupStates[groupStates / サブコレクション]
    GroupStates --> GStateDoc["{groupId} / ドキュメント (既読マーカー)"]
    UserDoc --> Letters[letters / サブコレクション]
    Letters --> LetterDoc["{letterId} / ドキュメント (励まし)"]
    
    %% Groups Root Collection
    Root --> Groups[groups / コレクション]
    Groups --> GroupDoc["{groupId} / ドキュメント"]
    GroupDoc --> Messages[messages / サブコレクション]
    Messages --> MsgDoc["{messageId} / ドキュメント (アクティブチャット)"]
    GroupDoc --> MessageBuckets[message_buckets / サブコレクション]
    MessageBuckets --> BucketDoc["{bucketId} / ドキュメント (アーカイブ履歴)"]
    GroupDoc --> Members[members / サブコレクション]
    Members --> MemberDoc["{userId} / ドキュメント (進捗・統計)"]
    
    %% Cheers and Reports Root Collections
    Root --> Cheers[cheers / コレクション]
    Cheers --> CheerDoc["{cheerId} / ドキュメント (ソーシャルチア)"]
    Root --> Reports[reports / コレクション]
    Reports --> ReportDoc["{reportId} / Document (通報)"]
    
    classDef col fill:#e1f5fe,stroke:#01579b,stroke-width:2px;
    classDef doc fill:#fff9c4,stroke:#fbc02d,stroke-width:2px;
    class Users,Groups,Cheers,Reports,UserPrivate,UserNotes,GroupStates,Letters,Messages,MessageBuckets,Members col;
    class UserDoc,TokenDoc,NoteDoc,GStateDoc,LetterDoc,GroupDoc,MsgDoc,BucketDoc,MemberDoc,CheerDoc,ReportDoc doc;
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

## 📦 チャットのアーカイブ (バケットパターン)

Firestore のドキュメントサイズ制限（ドキュメントあたり 1MB）を回避し、クライアントのリアルタイム同期を軽量に保つため、アプリケーションはチャット履歴に対して **バケットパターン (Bucket Pattern)** を採用しています。

```
       [ クライアントチャットリスナー ] ─── 購読 (Subscribed) ───► [ groups/{id}/messages ] (アクティブ領域)
                                                                        │
                                                            (自動クローンスイープ)
                                                                        ▼
                                                       [ groups/{id}/message_buckets/{bucketId} ]
                                                                (アーカイブ・コールドストレージ)
```

### メカニズム:
* **アクティブコレクション**: アクティブなメッセージは `/messages` に保存され、サイズを小さく保ちます。
* **アーカイブのクローン**: 毎日実行されるクローンジョブ（`ArchiveService`）により、30日以上前の古いメッセージをバケット化されたサブコレクション `/message_buckets/{bucketId}` に移動します。
* **帯域幅の節約**: アクティブなチャットリスナーは軽量なままであり、クライアント同期が過剰なモバイルデータ通信やメモリを消費しないよう保証します。

---

## 🔐 プライベートデータの隔離

機密性の高いユーザーの認証情報や設定トークンは、一般的なクエリから切り離して保存されます：
`users/{uid}/private/tokens`

* **アクセスルール**: このサブコレクションへのアクセスはデータベースレベルで制限されています。グループのメンバーもグループのオーナーも、これらのドキュメントを表示することはできません。Admin SDK と該当するユーザー本人だけが、トークンを読み書きできます。
