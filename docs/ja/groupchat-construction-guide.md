# Scripture Habit グループチャット (`GroupChat`) ゼロから構築する完全ガイド

本ドキュメントは、`src/components/groupchat` モジュールをゼロから設計・構築するための包括的な開発ステップバイステップガイドです。
Firestore によるリアルタイム通信、パフォーマンスを考慮した 4 系統の Context 分割（Context Isolation Pattern）、カスタムフックによるロジック分離（Logic-Component Split）、100% 達成時の祝賀花火 & 団結アナウンス API、モジュール化されたサブコンポーネントおよび 11 種類のモーダル管理システムの全容をコード付きで解説します。

---

## 1. 全体アーキテクチャ概要

`GroupChat` モジュールは、Scripture Habit アプリにおけるグループ機能の核となるリアルタイムチャットコンポーネントです。

```
                       ┌─────────────────────────┐
                       │   GroupChatProvider     │
                       └────────────┬────────────┘
                                    │
    ┌──────────────────┬────────────┴─────────────┬──────────────────┐
    ▼                  ▼                          ▼                  ▼
ChatDataContext   ChatMessageActionsContext   ChatGroupActionsContext   ChatUIActionsContext
(状態データ)       (メッセージ操作)           (グループ・メンバー操作)   (UI・スクロール)
    │                  │                          │                  │
    └──────────────────┴────────────┬─────────────┴──────────────────┘
                                    ▼
                         ┌───────────────────────┐
                         │   GroupChatContent    │
                         └──────────┬────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          ▼                         ▼                         ▼
    ChatHeader             MessageListContainer           GroupChatFooter
(ヘッダー・団結度メーター)  (スクロール・メッセージ一覧)  (返信表示・メッセージ入力)
```

### 主な機能
- **リアルタイムメッセージング**: Firestore `onSnapshot` による差分受信と、`GroupSchema` / `UserProfileBriefSchema` によるスキーマ検証。
- **データ読み込み最適化**: 無限スクロール pagination（過去メッセージの動的ロード）と `scrollHeight` 差分計算によるスクロール位置アンカー保持（`useScrollManager`）。
- **団結度 (Unity Score) ＆ 100% 祝賀システム (`useUnityScore`)**: グループメンバーの今日の通読達成率（%）を動的計算。100% 達成時に 3 秒間の紙吹雪花火（`canvas-confetti`）を起動し、`/api/groups/announce-unity` へ POST リクエスト（IDトークン ＆ AppCheck 検証付き）を送信。深夜0時の反転フック（`useUnityMidnightReset`）で自動リセット。
- **応援 (Cheer) / リアクション機能 (`useCheerSystem`)**: 未投稿メンバーへのダイレクト応援送信および絵文字リアクション。
- **自動翻訳 & 聖書ディープリンク (`GospelLink`)**: メッセージ本文内の聖句参照（例: モーサヤ 3:7, 1 Nephi 3:7）を正規表現で自動検知し、Gospel Library アプリ / Web へのディープリンクに変換。
- **グループ管理 & 通報・モデレーション**: オーナー権限によるグループ名変更、招待コード再発行、メンバー管理、不適切コンテンツの通報・削除。

ネストの順序は **データ基盤 (`ChatDataContext`) ➔ ドメイン操作 (`ChatMessageActionsContext` / `ChatGroupActionsContext`) ➔ UI表示 (`ChatUIActionsContext`)** の単方向依存関係に従います。

### コアフック階層とデータフロー構造 (Core Hooks Architecture)

`src/components/groupchat/hooks/core` 配下のカスタムフック群は、単方向に依存関係を分離し、責務に応じたオーケストレーションが行われています。

```
                     ┌─────────────────────────────────────────┐
                     │     useGroupMessages (司令塔フック)      │
                     └────────────────────┬────────────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  │ 1. 呼び出し                            │ 2. state & dispatch を渡す
                  ▼                                               ▼
┌──────────────────────────────────┐            ┌──────────────────────────────────┐
│        useChatDataEngine         │            │      useChatSyncController       │
│    (状態保持 ＆ リアルタイム同期)  │            │    (既読同期 ＆ 無限スクロール)   │
└────────────────┬─────────────────┘            └────────────────┬─────────────────┘
                 │                                               │
                 │ 3. Firestore受信時                            │ 3. 過去ログ取得時
                 │    dispatch(action)                           │    dispatch(action)
                 ▼                                               ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            chatReducer (状態更新の職人)                          │
└──────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          │ 4. 更新された state をまとめて返却
                                          ▼
                     ┌─────────────────────────────────────────┐
                     │   GroupChatProvider (Context) ➔ UIへ    │
                     └─────────────────────────────────────────┘
```

