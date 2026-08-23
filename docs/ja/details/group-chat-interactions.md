# グループチャット インタラクションエンジン — コアロジック詳細

## 概要

グループチャット機能は、**5つの専用カスタムフック**によって構成されています。それぞれが明確な責務を担い、UI層からビジネスロジックを切り離すことで、保守性と再利用性を高めています。

| フック | ファイルパス | 主な責務 |
|--------|------------|---------|
| `use-message-actions.ts` | `hooks/api/` | メッセージ送信・編集・削除・リアクション・翻訳 |
| `use-cheer-system.ts` | `hooks/interaction/` | エール送信・一日一回制限管理 |
| `use-report-system.ts` | `hooks/api/` | コンテンツ通報・Firestore直接書き込み |
| `use-group-actions.ts` | `hooks/api/` | グループ退出・削除・設定変更・SNS共有 |
| `use-group-chat-handlers.ts` | `hooks/interaction/` | モーダル管理・メンバーリスト・リアクション展開 |

### 全体アーキテクチャ

```mermaid
flowchart TD
    UI["UI コンポーネント\n(GroupChatPage)"]

    UI --> UMA
    UI --> UCS
    UI --> URS
    UI --> UGA
    UI --> UGCH

    UMA["use-message-actions\nメッセージ送受信・リアクション・翻訳"]
    UCS["use-cheer-system\nエール管理"]
    URS["use-report-system\n通報"]
    UGA["use-group-actions\nグループ管理・SNS共有"]
    UGCH["use-group-chat-handlers\nモーダル・メンバー"]

    UMA --> STORE["メッセージストア\nADD / UPDATE / REMOVE"]
    STORE --> UI

    UMA --> API_MSG["POST /api/groups/\npost-message\nedit-message\ndelete-message"]
    UMA --> API_REACT["POST /api/groups/\ntoggle-reaction\nupdate-read-status"]
    UMA --> API_TRANS["POST /api/ai/\ntranslate-batch"]

    UCS --> FS_CHEERS["Firestore\ncheers コレクション"]
    UCS --> API_CHEER["POST /api/groups/\nsend-cheer"]

    URS --> FS_REPORTS["Firestore\nreports コレクション"]

    UGA --> API_GROUP["POST /api/groups/\nleave-group\ndelete-group\nupdate-group"]

    UGCH --> FS_MEMBERS["Firestore\nusers コレクション\n(差分フェッチ)"]
```


---

## 1. 楽観的メッセージ送受信パイプライン

グループチャットのメッセージ操作（送信・編集・削除）はすべて**楽観的UI更新（Optimistic UI）**パターンを採用しています。ユーザー操作への即時フィードバックを優先しつつ、API失敗時には自動的にロールバックします。

### 1.1 メッセージ送信フロー

```mermaid
sequenceDiagram
    actor ユーザー
    participant UI as UI コンポーネント
    participant Hook as use-message-actions
    participant Store as メッセージストア
    participant API as POST /api/groups/post-message
    participant ReadAPI as POST /api/groups/update-read-status

    ユーザー->>UI: 送信ボタンを押す
    UI->>Hook: handleSendMessage(text)

    Note over Hook: clientTimestamp = Date.now()
    Note over Hook: tempId = "temp-{clientTimestamp}" を生成

    Hook->>Store: dispatch(ADD_NEW_MESSAGES, { id: tempId, text, ... })
    Note over UI: 仮IDでメッセージが即座に表示される

    Hook->>API: POST /api/groups/post-message
    alt 成功
        API-->>Hook: { messageId: "実ID" }
        Hook->>Store: dispatch(UPDATE_MESSAGE, { tempId → messageId })
        Note over UI: 仮IDが実IDに置き換わる
        Hook-->>ReadAPI: fire-and-forget: POST /api/groups/update-read-status
    else 失敗
        API-->>Hook: エラー
        Hook->>Store: dispatch(REMOVE_MESSAGE, tempId)
        Note over UI: 仮メッセージが削除される（ロールバック）
    end
```

