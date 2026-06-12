# Firebase セキュリティルールと CQRS 書き込み分離

このドキュメントでは、プロジェクトの **Firestore セキュリティルール** (`firestore.rules`) に設定されているセキュリティルール、動的検証、および書き込み分離パターンについて詳しく説明します。

---

## 🛡️ セキュリティモデル: 2層の保護体制

最大限の保護を実現するため、アプリケーションは**多重防御（Defense-in-Depth）**戦略を採用しています。セキュリティはAPIレイヤーで1回チェックされるだけでなく、データベースレイヤーで2回目の検証が行われます。

```
受信したリクエスト ──► [ ティア1: APIミドルウェア ] ──► [ ティア2: データベースルール ] ──► データのコミット
                       - Express ルーター                  - firestore.rules
                       - verifyAppCheck                 - isAuthenticated()
                       - globalLimiter                  - isAppCheckVerified()
                       (security-architecture.md を参照) (本ドキュメント)
```

1. **ティア1 (APIゲートウェイ)**: 高負荷な処理（AIタスク、スクレイパー、通知）のセキュリティ保護および検証ルールの実行を行います。カスタムミドルウェアが App Check とユーザーセッションを検証します。（[App Check & API保護](security-architecture.md) を参照）。
2. **ティア2 (データベースレイヤー)**: Firestore セキュリティルールが直接フォールバックとして機能します。ユーザーがAPIゲートウェイをバイパスした場合や、クライアントSDKがFirestoreに直接書き込もうとした場合、セキュリティルールがそのアクションをブロックします。

---

## 1. セキュリティルールの検証レイヤー

`firestore.rules` ファイルは、アクセスを許可する前に主に2つの条件を確認します: **メールアドレス確認 (Email Verification)** と **Firebase App Check**。

### A. メールアドレス確認 (`isAuthenticated()`)
スパムやボットアカウントを防止するため、グループへの参加や投稿の閲覧などのアクションには、確認済みのメールアドレスを持つ認証済みユーザーが必要です。
```javascript
function isAuthenticated() {
  return request.auth != null && (
    request.auth.token.email_verified == true || 
    request.auth.token.get('email_verified', false) == true ||
    request.auth.token.get('email', '').matches('.*@example[.]com$')
  );
}
```
* **自動テスト用のバイパス**: 生のメールアドレスを確認することなく E2E 統合テストを実行できるように、本番環境以外のテスト環境では、末尾が `@example.com` のメールアドレスはこのチェックをバイパスできます。

### B. App Check の検証 (`isAppCheckVerified()`)
クライアント側でのユーザードキュメント登録（`/users/{userId}`）の際、アプリケーションはボットが直接レコードを作成するのをブロックします。
```javascript
function isAppCheckVerified() {
  return (request.auth != null && request.auth.token.get('email', '').matches('.*@example[.]com$')) || 
         request.appCheck != null;
}
```
* **セキュリティ動作**: リクエストに真正な App Check トークンが含まれているかを確認します。このトークンがない場合、Firestore でのドキュメント作成は拒否されます。

---

## 2. ビジネスロジックの強制（グループサイズ制限）

ビジネスロジック上の制限は通常、バックエンドAPIで管理されますが、ユーザーがクライアント側の制約をバイパスして、直接複数のグループを作成しようとする可能性があります。

データベースの境界で安全性を強制するため、`/groups/{groupId}` 作成時のセキュリティルールは、ユーザーのドキュメントをチェックして現在の所有グループ数を評価します。

```javascript
allow create: if isAuthenticated() && 
  request.resource.data.ownerUserId == request.auth.uid &&
  get(/databases/$(database)/documents/users/$(request.auth.uid)).data.get('groupIds', []).size() < 4;
```

