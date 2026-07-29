# Scripture Habit グループチャット (`GroupChat`) ゼロから構築する完全ガイド

本ドキュメントは、`src/components/groupchat` モジュールをゼロから設計・構築するための包括的な開発ステップバイステップガイドです。
Firestore によるリアルタイム通信、パフォーマンスを考慮した 4 系統の Context 分割（Context Isolation Pattern）、カスタムフックによるロジック分離（Logic-Component Split）、モジュール化されたサブコンポーネントおよび 11 種類のモーダル管理システムの全容をコード付きで解説します。

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
- **リアルタイムメッセージング**: Firestore `onSnapshot` による差分受信と、快適なレスポンスを実現する楽観的UI更新（Optimistic Update）。
- **データ読み込み最適化**: 無限スクロール pagination（過去メッセージの動的ロード）とスクロール位置アンカー保持。
- **団結度 (Unity Score) システム**: グループメンバーの今日の聖書通読・投稿率を算出・可視化。
- **応援 (Cheer) / リアクション機能**: スタンプ・絵文字リアクション、および通読未完了メンバーへの応援送信。
- **自動翻訳 & 聖書リンク**: 多言語メッセージのオンデマンド翻訳、および聖書参照テキストの自動検出・リンク化（`GospelLink`）。
- **グループ管理 & 通報・モデレーション**: オーナー権限によるグループ名変更、招待コード再発行、メンバー管理、不適切コンテンツの通報・削除。

### 4系統の Context 分割設計 (Context Isolation Pattern)
単一の巨大な Context は、いずれかの状態変更で全コンポーネントを再レンダリングさせてしまいます。これを防ぐため、コンテクストを目的別に4つに分離しています。

ネストの順序は **データ基盤 (`ChatDataContext`) ➔ ドメイン操作 (`ChatMessageActionsContext` / `ChatGroupActionsContext`) ➔ UI表示 (`ChatUIActionsContext`)** の単方向依存関係に従います。

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
│   │   ├── use-chat-data-engine.ts    # Firestoreデータ受信・状態同期
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
│   │   └── use-message-interaction.ts # 右クリック/タップ操作ハンドラー
│   └── view/                           # 表示・アニメーション・UIロジック
│       ├── use-chat-visual-effects.ts # ビジュアルエフェクト
│       ├── use-group-chat-ui.ts       # アクティブモーダル・UI状態
│       ├── use-scroll-manager.ts      # スクロール位置保持・自動スクロール
│       ├── use-unity-details.ts       # 団結度モーダル用メンバーリスト分類
│       └── use-unity-score.ts         # 団結度 (Unity Score) 計算
├── subcomponents/                      # チャット画面のパーツUI
│   ├── chat-header.tsx                # チャットヘッダー
│   ├── group-chat-footer.tsx          # 入力エリアを含むフッター
│   ├── group-chat-message-list-container.tsx # スクロール領域コンテナ
│   ├── group-chat-message-list.tsx    # メッセージ一覧のレンダリング
│   ├── message-item.tsx               # 各メッセージ吹き出し
│   ├── message-item.css
│   ├── message-input.tsx              # テキスト入力・送信ボタン
│   ├── message-input.css
│   ├── system-message.tsx             # システム通知メッセージ
│   ├── system-message.css
│   ├── gospel-link.tsx                # 聖書リンクコンポーネント
│   ├── group-chat-context-menu.tsx    # コンテキストメニュー（編集/削除/翻訳等）
│   └── group-menu-item.tsx            # ドロップダウンメニュー項目
└── modals/                             # 各種ポップアップモーダル (11種類)
    ├── unity-modal.tsx                # 団結度詳細モーダル
    ├── members-modal.tsx              # メンバー一覧モーダル
    ├── invite-modal.tsx               # グループ招待モーダル
    ├── edit-group-name-modal.tsx      # グループ情報編集モーダル
    ├── report-modal.tsx               # 通報ダイアログ
    ├── cheer-confirm-modal.tsx        # 応援確認モーダル
    ├── delete-group-modal.tsx         # グループ削除確認
    ├── delete-message-modal.tsx       # メッセージ削除確認
    ├── edit-message-modal.tsx         # メッセージ編集ダイアログ
    ├── leave-group-modal.tsx          # グループ脱退確認
    └── reactions-modal.tsx            # リアクション送信者一覧モーダル
```

---

## 3. 段階別ビルドガイド (Phase 1 〜 Phase 7)

### Phase 1: データモデルと Context 設計

データの分割インターフェースと `createContext` を定義します。

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

### Phase 2: ステート管理エンジンと同期レイヤー

#### 1. Reducer の実装 (`hooks/core/chat-reducer.ts`)

```typescript
export interface ChatState {
  messages: Message[];
  loading: boolean;
  membersLoading: boolean;
  groupData: GroupData | null;
  membersMap: MembersMap;
  activeModal: ModalType;
}