> [!IMPORTANT]
> 仮ID (`temp-{clientTimestamp}`) はクライアント側のタイムスタンプから生成されるため、衝突のリスクは極めて低いですが、実IDへの確実な置き換えが必要です。`UPDATE_MESSAGE` アクションは `tempId` をキーとして実IDに更新します。

> [!NOTE]
> `update-read-status` の呼び出しは **fire-and-forget** です。送信処理の完了を待たず、失敗してもロールバックは行われません。これは既読管理がUX上のベストエフォートで十分なためです。

```typescript
// handleSendMessage の核心ロジック（概念）
const clientTimestamp = Date.now();
const tempId = `temp-${clientTimestamp}`;

// 楽観的追加
dispatch(ADD_NEW_MESSAGES, { id: tempId, text, senderId: currentUid, ... });

try {
  const { messageId } = await post('/api/groups/post-message', { text, groupId });
  // 仮IDを実IDに解決
  dispatch(UPDATE_MESSAGE, { oldId: tempId, newId: messageId });
  // 既読更新（fire-and-forget）
  post('/api/groups/update-read-status', { groupId });
} catch {
  // ロールバック
  dispatch(REMOVE_MESSAGE, tempId);
}
```

### 1.2 メッセージ編集フロー

```mermaid
sequenceDiagram
    actor ユーザー
    participant Hook as use-message-actions
    participant Store as メッセージストア
    participant API as POST /api/groups/edit-message

    ユーザー->>Hook: handleSaveEdit(messageId, newText)
    Note over Hook: 編集前テキストを保存
    Hook->>Store: dispatch(UPDATE_MESSAGE, { id, text: newText })
    Note over Store: 即座にUIに反映

    Hook->>API: POST /api/groups/edit-message

    alt 失敗
        API-->>Hook: エラー
        Hook->>Store: dispatch(UPDATE_MESSAGE, { id, text: 旧テキスト })
        Note over Store: 元のテキストに戻す（ロールバック）
    end
```

### 1.3 メッセージ削除フロー

```mermaid
sequenceDiagram
    actor ユーザー
    participant Hook as use-message-actions
    participant Store as メッセージストア
    participant API as POST /api/groups/delete-message

    ユーザー->>Hook: handleConfirmDeleteMessage(message)
    Note over Hook: メッセージオブジェクト全体を退避
    Hook->>Store: dispatch(REMOVE_MESSAGE, message.id)
    Note over Store: メッセージが即座に消える

    Hook->>API: POST /api/groups/delete-message

    alt 失敗
        API-->>Hook: エラー
        Hook->>Store: dispatch(ADD_NEW_MESSAGES, 退避したメッセージ)
        Note over Store: 削除を取り消す（メッセージを再追加）
    end
```

> [!WARNING]
> 削除のロールバックでは `REMOVE_MESSAGE` の逆として `ADD_NEW_MESSAGES` を使用します。退避したメッセージオブジェクト全体を再追加するため、元の順序が保証されるよう、ストア側でタイムスタンプ順ソートが適切に実装されている必要があります。

---

## 2. リアクション & リプライシステム

### 2.1 リアクショントグルロジック

`handleToggleReactionDirect(message, emoji)` は以下の手順でリアクションを処理します：

```mermaid
flowchart TD
    Start["handleToggleReactionDirect\n(message, emoji)"]
    Check{"現在の reactions[emoji]\nに自分のUIDが含まれるか?"}
    Remove["UID を uid リストから除去"]
    Add["UID を uid リストに追加"]
    CalcPreview["reactionPreviews を再計算\n(最大3件まで)"]
    OptUpdate["楽観的更新をディスパッチ"]
    CallAPI["POST /api/groups/toggle-reaction"]
    Success{"API成功?"}
    Rollback["元の reactions に戻す\n(ロールバック)"]
    Done["完了"]

    Start --> Check
    Check -->|"はい (既にリアクション済み)"| Remove
    Check -->|"いいえ"| Add
    Remove --> CalcPreview
    Add --> CalcPreview
    CalcPreview --> OptUpdate
    OptUpdate --> CallAPI
    CallAPI --> Success
    Success -->|はい| Done
    Success -->|いいえ| Rollback
    Rollback --> Done
```