#### 各フックの役割と責務
1. **`useGroupMessages`（司令塔 / オーケストレーター）**:
   - `useChatDataEngine` と `useChatSyncController` を呼び出して連結し、メッセージ関連の全体状態と操作関数をまとめて `GroupChatProvider` へ供給します。
2. **`useChatDataEngine`（リアルタイム同期 ＆ 状態保管庫）**:
   - `useReducer(chatReducer, initialState)` を保持し、Firestore の `onSnapshot` によるリアルタイム通信を受信して `chatReducer` へ `dispatch` します。
3. **`useChatSyncController`（機能・制御コントローラー）**:
   - `useGroupMessages` から共有された `dispatch` 関数を利用し、単発クエリ（`getDocs`）による「過去ログの無限スクロール」や「既読カウントの同期（Read Status Sync）」の実行制御を行います。

---

## 2. ディレクトリ構造とファイル役割一覧

```
src/components/groupchat/
├── group-chat.tsx                      # エントリーポイント (ProviderとContentの結合)
├── group-chat-provider.tsx             # 状態管理エンジンおよび各フックを束ねるProvider
├── chat-context.ts                     # 4つのContext定義とReact Custom Hooks
├── chat-provider.tsx                  # Context.Provider 階層ラッパー
├── group-chat.css                      # メインチャット画面のスタイリング
├── group-chat-modals.tsx              # モーダルダイアログ一括管理コンポーネント
├── group-chat-modals.css              # モーダル共通スタイリング
├── hooks/
│   ├── use-chat-context.ts            # Context呼び出し用ヘルパー
│   ├── core/                           # 状態と同期のコアエンジン
│   │   ├── chat-reducer.ts            # Reducer状態更新ロジック
│   │   ├── use-chat-data-engine.ts    # Firestoreデータ受信・スキーマ検証同期
│   │   ├── use-chat-sync-controller.ts# データ同期のオーケストレーション
│   │   ├── use-group-chat-state.ts    # グループ固有ステート管理
│   │   └── use-group-messages.ts      # メッセージリスト取得・キャッシュ
│   ├── api/                            # API / Firestore 書き込み操作
│   │   ├── use-group-actions.ts       # グループ離脱・削除・名変更等
│   │   ├── use-invite-manager.ts      # 招待コードコピー・再発行
│   │   ├── use-message-actions.ts     # メッセージ送信・編集・削除・翻訳
│   │   ├── use-report-system.ts       # メッセージ/ユーザー通報
│   │   └── use-user-profile.ts        # ユーザープロフィール取得
│   ├── interaction/                    # ユーザー操作インタラクション
│   │   ├── use-cheer-system.ts        # 応援送信・既送信チェック
│   │   ├── use-group-chat-handlers.ts  # イベントハンドララッパー
│   │   ├── use-message-input.ts       # 入力フォーム状態管理
│   │   └── use-message-interaction.ts # 右クリック/長押しコンテキストメニューハンドラー
│   └── view/                           # 表示・アニメーション・UIロジック
│       ├── use-chat-visual-effects.ts # ビジュアルエフェクト
│       ├── use-group-chat-ui.ts       # アクティブモーダル・UI状態
│       ├── use-scroll-manager.ts      # スクロール位置保持・自動スクロール
│       ├── use-unity-details.ts       # 団結度モーダル用メンバー投稿状態分類
│       └── use-unity-score.ts         # 団結度計算・100%花火・/api/groups/announce-unity送信
├── subcomponents/                      # チャット画面のパーツUI
│   ├── chat-header.tsx                # チャットヘッダー・団結度メーター
│   ├── group-chat-footer.tsx          # 返信プレビューおよびメッセージ入力コンテナ
│   ├── group-chat-message-list-container.tsx # スクロール領域コンテナ
│   ├── group-chat-message-list.tsx    # メッセージ一覧のレンダリング
│   ├── message-item.tsx               # 各メッセージ吹き出し（自己/相手レイアウト）
│   ├── message-item.css
│   ├── message-input.tsx              # テキスト入力・自動リサイズ・送信ボタン
│   ├── message-input.css
│   ├── system-message.tsx             # システム通知メッセージ
│   ├── system-message.css
│   ├── gospel-link.tsx                # 聖書参照テキストの正規表現検出・ディープリンク化
│   ├── group-chat-context-menu.tsx    # コンテキストメニュー（編集/削除/翻訳/通報）
│   └── group-menu-item.tsx            # ドロップダウンメニュー項目
└── modals/                             # 各種ポップアップモーダル (11種類)
    ├── unity-modal.tsx                # 団結度詳細・メンバー投稿状態一覧モーダル
    ├── members-modal.tsx              # メンバー一覧モーダル
    ├── invite-modal.tsx               # グループ招待コード表示・コピーモーダル
    ├── edit-group-name-modal.tsx      # グループ情報編集モーダル
    ├── report-modal.tsx               # 不適切コンテンツ通報ダイアログ
    ├── cheer-confirm-modal.tsx        # 応援送信確認モーダル
    ├── delete-group-modal.tsx         # グループ削除確認
    ├── delete-message-modal.tsx       # メッセージ削除確認
    ├── edit-message-modal.tsx         # メッセージ編集ダイアログ
    ├── leave-group-modal.tsx          # グループ脱退確認
    └── reactions-modal.tsx            # 絵文字リアクション送信者一覧モーダル
```