### メカニズム:
1. **動的ルックアップ**: `get(/databases/$(database)/documents/users/...)` を使用して、ユーザーの現在の状態をロードします。
2. **サイズ制約**: `groupIds.size() < 4` を評価します。
3. **動作**: ユーザーがコンソールの Firestore SDK を使用して直接 `.set()` を呼び出したとしても、既に4つのグループを所有している場合は、データベースが作成をブロックします。

---

## 3. ハイブリッド書き込みモデルと CQRS サーバーサイド書き込み分離パターン

**scripture-habit** では、本番環境でのセキュリティ強化と、オフライン時の応答性（Firestore Offline Persistence）の維持を両立させるため、**ハイブリッド書き込みモデル**を採用しています。

- **共同作業用リソースのサーバーサイド分離 (CQRS/APIミューテーション)**:
  グループ全体のメッセージ（`messages`）、メンバー情報（`members`）、応援（`cheers`）などの共同作業用リソースは、クライアントによる改ざんを防止し、トランザクションの整合性を保つため、`firestore.rules` で `allow write: if false;` として完全にロックダウンされています。これらの作成・更新・削除は、**バックエンドの Express API（Firebase Admin SDK）のみ**が行うことができます。
- **個人用リソースの直接クライアント書き込み**:
  ユーザー設定、通知用トークン（`private/tokens`）、ローカル既読状態（`groupStates`）など、個人に特化したデータについては、オフライン時の動作保証と即時反映（Latency Compensation）のために、認証された本人（`request.auth.uid == userId`）に限り、フロントエンドから Firestore Client SDK を使用した直接の作成・更新が許可されています。

```
                              読み書き (個人用リソース: users, tokens, groupStates など)
       [ クライアントアプリ ] ───────────────────────────────────────────────► [ Firestore データベース ]
              │                                                             ▲
              │                                                             │
         HTTPコマンド                                                 書き込み (Admin SDK)
              │                                                             │
              ▼                                                             │
       [ Express API ] ─── トランザクション / 検証 / セキュリティ ────────────┘
```

### `firestore.rules` における直接書き込みの制限
セキュリティルールは、共同作業用リソースへの書き込み権限をロックダウンします。

* **グループメッセージ**:
  ```javascript
  match /messages/{messageId} {
    allow read: if isAuthenticated() && isMemberOfGroup(groupId);
    allow write: if false; // クライアントからの書き込みをブロック
  }
  ```
* **グループのメンバー名簿**:
  ```javascript
  match /members/{userId} {
    allow read: if isAuthenticated() && isMemberOfGroup(groupId);
    allow write: if false; // クライアントからの書き込みをブロック
  }
  ```
* **応援 (Cheers) / リアクション**:
  ```javascript
  match /cheers/{cheerId} {
    allow read: if ...
    allow write: if false; // クライアントからの書き込みをブロック
  }
  ```

### なぜ書き込み分離を使用するのか？
1. **検証と型安全性**: クライアント SDK では厳格なスキーマ検証を強制することが困難です。変更を必ず Express を経由させることで、Firestore に書き込まれる前に送信されたデータが厳密なスキーマに一致することを保証できます。
2. **トランザクションの調整**: メッセージの作成やグループへの参加には、複数のドキュメントの更新が必要です（例: ユーザーのグループリストの更新、グループメンバーシップマップ、カウンターの集計、プッシュ通知の送信）。これらをフロントエンドのクライアントが安全に調整することは困難です（[Firestoreトランザクションとカウンターサービス](firestore-transactions-counters.md) を参照）。
3. **悪意のある上書きの防止**: クライアントが `/members/` や `/messages/` に書き込みアクセス権を持っていた場合、ユーザーが他のメンバーのロールを変更したり、投稿者を偽装したり、共有された履歴を削除したりする可能性があります。
4. **App Check とレート制限ゲートウェイ**: バックエンドエンドポイントは Express レート制限器とバックエンド `verifyAppCheck` ミドルウェアによって保護されており、DDoS 攻撃から保護されています。