### 2.2 `reactionPreviews` の3件上限

`reactionPreviews` は各絵文字に対して**最大3件**のニックネームプレビューを保持します。これはUI上で「田中, 鈴木, 他1名」のような表示に使用されます。

```typescript
// reactionPreviews 計算の概念コード
const MAX_PREVIEWS = 3;

// ReactionPreview 型: { uid: string, nickname: string, photoURL: string | null }
const newPreviews: Record<string, ReactionPreview[]> = {};
for (const [emojiKey, uidList] of Object.entries(newReactions)) {
  // uidList の先頭 MAX_PREVIEWS 件のプレビューオブジェクトを生成
  newPreviews[emojiKey] = uidList
    .slice(0, MAX_PREVIEWS)
    .map(uid => ({ uid, nickname: membersMap[uid]?.nickname ?? uid, photoURL: membersMap[uid]?.photoURL ?? null }));
}
```

> [!NOTE]
> プレビューは表示上の最適化であり、正確なリアクション数は `reactions[emoji].length` から取得します。`reactionPreviews` が古くなっても、正確なカウントに影響はありません。

### 2.3 リアクションデータ構造

```typescript
// メッセージオブジェクト内のリアクション関連フィールド
type ReactionPreview = { uid: string; nickname: string; photoURL: string | null };

type Message = {
  id: string;
  reactions: Record<string, string[]>;
  // 例: { "😊": ["uid1", "uid2", "uid3"], "👍": ["uid2"] }

  reactionPreviews: Record<string, ReactionPreview[]>;
  // 例: { "😊": [{ uid: "uid1", nickname: "田中", photoURL: "..." }, ...], "👍": [...] }
  // ※ 各絵文字につき最大3件のオブジェクト
};
```

---

## 3. 遅延バッチ翻訳エンジン

翻訳機能はパフォーマンスとAPI呼び出し効率を最大化するため、**400msデバウンス + バッチ処理**アーキテクチャを採用しています。

### 3.1 翻訳フロー全体

```mermaid
sequenceDiagram
    actor ユーザー
    participant UI as UI コンポーネント
    participant Hook as use-message-actions
    participant Queue as batchQueueRef (メモリ)
    participant Timer as batchTimerRef (タイマー)
    participant API as POST /api/ai/translate-batch
    participant State as translatedTexts (state)

    ユーザー->>UI: 翻訳ボタンを押す (message A)
    UI->>Hook: handleLazyTranslate(messageA)

    Hook->>Hook: スキップ判定
    Note over Hook: ① 既に翻訳済み？<br/>② 現在翻訳中？<br/>③ isLikelyAlreadyInLanguage？

    alt スキップ条件に該当
        Hook-->>UI: 何もしない
    else 翻訳が必要
        Hook->>Queue: messageA を batchQueueRef に追加
        Hook->>Timer: 既存タイマーをクリア
        Hook->>Timer: 400ms タイマーをセット → processBatch

        Note over Timer: 400ms 以内に別の翻訳リクエストが来た場合<br/>タイマーはリセットされる

        Timer->>Hook: 400ms 経過 → processBatch()
        Hook->>Queue: キューを取り出し、重複排除
        Hook->>API: POST /api/ai/translate-batch\n{ messages: [A, B, C, ...] }
        API-->>Hook: { translations: { id: translatedText, ... } }
        Hook->>State: translatedTexts を更新
        State-->>UI: 翻訳テキストが表示される
    end
```

### 3.2 言語検出スキップ (`isLikelyAlreadyInLanguage`)

翻訳不要なメッセージをAPIに送らないよう、クライアントサイドで言語を推定します。

```typescript
// 言語検出の概念（日本語 vs ラテン文字）
function isLikelyAlreadyInLanguage(text: string, targetLang: string): boolean {
  if (targetLang === 'ja') {
    // Unicode 範囲で日本語文字（ひらがな・カタカナ・漢字）を検出
    const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/;
    return japaneseRegex.test(text);
  }
  // ラテン文字圏の場合は逆の判定
  const latinRegex = /[a-zA-Z]/;
  return latinRegex.test(text);
}
```