---

## 3. 段階別ビルドガイド (Phase 1 〜 Phase 7)

### Phase 1: データモデルと Context 設計

```typescript
// chat-context.ts の実装
import { createContext, Dispatch, RefObject, useContext } from 'react';
import { Message, Group, MembersMap, UserProfileBrief, GroupData } from '../../types/chat';

export interface ChatDataContextType {
  groupId: string;
  userData: UserData;
  groupData: GroupData | null;
  messages: Message[];
  loading: boolean;
  membersLoading: boolean; 
  membersMap: MembersMap;
  membersList: UserProfileBrief[];
  unityPercentage: number;
  isOwner: boolean;
  language: string;
  userGroups: Group[];
}

export interface ChatMessageActionsContextType {
  handleSendMessage: (text: string, replyTo: Message | null) => Promise<boolean>;
  handleSaveEdit: (message: Message, text: string) => Promise<boolean>;
  handleConfirmDeleteMessage: (message: Message) => Promise<boolean>;
  handleToggleReaction: (msg: Message) => Promise<void>;
  handleTranslateMessage: (msg: Message, force?: boolean) => Promise<void>;
}

export interface ChatGroupActionsContextType {
  handleLeaveGroup: () => Promise<void>;
  handleDeleteGroup: (confirmation: string) => Promise<void>;
  handleUpdateGroupName: (name: string, desc: string) => Promise<boolean>;
}

export interface ChatUIActionsContextType {
  t: (key: string) => string;
  scrollToBottom: () => void;
  hasMoreOlder: boolean;
  isLoadingOlder: boolean;
  loadMoreOlderMessages: (...) => Promise<void>;
}

export const ChatDataContext = createContext<ChatDataContextType | undefined>(undefined);
export const ChatMessageActionsContext = createContext<ChatMessageActionsContextType | undefined>(undefined);
export const ChatGroupActionsContext = createContext<ChatGroupActionsContextType | undefined>(undefined);
export const ChatUIActionsContext = createContext<ChatUIActionsContextType | undefined>(undefined);
```

#### Context 階層ラッパー (`chat-provider.tsx`)

```tsx
export const ChatProvider: React.FC<{ 
  data: ChatDataContextType; 
  messageActions: ChatMessageActionsContextType;
  groupActions: ChatGroupActionsContextType;
  uiActions: ChatUIActionsContextType;
  children: ReactNode;
}> = ({ data, messageActions, groupActions, uiActions, children }) => (
  <ChatDataContext.Provider value={data}>
    <ChatMessageActionsContext.Provider value={messageActions}>
      <ChatGroupActionsContext.Provider value={groupActions}>
        <ChatUIActionsContext.Provider value={uiActions}>
          {children}
        </ChatUIActionsContext.Provider>
      </ChatGroupActionsContext.Provider>
    </ChatMessageActionsContext.Provider>
  </ChatDataContext.Provider>
);
```

---

