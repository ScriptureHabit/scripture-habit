# データベース ＆ セキュリティ設計

::: tip インタラクティブ・アーキテクチャツアー
この機能のデータフローとステップ解説ツアーを体験できます：
- **オンライン（GitHubブラウザプレビュー）**: [インタラクティブツアーを開く (ユーザー認証・ログイン)](https://htmlpreview.github.io/?https://github.com/ScriptureHabit/scripture-habit/blob/main/docs/public/architecture-tour.html?tour=tour-login&lang=ja)
- **VitePress / ローカル**: [ユーザー認証・ログイン の解説ツアーを開く](/architecture-tour.html?tour=tour-login&lang=ja)
:::

このドキュメントでは、Cloud Firestore のデータ構造（ER モデル）、コレクション階層、非正規化によるパフォーマンス最適化、および機密データの保護方針について解説します。

---

## 1. エンティティ関係 (ER) モデル

Cloud Firestore における主要エンティティとリレーションシップの全体構造です。

```mermaid
flowchart TD
    classDef main fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef sub fill:#0f172a,stroke:#94a3b8,stroke-width:1.5px,color:#e2e8f0;
    classDef social fill:#1e1b4b,stroke:#a855f7,stroke-width:2px,color:#f8fafc;

    subgraph UserDomain["1. ユーザー領域 users/{uid}"]
        USERS["<b>USERS</b> (親ドキュメント)<br/>PK: uid / プロフィール・学習習慣・所属グループ"]:::main

        NOTES["<b>NOTES</b><br/>PK: id<br/>個人学習ノート"]:::sub
        GROUP_STATES["<b>GROUP_STATES</b><br/>PK: groupId<br/>グループ既読状態"]:::sub
        PRIVATE_TOKENS["<b>PRIVATE_TOKENS</b><br/>PK: tokens<br/>機密FCMトークン"]:::sub
        LETTERS["<b>LETTERS</b><br/>PK: id<br/>AI振り返りレター"]:::sub

        USERS -->|1:N 所有| NOTES
        USERS -->|1:N 記録| GROUP_STATES
        USERS -->|1:1 隔離| PRIVATE_TOKENS
        USERS -->|1:N 受信| LETTERS
    end

    subgraph GroupDomain["2. グループ領域 groups/{groupId}"]
        GROUPS["<b>GROUPS</b> (親ドキュメント)<br/>PK: groupId / グループ情報・定員5名・団結度"]:::main

        MESSAGES["<b>MESSAGES</b><br/>PK: id<br/>チャットログ (TTL 30日)"]:::sub
        MEMBERS["<b>MEMBERS</b><br/>PK: uid<br/>メンバー個別進捗"]:::sub
        MESSAGES_LATEST["<b>MESSAGES_LATEST</b><br/>PK: latest<br/>最新5件キャッシュ"]:::sub

        GROUPS -->|1:N 投稿| MESSAGES
        GROUPS -->|1:N 管理| MEMBERS
        GROUPS -->|1:1 キャッシュ| MESSAGES_LATEST
    end

    subgraph SocialDomain["3. ソーシャル・管理領域 (ルートコレクション)"]
        CHEERS["<b>CHEERS</b> cheers/{cheerId}<br/>PK: cheerId / エール送信"]:::social
        REPORTS["<b>REPORTS</b> reports/{reportId}<br/>PK: reportId / 違反通報"]:::social
    end

    USERS ===>|N:M 参加 groupIds| GROUPS
    GROUPS ~~~ CHEERS
    GROUPS ~~~ REPORTS
    USERS -.->|エール送信| CHEERS
    USERS -.->|違反通報| REPORTS
```

### ER モデルの解説

1. **ユーザー領域 (`users/{uid}`)**
   利用者個人に属するエンティティです。プロフィールや学習メトリクスを保持する親ドキュメントの下に、学習ノート（`notes`）、グループ別の未読管理（`groupStates`）、AI から届く振り返り（`letters`）、および機密扱いのデバイストークン（`private/tokens`）をサブコレクションとして配置し、明確な所有境界を定めています。

2. **グループ領域 (`groups/{groupId}`)**
   最大 5 名のサークルを形成するエンティティです。グループ情報と団結度を管理する親ドキュメントの下に、対話ログ（`messages`）、メンバー別の参加進捗（`members`）、および初期読み込み高速化用の最新キャッシュ（`messages_latest`）を保持します。

3. **ソーシャル・管理領域 (`cheers`, `reports`)**
   ユーザー間のエール送信や違反通報など、特定のユーザーやグループを跨ぐ横断的なイベントを独立したルートコレクションとして管理します。

---

## 2. コレクション詳細スキーマ定義

### 2.1 ユーザー領域 (`/users/{uid}`)

| コレクション / パス | 主要フィールド | 型 | 説明・制約 |
| :--- | :--- | :--- | :--- |
| **`users/{uid}`**<br>(親ドキュメント) | `uid` (PK)<br>`nickname`<br>`email`<br>`photoURL`<br>`bio`<br>`stake` / `ward`<br>`language`<br>`timeZone`<br>`streakCount`<br>`highestStreak`<br>`daysStudiedCount`<br>`totalNotes`<br>`studiedDates`<br>`groupIds`<br>`groupId`<br>`kickThreshold`<br>`hasFcmToken`<br>`hasCompletedOnboarding`<br>`lastPostAt`<br>`createdAt` | string<br>string<br>string<br>string<br>string<br>string<br>string<br>string<br>number<br>number<br>number<br>number<br>string[]<br>string[]<br>string<br>number<br>boolean<br>boolean<br>timestamp<br>timestamp | Firebase Auth UID<br>表示ニックネーム (最大50文字)<br>メールアドレス<br>プロフィールアイコン画像URL<br>自己紹介文 (最大500文字)<br>所属ステーク・ワード名<br>UI言語コード (`ja`, `en`, `es` 等)<br>標準タイムゾーン (IANA形式)<br>現在の連続学習日数<br>最高連続学習記録<br>累計学習日数<br>累計作成ノート数<br>学習日一覧 (YYYY-MM-DD)<br>所属グループID配列 (最大4グループ)<br>アクティブ選択中のグループID<br>非アクティブによる自動退室基準日数 (1〜30日)<br>FCMトークン保持有無フラグ (高速判定用)<br>オンボーディング完了フラグ<br>最終ノート投稿日時<br>アカウント作成日時 |
| **`users/{uid}/notes/{noteId}`**<br>(サブコレクション) | `id` (PK)<br>`userId` (FK)<br>`scripture`<br>`chapter`<br>`title` / `speaker`<br>`comment`<br>`text`<br>`shareOption`<br>`sharedWithGroups`<br>`sharedMessageIds`<br>`searchTokens`<br>`createdAt`<br>`editedAt` | string<br>string<br>string<br>string<br>string<br>string<br>string<br>enum<br>string[]<br>map<br>string[]<br>timestamp<br>timestamp | ノートID (UUID)<br>作成者 UID<br>聖典区分 (`Book of Mormon`, `New Testament` 等)<br>章・節の参照文字列 (例: `1 Nephi 1:1`)<br>総大会の題名 / 話者名<br>個人の学び・感想コメント<br>検索・表示用の結合テキスト<br>共有範囲 (`all`, `current`, `specific`, `none`)<br>共有先グループID配列<br>各グループのメッセージIDマップ (`groupId -> messageId`)<br>前方一致検索用トークン配列<br>作成日時<br>編集日時 |
| **`users/{uid}/groupStates/{groupId}`**<br>(サブコレクション) | `groupId` (PK)<br>`readMessageCount`<br>`lastReadAt`<br>`lastActiveAt`<br>`updatedAt` | string<br>number<br>timestamp<br>timestamp<br>timestamp | 対象グループID<br>既読メッセージ数 (未読バッジ計算用)<br>最終閲覧日時<br>グループ内最終アクティブ日時<br>状態更新日時 |
| **`users/{uid}/private/tokens`**<br>(機密サブコレクション) | `docId` (PK: `'tokens'`)<br>`fcmTokens`<br>`updatedAt` | string<br>string[]<br>timestamp | 固定ドキュメントID<br>プッシュ通知用 FCM デバイストークン配列<br>トークン最終同期日時 |
| **`users/{uid}/letters/{letterId}`**<br>(サブコレクション) | `id` (PK)<br>`title`<br>`content`<br>`type`<br>`read`<br>`createdAt` | string<br>string<br>string<br>string<br>boolean<br>timestamp | レターID<br>件名<br>AI生成の振り返り手紙 / 開発者レター本文<br>`developer_welcome` または `weekly_reflection`<br>開封済みフラグ<br>生成日時 |

---

### 2.2 グループ領域 (`/groups/{groupId}`)

| コレクション / パス | 主要フィールド | 型 | 説明・制約 |
| :--- | :--- | :--- | :--- |
| **`groups/{groupId}`**<br>(親ドキュメント) | `groupId` (PK)<br>`name`<br>`description`<br>`ownerUserId` (FK)<br>`members`<br>`membersCount`<br>`maxMembers`<br>`isPrivate`<br>`isAiGroup`<br>`isDemoGroup`<br>`inviteCode`<br>`inviteCodeExpiresAt`<br>`previousInviteCodes`<br>`dailyActivity`<br>`memberPreviews`<br>`memberLastActive`<br>`memberLastReadAt`<br>`memberKickThresholds`<br>`timeZone`<br>`lastMessageAt`<br>`lastMessageText`<br>`createdAt` | string<br>string<br>string<br>string<br>string[]<br>number<br>number<br>boolean<br>boolean<br>boolean<br>string<br>timestamp<br>string[]<br>map<br>array<br>map<br>map<br>map<br>string<br>timestamp<br>string<br>timestamp | グループID (自動生成)<br>グループ名 (最大100文字)<br>グループ説明文 (最大1000文字)<br>作成者 UID<br>参加メンバーUID配列 (最大5名)<br>現在の参加メンバー数<br>定員上限 (固定5名)<br>非公開グループフラグ<br>AIコンパニオン参加グループフラグ<br>デモ体験用グループフラグ<br>6桁の招待コード<br>招待コード有効期限 (null = 無期限)<br>過去の有効招待コード履歴<br>本日投稿したメンバー一覧 `{ date: 'YYYY-MM-DD', activeMembers: [] }`<br>参加者のニックネームとアバター (`memberPreviews: MemberPreview[]`)<br>メンバーごとの最終アクティブ日時 (`UID -> timestamp`)<br>メンバーごとの最終閲覧日時 (`UID -> timestamp`)<br>メンバーごとの退室基準日数 (`UID -> number`)<br>グループの標準タイムゾーン<br>最新メッセージ投稿日時<br>最新メッセージのプレビュー本文<br>グループ作成日時 |
| **`groups/{groupId}/messages/{messageId}`**<br>(サブコレクション) | `id` (PK)<br>`groupId` (FK)<br>`senderId` (FK)<br>`senderNickname`<br>`senderPhotoURL`<br>`text`<br>`messageType`<br>`isNote`<br>`scripture`<br>`chapter`<br>`originalNoteId` (FK)<br>`replyTo`<br>`reactions`<br>`reactionPreviews`<br>`translations`<br>`createdAt`<br>`expireAt` | string<br>string<br>string<br>string<br>string<br>string<br>enum<br>boolean<br>string<br>string<br>string<br>map<br>map<br>map<br>map<br>timestamp<br>timestamp | メッセージID<br>所属グループID<br>送信者 UID<br>送信者表示名<br>送信者アバターURL<br>メッセージ本文 (最大2000文字)<br>`text`, `studyNote`, `userJoined`, `unityAnnouncement` 等<br>ノート共有メッセージフラグ<br>聖典区分 (ノート時)<br>章節参照 (ノート時)<br>元の個人ノートID (ノート時)<br>返信先メッセージの引用メタデータ<br>絵文字リアクションマップ (`emoji -> string[]`)<br>絵文字リアクションアバターマップ<br>多言語翻訳キャッシュ (`language -> translatedText`)<br>投稿日時<br>**Firestore TTL 自動削除日時 (投稿から30日後)** |
| **`groups/{groupId}/members/{uid}`**<br>(サブコレクション) | `userId` (PK)<br>`nickname`<br>`photoURL`<br>`status`<br>`readMessageCount`<br>`lastActive`<br>`lastReadAt`<br>`joinedAt`<br>`kickThreshold` | string<br>string<br>string<br>enum<br>number<br>timestamp<br>timestamp<br>timestamp<br>number | メンバー UID<br>非正規化ニックネーム<br>非正規化アバターURL<br>`active`, `idle`, `kicked`<br>既読メッセージ数<br>最終アクション日時<br>最終閲覧日時<br>グループ参加日時<br>個別退室基準日数 |
| **`groups/{groupId}/messages_latest/latest`**<br>(サブコレクション) | `docId` (PK: `'latest'`)<br>`messages` | string<br>Message[] | 固定ドキュメントID<br>最新5件のメッセージスナップショット配列 (Strategy B 高速取得用) |

---

### 2.3 ソーシャル & 管理領域 (ルートコレクション)

| コレクション / パス | 主要フィールド | 型 | 説明・制約 |
| :--- | :--- | :--- | :--- |
| **`cheers/{cheerId}`** | `cheerId` (PK)<br>`senderUid` (FK)<br>`targetUid` (FK)<br>`groupId` (FK)<br>`createdAt` | string<br>string<br>string<br>string<br>timestamp | エール送信ID<br>送信者 UID<br>受信者 UID<br>関連グループID<br>送信日時 |
| **`reports/{reportId}`** | `reportId` (PK)<br>`messageId` (FK)<br>`reporterId` (FK)<br>`reportedUserId` (FK)<br>`reason`<br>`createdAt` | string<br>string<br>string<br>string<br>string<br>timestamp | 通報ID<br>対象メッセージID<br>通報者 UID<br>被通報者 UID<br>通報理由 (最大1000文字)<br>通報日時 |

---

## 3. Firestore の階層パス構造

Cloud Firestore におけるコレクション、ドキュメント、およびサブコレクションの階層ツリーです。

```mermaid
flowchart LR
    classDef root fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef col fill:#1e293b,stroke:#818cf8,stroke-width:1.5px,color:#f8fafc;
    classDef doc fill:#1e1b4b,stroke:#c084fc,stroke-width:1.5px,color:#f8fafc;
    classDef sub fill:#0f172a,stroke:#94a3b8,stroke-width:1px,color:#e2e8f0;

    Root["🔥 Firestore ルート"]:::root

    Root --> UsersCol["users (コレクション)"]:::col
    UsersCol --> UserDoc["{uid} (ドキュメント)"]:::doc
    UserDoc --> Notes["notes / {noteId} (個人用学習ノート)"]:::sub
    UserDoc --> GroupStates["groupStates / {groupId} (グループ別既読)"]:::sub
    UserDoc --> Private["private / tokens (機密FCMトークン)"]:::sub
    UserDoc --> Letters["letters / {letterId} (AI振り返りレター)"]:::sub

    Root --> GroupsCol["groups (コレクション)"]:::col
    GroupsCol --> GroupDoc["{groupId} (ドキュメント)"]:::doc
    GroupDoc --> Messages["messages / {messageId} (チャットログ)"]:::sub
    GroupDoc --> MessagesLatest["messages_latest / latest (最新5件キャッシュ)"]:::sub
    GroupDoc --> Members["members / {uid} (メンバー進捗)"]:::sub

    Root --> CheersCol["cheers / {cheerId} (エール送信)"]:::sub
    Root --> ReportsCol["reports / {reportId} (違反通報)"]:::sub
```

### 階層パスの解説

1. **ユーザー配下のサブコレクション設計**
   `users/{uid}` ドキュメント配下にリソースを集約することで、セキュリティルールの記述を `request.auth.uid == uid` の単純な条件に統一し、他者による不正な読み書きを構造レベルで排除しています。
2. **グループ配下のサブコレクション設計**
   `groups/{groupId}` 配下に `messages` を配置し、グループメンバーのみがメッセージを購読できるスコープを形成しています。また、`messages_latest/latest` を分離することで、チャット画面初期表示時のドキュメント読み取りコストを削減しています。

---

## 4. データの非正規化と高速化設計

1. **グループドキュメントの非正規化 (`groups/{groupId}`)**
   - `memberPreviews`（参加者の名前とアバター情報）を親ドキュメント内に保持し、メンバー一覧表示時に個別ドキュメントの追加読み取りを発生させません。
   - `dailyActivity`（本日投稿したメンバーID一覧）を親ドキュメントに持たせることで、過去メッセージの全件走査を行わずに団結度（Unity）を即時計算します。
2. **ユーザードキュメントの非正規化 (`users/{uid}`)**
   - `groupIds` 配列を保持し、ユーザーが所属するグループ一覧を 1 回のクエリで取得します。

---

## 5. チャットメッセージの自動クリーンアップ (Firestore TTL)

チャット履歴の肥大化を防ぎ、リアルタイムリスナーの負荷を軽減するため、メッセージドキュメントには `expireAt`（投稿から30日後）が設定されています。
Google Cloud Firestore の **TTL（Time-to-Live）機能** により、期限切れとなったメッセージは自動的に削除されます。

---

## 6. 機密データの隔離とアクセス保護

FCM 通知トークンなどの機密情報は、通常のユーザードキュメントとは分離された `users/{uid}/private/tokens` サブコレクションに格納されます。
Firestore セキュリティルールにより、本人（`request.auth.uid == uid`）および管理者権限（Admin SDK）以外からの読み書きを制限しています。

---

## 7. 関連ドキュメント

- [Firebase セキュリティルール](./firebase-security-rules.md)
- [Firestore トランザクション & カウンター設計](./firestore-transactions-counters.md)
- [全体アーキテクチャ](./architecture.md)