> [!TIP]
> この言語検出はヒューリスティックであり、完全な精度を保証するものではありません。混合言語テキスト（例：「Hello 世界」）は誤検出される可能性があります。ただし、API呼び出しコストの削減と応答速度の向上というトレードオフで、実用上十分な精度です。

### 3.3 `processBatch` の重複排除

ユーザーが同じメッセージの翻訳ボタンを複数回押した場合でも、`processBatch` はキュー内のメッセージIDを重複排除してからAPIを呼び出します。

```typescript
// processBatch の重複排除（概念コード）
function processBatch() {
  // batchQueueRef からメッセージを取り出す
  const rawQueue = batchQueueRef.current;
  batchQueueRef.current = []; // キューをクリア

  // messageId で重複排除
  const seen = new Set<string>();
  const dedupedMessages = rawQueue.filter(msg => {
    if (seen.has(msg.id)) return false;
    seen.add(msg.id);
    return true;
  });

  // バッチAPIを呼び出す
  await post('/api/ai/translate-batch', { messages: dedupedMessages });
}
```

### 3.4 グループ切替時のキャッシュクリア

`groupId` が変わると、翻訳キャッシュと翻訳中IDセットを自動的にリセットします。

```typescript
// groupId 変更を監視するuseEffect（概念）
useEffect(() => {
  // 別グループの翻訳キャッシュを持ち越さない
  setTranslatedTexts({});
  translatingIdsRef.current = new Set();
}, [groupId]);
```

> [!IMPORTANT]
> グループ切替時のクリアを忘れると、前のグループの翻訳テキストが新しいグループのメッセージに表示される可能性があります。`useEffect` の依存配列に `groupId` を正確に含めることが重要です。

---

## 4. エール（Cheer）システム

### 4.1 概要

エールはグループメンバー同士が**一日一回**送り合える称賛機能です。タイムゾーンに対応した日付管理により、世界中のユーザーが公平に利用できます。

### 4.2 初期化：Firestoreクエリパターン

コンポーネントマウント時に、今日すでにエールを送った相手のUIDセットをFirestoreから取得します。

```typescript
// マウント時のFirestoreクエリ（概念）
const todayStr = new Intl.DateTimeFormat('sv-SE', {
  timeZone: userData.timeZone  // 例: "Asia/Tokyo"
}).format(new Date());
// → "2026-05-28" (YYYY-MM-DD 形式)

const q = query(
  collection(db, 'cheers'),
  where('senderUid', '==', userData.uid),
  where('date', '==', todayStr)
);

const snapshot = await getDocs(q);
const cheeredUids = new Set(snapshot.docs.map(doc => doc.data().targetUid));
// → cheeredTodayUids に保存
```

> [!NOTE]
> 日付フォーマットに `sv-SE` ロケールを使用するのは、スウェーデン語のロケールが ISO 8601 形式（YYYY-MM-DD）を自然に出力するためです。これはタイムゾーン対応日付文字列を生成する簡潔なテクニックです。

### 4.3 エール送信フロー

```mermaid
sequenceDiagram
    actor ユーザー
    participant UI as UI / モーダル
    participant Hook as use-cheer-system
    participant Guard as cheeredTodayUids (Set)
    participant API as POST /api/groups/send-cheer
    participant Firestore as cheers コレクション

    ユーザー->>Hook: handleCheerClick(member)
    Hook->>Hook: 自分自身へのチェック (member.id === userData.uid)
    alt 自分自身の場合
        Hook-->>ユーザー: 何もしない (早期リターン)
    else 他人の場合
        Hook->>UI: cheerTarget に member を設定
    end

    ユーザー->>UI: 送信確認を承認
    UI->>Hook: handleSendCheer()

    Hook->>Hook: 送信中チェック (isSendingCheer)
    Hook->>Guard: cheeredTodayUids.has(cheerTarget.id) ?
    alt 既にエール済み
        Hook-->>ユーザー: 送信処理をスキップ
    else 未エール
        Hook->>API: POST /api/groups/send-cheer\n{ targetUid: cheerTarget.id, groupId, senderNickname, senderTimeZone }
        API->>Firestore: cheers ドキュメントを追加\n{ senderUid, targetUid, date, groupId, ... }
        API-->>Hook: 成功
        Hook->>Guard: cheeredTodayUids.add(cheerTarget.id)
        Note over Guard: 当日中の再送不可セットに追加
    end
```