### Phase 2: 団結度 (Unity Score) 計算 ＆ 祝賀アナウンス処理 (`hooks/view/use-unity-score.ts`)

グループの通読達成率が 100% に達した際、祝賀花火アニメーション（`canvas-confetti`）を一定時間起動し、`/api/groups/announce-unity` へ通知リクエストを送信します。

```typescript
export const useUnityScore = (
  groupId: string, userData: UserData, groupData: GroupData | null,
  messages: Message[], membersMap: MembersMap
): number => {
  const today = useToday();
  const unityPercentage = useMemo<number>(() => {
    if (!groupId || !groupData || groupData.id !== groupId || !today) return 0;
    return calculateUnityPercentage(groupData, messages, new Date(), membersMap);
  }, [messages, groupData, groupId, today, membersMap]);

  useUnityMidnightReset({ groupId, groupTimeZone: groupData?.timeZone || 'UTC' });

  useEffect(() => {
    if (!userData?.uid || !groupId || unityPercentage !== 100) return;
    const todayStr = new Date().toLocaleDateString('sv-SE');
    const storageKey = `unity_firework_${groupId}_${userData.uid}`;

    if (safeStorage.get(storageKey) !== todayStr) {
      // 3秒間の紙吹雪花火アニメーション
      confetti({ particleCount: 50, origin: { x: 0.2, y: 0.8 } });
      safeStorage.set(storageKey, todayStr);

      // /api/groups/announce-unity へアナウンスリクエスト送信
      fetch('/api/groups/announce-unity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ groupId })
      });
    }
  }, [unityPercentage, groupId, userData?.uid]);

  return unityPercentage;
};
```

---

### Phase 3: モーダル管理システム (`group-chat-modals.tsx`)

中央スイッチルーターで 11 種類のモーダルを切り替えます。

```tsx
export const GroupChatModals: FC = () => {
  const { activeModal } = useModalStore();

  switch (activeModal) {
    case 'unity': return <UnityModal />;
    case 'members': return <MembersModal />;
    case 'invite': return <InviteModal />;
    case 'editGroupName': return <EditGroupNameModal />;
    case 'report': return <ReportModal />;
    case 'cheerConfirm': return <CheerConfirmModal />;
    case 'deleteGroup': return <DeleteGroupModal />;
    case 'deleteMessage': return <DeleteMessageModal />;
    case 'editMessage': return <EditMessageModal />;
    case 'leaveGroup': return <LeaveGroupModal />;
    case 'reactions': return <ReactionsModal />;
    default: return null;
  }
};
```

---

### Phase 4: スクリプトディープリンク解析 (`subcomponents/gospel-link.tsx`)

メッセージ本文内の「モーサヤ 3:7」などの参照テキストを正規表現で解析し、Gospel Library アプリまたは Web へのリンクとして描画します。

---

### Phase 5: メインコンポーネント統合 (`group-chat.tsx`)

```tsx
const GroupChatContent: FC = () => {
  const { activeModal, setActiveModal } = useModalStore();

  return (
    <>
      <div className={`GroupChat ${activeModal === 'members' ? 'members-open' : ''}`}>
        <ChatHeader />
        <GroupChatMessageListContainer />
        <GroupChatFooter />
      </div>

      <GroupChatContextMenu />
      <GroupChatModals />

      {activeModal && (
        <div className="modal-backdrop-overlay" onClick={() => setActiveModal(null)} />
      )}
    </>
  );
};

const GroupChat: FC<GroupChatProps> = (props) => {
  useEffect(() => {
    if (props.isActive) {
      clearGroupNotifications(props.groupId);
    }
  }, [props.groupId, props.isActive]);

  return (
    <GroupChatProvider {...props} isActive={props.isActive ?? false}>
      <GroupChatContent />
    </GroupChatProvider>
  );
};

export default GroupChat;
```

---

## 4. 動作検証とトラブルシューティング

1. **リアルタイム受信の遅延なし検証**: 複数端末でメッセージが `onSnapshot` 経由で即座に描画されること。
2. **100% 達成時アナウンス**: 団結度が 100% に達した際、花火アニメーションが起動し `/api/groups/announce-unity` へ認証トークン付きで通信されること。
3. **Context レンダリング頻度**: `React.memo` や DevTools Profiler で、テキスト入力時に画面全体が再描画されないことを確認。
