# データベース ＆ セキュリティ設計

このドキュメントでは、Cloud Firestore のデータ構造（ER図）、コレクション階層、非正規化による高速化、および機密データの保護方針について解説します。

---

## 1. エンティティ関係 (ER) モデル

Cloud Firestore の各コレクション・サブコレクション、フィールド構成、およびリレーションシップの詳細です：

```mermaid
flowchart TD
    classDef main fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef sub fill:#0f172a,stroke:#94a3b8,stroke-width:1.5px,color:#e2e8f0;
    classDef social fill:#1e1b4b,stroke:#a855f7,stroke-width:2px,color:#f8fafc;

    subgraph UserSpace["【ユーザー領域】 users/{uid}"]
        USERS["<b>USERS</b> (親ドキュメント)<br/>──────────────────────<br/>• uid (PK: string)<br/>• email, nickname, photoURL, bio<br/>• stake, ward, language, timeZone<br/>• streakCount, highestStreak<br/>• daysStudiedCount, totalNotes<br/>• studiedDates: string[]<br/>• groupIds: string[] (所属グループID)<br/>• groupId: string (選択中グループ)<br/>• kickThreshold: number (退室基準日数)<br/>• hasFcmToken: boolean (非正規化)<br/>• hasCompletedOnboarding: boolean<br/>• lastPostAt, createdAt: timestamp"]:::main

        NOTES["<b>NOTES</b> (サブコレクション: notes)<br/>──────────────────────<br/>• id (PK: string / UUID)<br/>• userId (FK: string)<br/>• scripture, chapter, title, speaker<br/>• comment, text (結合テキスト)<br/>• shareOption (all/current/specific/none)<br/>• sharedWithGroups: string[]<br/>• sharedMessageIds: map<br/>• searchTokens: string[] (前方一致検索)<br/>• createdAt, editedAt: timestamp"]:::sub

        GROUP_STATES["<b>GROUP_STATES</b> (サブコレクション: groupStates)<br/>──────────────────────<br/>• groupId (PK: string)<br/>• readMessageCount: number<br/>• lastReadAt, lastActiveAt: timestamp<br/>• updatedAt: timestamp"]:::sub

        PRIVATE_TOKENS["<b>PRIVATE_TOKENS</b> (サブコレクション: private)<br/>──────────────────────<br/>• docId: tokens (固定)<br/>• fcmTokens: string[] (機密FCMトークン)<br/>• updatedAt: timestamp"]:::sub

        LETTERS["<b>LETTERS</b> (サブコレクション: letters)<br/>──────────────────────<br/>• id (PK: string)<br/>• title, content (AI振り返り/ウェルカム文)<br/>• type: developer_welcome | weekly_reflection<br/>• read: boolean, createdAt: timestamp"]:::sub
    end

    subgraph GroupSpace["【グループ領域】 groups/{groupId}"]
        GROUPS["<b>GROUPS</b> (親ドキュメント)<br/>──────────────────────<br/>• groupId (PK: string)<br/>• name (100文字), description, ownerUserId (FK)<br/>• members: string[] (所属UID / 最大5名)<br/>• membersCount: number, maxMembers: 5 (固定)<br/>• isPrivate: boolean, isAiGroup: boolean, isDemoGroup: boolean<br/>• inviteCode, inviteCodeExpiresAt, previousInviteCodes[]<br/>• dailyActivity: { date, activeMembers[] }<br/>• memberPreviews: MemberPreview[] (非正規化)<br/>• memberLastActive, memberKickThresholds: map<br/>• timeZone, lastMessageAt, lastMessageText<br/>• createdAt: timestamp"]:::main

        MESSAGES["<b>MESSAGES</b> (サブコレクション: messages)<br/>──────────────────────<br/>• id (PK: string)<br/>• groupId (FK), senderId (FK), senderNickname, senderPhotoURL<br/>• text, messageType (text/studyNote/userJoined等)<br/>• isNote: boolean, scripture, chapter, originalNoteId (FK)<br/>• replyTo: map, reactions: map, reactionPreviews: map<br/>• translations: map (多言語キャッシュ)<br/>• createdAt: timestamp<br/>• expireAt: timestamp (TTL: 30日後自動削除)"]:::sub

        MEMBERS["<b>MEMBERS</b> (サブコレクション: members)<br/>──────────────────────<br/>• userId (PK: string)<br/>• nickname, photoURL, status (active/idle/kicked)<br/>• readMessageCount: number<br/>• lastActive, lastReadAt, joinedAt: timestamp<br/>• kickThreshold: number"]:::sub

        MESSAGES_LATEST["<b>MESSAGES_LATEST</b> (サブコレクション: messages_latest)<br/>──────────────────────<br/>• docId: latest (固定)<br/>• messages: Message[] (最新5件キャッシュ)"]:::sub
    end

    subgraph SocialSpace["【ソーシャル / 管理領域】"]
        CHEERS["<b>CHEERS</b> (ルートコレクション: cheers)<br/>──────────────────────<br/>• cheerId (PK: string)<br/>• senderUid (FK), targetUid (FK)<br/>• groupId (FK), createdAt: timestamp"]:::social

        REPORTS["<b>REPORTS</b> (ルートコレクション: reports)<br/>──────────────────────<br/>• reportId (PK: string)<br/>• messageId (FK), reporterId (FK), reportedUserId (FK)<br/>• reason: string, createdAt: timestamp"]:::social
    end

    USERS -->|1 : N 所有| NOTES
    USERS -->|1 : N 既読記録| GROUP_STATES
    USERS -->|1 : 1 隔離| PRIVATE_TOKENS
    USERS -->|1 : N 受信| LETTERS
    USERS -.->|N : M 参加 / groupIds| GROUPS

    GROUPS -->|1 : N 投稿| MESSAGES
    GROUPS -->|1 : N メンバー管理| MEMBERS
    GROUPS -->|1 : 1 高速プレビュー| MESSAGES_LATEST

    USERS -.->|エール送信| CHEERS
    USERS -.->|違反通報| REPORTS
```