### 4.4 エール制限のガード仕様

| 条件 | 結果 |
|------|------|
| `member.id === userData.uid` | 処理中断（自分へのエール不可、`handleCheerClick` 内で制御） |
| `cheeredTodayUids.has(member.id)` | 送信不可（本日分は使用済み、UIボタン無効化や `handleSendCheer` 内で制御） |
| 上記のいずれでもない | API呼び出しを実行 |

> [!WARNING]
> `cheeredTodayUids` はメモリ上のSetであるため、ページをリロードすると再度Firestoreからクエリし直します。サーバー側でも重複チェックを実施することを強く推奨します（Firestoreのセキュリティルールまたはバックエンドで強制）。

---

## 5. コンテンツモデレーション: 通報システム

### 5.1 設計方針

通報システムはバックエンドAPIを経由せず、**クライアントから Firestore `reports` コレクションへ直接書き込む**設計です。これにより、バックエンドへの通報処理の実装コストを省きつつ、Firestore のセキュリティルールで書き込み権限を制御できます。

### 5.2 通報フロー

```mermaid
flowchart TD
    A["ユーザーがメッセージの\n通報ボタンを押す"] --> B["handleReportClick(message)"]
    B --> C["reportedMessage を state に保存"]
    C --> D["通報モーダルを表示"]
    D --> E{"ユーザーが確認?"}
    E -->|"キャンセル"| F["モーダルを閉じる"]
    E -->|"通報する"| G["confirmReport()"]
    G --> H["addDoc(reports コレクション, {\n  messageId,\n  groupId,\n  reporterUid,\n  reason: 'inappropriate',\n  createdAt: serverTimestamp(),\n  text,\n  senderId\n})"]
    H --> I["Firestore に通報ドキュメント作成"]
    I --> J["モーダルを閉じる"]
```

### 5.3 `reports` コレクションのドキュメント構造

```typescript
// Firestore reports コレクションに保存されるフィールド
interface ReportDocument {
  messageId: string;      // 通報対象メッセージのID
  groupId: string;        // 所属グループのID
  reporterUid: string;    // 通報者のUID
  reason: string;         // 通報理由（デフォルト: 'inappropriate'）
  createdAt: Timestamp;   // Firestore サーバータイムスタンプ
  text: string;           // 通報対象メッセージの本文
  senderId: string;       // 通報対象メッセージの送信者UID
}
```

> [!NOTE]
> `createdAt` には `serverTimestamp()` を使用しています。クライアントの時計のズレに依存せず、Firestoreサーバーの正確な時刻が記録されます。

> [!TIP]
> デフォルトの通報理由は `'inappropriate'` ですが、UIで理由を選択させる拡張が容易です。`confirmReport()` 呼び出し前に `reason` を更新するだけで対応できます。

---

## 6. グループ管理アクション

### 6.1 退出・削除の二重送信防止ガード

`handleLeaveGroup` と `handleDeleteGroup` は共に `actionInProgress` refを使用して、ボタンの連打（ダブルタップ）による重複リクエストを防ぎます。

```typescript
// actionInProgress ref ガードパターン（概念）
const actionInProgress = useRef(false);

async function handleLeaveGroup() {
  if (actionInProgress.current) return; // 二重送信防止
  actionInProgress.current = true;

  try {
    await post('/api/groups/leave-group', { groupId });
    router.push(`/${language}/dashboard`);
  } finally {
    actionInProgress.current = false; // 完了後にリセット
  }
}
```