export type ChatAction =
  | { type: 'SET_MESSAGES'; payload: Message[] }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'UPDATE_MESSAGE'; payload: Message }
  | { type: 'UPDATE_GROUP'; groupData: GroupData }
  | { type: 'UPDATE_MEMBERS'; newMembers: MembersMap };

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload, loading: false };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'UPDATE_GROUP':
      return { ...state, groupData: action.groupData };
    case 'UPDATE_MEMBERS':
      return { ...state, membersMap: { ...state.membersMap, ...action.newMembers } };
    default:
      return state;
  }
}
```

#### 2. Firestore リアルタイム同期エンジン (`hooks/core/use-chat-data-engine.ts`)

Firestore の `onSnapshot` を使い、グループメタデータ、メンバー一覧、メッセージをサブフックとして分離購読します。

```typescript
// メッセージ購読サブフック
const useGroupMessagesSync = (groupId: string | null, dispatch: Dispatch<ChatAction>) => {
  useEffect(() => {
    if (!groupId) return;
    const msgRef = collection(db, 'groups', groupId, 'messages');
    const q = query(msgRef, orderBy('createdAt', 'desc'), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages: Message[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Message)).reverse();

      dispatch({ type: 'SET_MESSAGES', payload: messages });
    });

    return unsubscribe;
  }, [groupId, dispatch]);
};
```

---

### Phase 3: ドメイン固有カスタムフック群の実装

#### メッセージ操作フック (`hooks/api/use-message-actions.ts`)

```typescript
export const useMessageActions = (groupId: string, userData: UserData) => {
  const handleSendMessage = async (text: string, replyTo: Message | null) => {
    if (!text.trim()) return false;

    const messageRef = collection(db, 'groups', groupId, 'messages');
    await addDoc(messageRef, {
      text,
      uid: userData.uid,
      displayName: userData.displayName,
      createdAt: serverTimestamp(),
      replyTo: replyTo ? { id: replyTo.id, text: replyTo.text } : null
    });
    return true;
  };

  return { handleSendMessage, /* handleSaveEdit, handleConfirmDeleteMessage, etc. */ };
};
```

#### スクロール位置制御フック (`hooks/view/use-scroll-manager.ts`)

```typescript
export const useScrollManager = (containerRef: RefObject<HTMLDivElement | null>) => {
  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  };

  const loadMoreOlderMessages = async (containerRef: RefObject<HTMLDivElement | null>, heightRef: RefObject<number>) => {
    if (!containerRef.current) return;
    // スクロール高さを記録し、ログ追加後に差分スクロールを適用してアンカーを維持
    heightRef.current = containerRef.current.scrollHeight;
    // ... 過去メッセージ取得 API 呼び出し
  };

  return { scrollToBottom, loadMoreOlderMessages };
};
```

---

### Phase 4: UIサブコンポーネント群の構築

#### 1. 聖書ディープリンク解析 (`subcomponents/gospel-link.tsx`)
メッセージ本文内の「モーサヤ 3:7」や「1 Nephi 3:7」などのテキストを正規表現で自動検知し、Gospel Library アプリおよび Web へのハイパーリンクへ変換します。

```tsx
export const GospelLink: FC<{ text: string }> = ({ text }) => {
  const parsedElements = parseScriptureReferences(text);
  return (
    <span>
      {parsedElements.map((el, i) => 
        el.isLink ? (
          <a key={i} href={el.url} target="_blank" rel="noopener noreferrer" className="gospel-link">
            {el.text}
          </a>
        ) : (
          el.text
        )
      )}
    </span>
  );
};
```

#### 2. メッセージ吹き出し (`subcomponents/message-item.tsx`)

自分の投稿（右寄せ・ブランド色）と他人の投稿（左寄せ・グラス背景）をレンダリングします。

---

### Phase 5: モーダルシステムの実装 (`group-chat-modals.tsx`)

`ModalStore` の `activeModal` に応じて 11 種類のモーダルを切り替える中央スイッチルーターです。

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

### Phase 6: スタイリングとデザインシステム (`group-chat.css`)

```css
/* グラスモフィズムチャットコンテナ */
.GroupChat {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: rgba(18, 18, 24, 0.85);
  backdrop-filter: blur(16px);
}

.message-item.self {
  align-self: flex-end;
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  border-radius: 18px 18px 4px 18px;
}

.message-item.peer {
  align-self: flex-start;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 18px 18px 18px 4px;
}
```

---

### Phase 7: メインコンポーネント統合 (`group-chat.tsx`)

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
2. **スクロール位置の維持**: 過去ログを取得した際に `scrollHeight` の差分を計算して画面の跳ね（Jump）を防いでいること。
3. **Context レンダリング頻度**: `React.memo` や DevTools Profiler で、テキスト入力時に画面全体が再描画されないことを確認。