---

## 2. Firestore の階層パス構造

```mermaid
graph TD
    Root["Firestore ルート"]

    Root --> Users["users / コレクション"]
    Root --> Groups["groups / コレクション"]
    Root --> Cheers["cheers / コレクション"]
    Root --> Reports["reports / コレクション"]

    Users --> UserDoc["{uid} / ドキュメント"]
    Groups --> GroupDoc["{groupId} / ドキュメント"]

    UserDoc --> Private["private / tokens (機密FCMトークン)"]
    UserDoc --> Notes["notes / {noteId} (個人用学習ノート)"]
    UserDoc --> GroupStates["groupStates / {groupId} (グループ別既読カウント)"]
    UserDoc --> Letters["letters / {letterId} (AI振り返りレター)"]

    GroupDoc --> Messages["messages / {messageId} (アクティブチャットログ)"]
    GroupDoc --> MessagesLatest["messages_latest / latest (高速プレビュー用最新5件)"]
    GroupDoc --> Members["members / {uid} (メンバー個別ステータス・進捗)"]
```

---

## 3. データの非正規化と高速化設計

1. **グループドキュメントの工夫 (`groups/{groupId}`)**:
   - `memberPreviews`（参加者の名前とアイコン）を親ドキュメント内に保持することで、メンバー全員分のドキュメントを読み込まずに一覧を表示できます。
   - `dailyActivity`（本日投稿したメンバーID一覧）を持たせることで、過去のメッセージを全件走査せずに団結度を即時計算できます。
2. **ユーザードキュメントの工夫 (`users/{uid}`)**:
   - `groupIds` 配列を保持し、ユーザーが所属するグループ一覧を 1 回のクエリで取得可能にしています。

---

## 4. チャットメッセージの自動クリーンアップ (Firestore TTL)

チャット履歴の肥大化を防ぎ、リアルタイムリスナーを軽量に保つため、メッセージドキュメントには `expireAt`（30日後）が設定されています。
Google Cloud Firestore の **TTL（Time-to-Live）機能** により、期限切れのメッセージはバックグラウンドで自動削除されます。

---

## 5. 機密データの隔離とアクセス保護

FCM 通知トークンなどの機密情報は、通常のユーザードキュメントとは分離された `users/{uid}/private/tokens` サブコレクションに保存されます。
Firestore セキュリティルールにより、本人（`request.auth.uid == uid`）およびサーバー（Admin SDK）以外からのアクセスを制限しています。

---

## 6. 関連ドキュメント

- [Firebase セキュリティルール](./firebase-security-rules.md)
- [Firestore トランザクション & カウンター設計](./firestore-transactions-counters.md)
- [全体アーキテクチャ](./architecture.md)