> [!IMPORTANT]
> `useRef` を使用する理由は、`useState` と異なり値の変更が再レンダリングを引き起こさないためです。ガードフラグは純粋に副作用の制御に使用するため、`ref` が適切です。

### 6.2 グループ名・説明の翻訳ペイロード

`handleUpdateGroupName` は翻訳フィールドがある場合に `translations` オブジェクトを動的に構築します。

```typescript
// 翻訳ペイロードの構築（概念）
function handleUpdateGroupName(
  name: string,
  desc: string,
  transName?: string,
  transDesc?: string
) {
  const payload: Record<string, unknown> = { name, description: desc, groupId };

  // 翻訳フィールドが存在する場合のみ追加
  if (transName || transDesc) {
    payload.translations = {
      [language]: {
        ...(transName && { name: transName }),
        ...(transDesc && { description: transDesc }),
      }
    };
  }

  return post('/api/groups/update-group', payload);
}
```

### 6.3 公開設定トグル

```typescript
// 現在の isPublic の反転値を送信
function togglePublicStatus() {
  return post('/api/groups/update-group', {
    groupId,
    isPublic: !groupData.isPublic,
  });
}
```

### 6.4 SNS共有ハンドラー

各SNSの動作方式は以下の通りです。

| SNS | 方式 | 詳細 |
|-----|------|------|
| **LINE** | `window.open` | `https://line.me/...` に招待メッセージをURLエンコードして開く |
| **WhatsApp** | `window.open` | `https://wa.me/?text=...` に招待メッセージをURLエンコードして開く |
| **Messenger** | `window.open` | MessengerのカスタムURLスキーム（`fb-messenger://share`）を開く |
| **Instagram** | クリップボード + `window.open` | 招待リンクをクリップボードにコピー後、Instagram を開く |

> [!NOTE]
> InstagramはWeb経由の直接テキスト共有APIを提供していないため、**リンクをクリップボードにコピー**してからInstagramアプリを開くという二段階の方式を採用しています。ユーザーへの説明UI（「リンクがコピーされました」等のトースト通知）が重要です。

```mermaid
flowchart LR
    Share["共有ボタン押下"]
    LINE["LINE\nwindow.open\nline.me/..."]
    WA["WhatsApp\nwindow.open\nwa.me/..."]
    MSN["Messenger\nwindow.open\nfb-messenger://share"]
    IG["Instagram\n① クリップボードにコピー\n② instagram.com を開く"]

    Share --> LINE
    Share --> WA
    Share --> MSN
    Share --> IG
```

---

## 7. メンバーリスト & リアクションモーダル

### 7.1 メンバーリストの差分フェッチ

`handleShowMembers()` はすでに取得済みのメンバー情報を再取得せず、**不足しているUIDのみをFirestoreから取得**します（差分フェッチ）。

```mermaid
flowchart TD
    Start["handleShowMembers() 呼び出し"]
    OpenModal["メンバーモーダルを開く"]
    GetKnown["既知の membersList から UID セットを取得"]
    GetAll["groupData.members（全メンバーUID）を取得"]
    CalcMissing["不足UID = 全メンバーUID - 既知UID"]
    Check{"不足UIDが存在する?"}
    FetchAll["Promise.all(\n  missingUids.map(uid => getDoc(...))\n)"]
    Merge["取得結果を membersList に追加"]
    Done["モーダルに最新リストを表示"]

    Start --> OpenModal
    OpenModal --> GetKnown
    GetKnown --> GetAll
    GetAll --> CalcMissing
    CalcMissing --> Check
    Check -->|"いいえ"| Done
    Check -->|"はい"| FetchAll
    FetchAll --> Merge
    Merge --> Done
```

```typescript
// 差分フェッチの概念コード
async function handleShowMembers() {
  setShowMembersModal(true);

  const knownUids = new Set(membersList.map(m => m.id));
  const allUids: string[] = groupData.members;

  const missingUids = allUids.filter(uid => !knownUids.has(uid));

  if (missingUids.length > 0) {
    // 不足分のみ並列取得
    const fetchedDocs = await Promise.all(
      missingUids.map(uid => getDoc(doc(db, 'users', uid)))
    );
    const newMembers = fetchedDocs
      .filter(d => d.exists())
      .map(d => ({ id: d.id, ...d.data() }));

    // 既存リストに追加
    appendToMembersList(newMembers);
  }
}
```

> [!TIP]
> `Promise.all` による並列フェッチにより、メンバー数が多い場合でも各ドキュメント取得を直列に待たずに済みます。ただし、一度に多数のドキュメントを取得する場合はFirestoreの読み取りコストに注意してください。

### 7.2 リアクション平坦化ロジック

`handleShowReactions(reactions, previews)` は `Record<emoji, uid[]>` 形式のネストされたデータを、モーダル表示に適した平坦な配列に変換します。

```typescript
// リアクション平坦化の概念コード
type ReactionPreview = { uid: string; nickname: string; photoURL: string | null };

type ReactionItem = {
  emoji: string;
  userId: string;
  nickname: string;
};

function handleShowReactions(
  reactions: Record<string, string[]>,
  previews?: Record<string, ReactionPreview[]>
): ReactionItem[] {
  const items: ReactionItem[] = [];

  Object.entries(reactions).forEach(([emoji, uids]) => {
    if (!Array.isArray(uids)) return;
    uids.forEach(uid => {
      // previews 内の uid を検索してニックネームを特定
      const preview = previews?.[emoji]?.find((p: ReactionPreview) => p.uid === uid);
      
      // ニックネームの解決優先順位:
      // 1. membersMap（最新のメンバーデータ）
      // 2. preview（FCM経由で送られてきた一時プレビュー）
      // 3. 'Unknown'（フォールバック）
      const nickname = membersMap[uid]?.nickname || preview?.nickname || 'Unknown';

      items.push({
        userId: uid,
        emoji,
        nickname
      });
    });
  });

  return items;
}
```

**変換例：**

```
// 入力
reactions = { "😊": ["uid1", "uid2"], "👍": ["uid2"] }
previews  = { "😊": ["田中", "鈴木"],  "👍": ["鈴木"] }

// 出力 (ReactionItem[])
[
  { emoji: "😊", uid: "uid1", nickname: "田中" },
  { emoji: "😊", uid: "uid2", nickname: "鈴木" },
  { emoji: "👍", uid: "uid2", nickname: "鈴木" },
]
```

### 7.3 非アクティブバナーの非表示設定

```typescript
// handleDismissInactivityBanner の動作
function handleDismissInactivityBanner() {
  // 1. Zustandストア (useChatStore) のフラグを更新（即時UI反映）
  setShowInactivityPolicyBanner(false);

  // 2. safeStorage に永続化（ページリロード後も維持）
  safeStorage.set('hasDismissedInactivityPolicy', 'true');
}
```

> [!NOTE]
> `safeStorage` は `localStorage` のラッパーで、プライベートブラウジング等でのエラーを安全に処理します。ストアとストレージの両方に書き込むことで、メモリ上の即時反映と永続化を両立しています。

---

## まとめ：設計上の重要な判断

| 設計上の選択 | 理由 |
|------------|------|
| 楽観的UI更新（全操作） | ネットワーク遅延に関わらず即時フィードバックを提供 |
| 仮ID (`temp-{timestamp}`) | サーバー応答前にメッセージをストアで管理可能にする |
| 翻訳の400msデバウンス | 連続タップ時のAPI呼び出し数を最小化 |
| バッチ翻訳 | 複数メッセージを1回のAPIリクエストにまとめコストを削減 |
| エールの`sv-SE`ロケール | ISO 8601日付（YYYY-MM-DD）を簡潔に生成するテクニック |
| 通報のFirestore直接書き込み | バックエンド実装コスト削減、セキュリティルールで制御 |
| `actionInProgress` ref ガード | 再レンダリングを発生させずに副作用を制御 |
| メンバーリストの差分フェッチ | 既取得データの再取得を避けFirestoreコストを最小化 |
