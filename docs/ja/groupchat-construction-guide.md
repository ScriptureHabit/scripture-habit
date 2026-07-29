# Scripture Habit グループチャット (GroupChat) ゼロから構築する完全ガイド

本ドキュメントは、`src/components/groupchat` モジュールをゼロから設計・構築するための包括的な開発ステップバイステップガイドです。
Firestore によるリアルタイム通信、パフォーマンスを考慮した4系統の Context 分割、カスタムフックによるロジック分離（Logic-Component Split）、モジュール化されたサブコンポーネントおよび11種類のモーダル管理システムの全容を説明します。

---

## 1. 全体アーキテクチャ概要

`GroupChat` モジュールは、Scripture Habit アプリにおけるグループ機能の核となるリアルタイムチャットコンポーネントです。

### 主な機能
- **リアルタイムメッセージング**: Firestore `onSnapshot` による差分受信と、快適なレスポンスを実現する楽観的UI更新（Optimistic Update）。
- **データ読み込み最適化**: 無限スクロール pagination（過去メッセージの動的ロード）と自動スクロール制御。
- **団結度 (Unity Score) システム**: グループメンバーの今日の聖書通読・投稿率を算出・可視化。
- **応援 (Cheer) / リアクション機能**: スタンプ・絵文字リアクション、および通読未完了メンバーへの応援送信。
- **自動翻訳 & 聖書リンク**: 多言語メッセージのオンデマンド翻訳、および聖書参照テキストの自動検出・リンク化。
- **グループ管理 & 通報・モデレーション**: オーナー権限によるグループ名変更、招待コード再発行、メンバー管理、不適切コンテンツの通報・削除。

### 設計思想: 4系統の Context 分割 (Context Isolation Pattern)
単一の巨大な Context は、いずれかの状態変更で全コンポーネントを再レンダリングさせてしまいます。これを防ぐため、コンテクストを目的別に4つに分離しています。

```
                       ┌─────────────────────────┐
                       │   GroupChatProvider     │
                       └────────────┬────────────┘
                                    │
    ┌──────────────────┬────────────┴─────────────┬──────────────────┐
    ▼                  ▼                          ▼                  ▼
ChatDataContext   ChatMessageActionsContext   ChatGroupActionsContext   ChatUIActionsContext
(状態データ)       (メッセージ操作)           (グループ・メンバー操作)   (UI・スクロール)
```

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

まず、チャット内で扱うデータ構造と Context を定義します。

#### 1. Context の定義 (`chat-context.ts`)
データを4つのインターフェースに分割し、`createContext` を行います。

```typescript
// chat-context.ts の基本構成
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
  // ...
}

export interface ChatMessageActionsContextType {
  handleSendMessage: (text: string, replyTo: Message | null) => Promise<boolean>;
  handleSaveEdit: (message: Message, text: string) => Promise<boolean>;
  handleConfirmDeleteMessage: (message: Message) => Promise<boolean>;
  handleToggleReaction: (msg: Message) => Promise<void>;
  handleTranslateMessage: (msg: Message, force?: boolean) => Promise<void>;
  // ...
}

export interface ChatGroupActionsContextType { ... }
export interface ChatUIActionsContextType { ... }

export const ChatDataContext = createContext<ChatDataContextType | undefined>(undefined);
export const ChatMessageActionsContext = createContext<ChatMessageActionsContextType | undefined>(undefined);
export const ChatGroupActionsContext = createContext<ChatGroupActionsContextType | undefined>(undefined);
export const ChatUIActionsContext = createContext<ChatUIActionsContextType | undefined>(undefined);
```

#### 2. Context Provider ラッパー (`chat-provider.tsx`)
4つの Context をネストさせて提供する階層ラッパーを実装します。

```tsx
export const ChatProvider: FC<ChatProviderProps> = ({
  dataValue,
  messageActionsValue,
  groupActionsValue,
  uiActionsValue,
  children
}) => (
  <ChatDataContext.Provider value={dataValue}>
    <ChatMessageActionsContext.Provider value={messageActionsValue}>
      <ChatGroupActionsContext.Provider value={groupActionsValue}>
        <ChatUIActionsContext.Provider value={uiActionsValue}>
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
チャットの状態（メッセージ配列、ロード状態、モーダル状態、コンテキストメニュー状態など）を一元管理する Reducer を定義します。

```typescript
export interface ChatState {
  messages: Message[];
  loading: boolean;
  membersLoading: boolean;
  groupData: GroupData | null;
  membersMap: MembersMap;
  membersList: UserProfileBrief[];
  // ...
}

export type ChatAction =
  | { type: 'SET_MESSAGES'; payload: Message[] }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'UPDATE_MESSAGE'; payload: Message }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ACTIVE_MODAL'; payload: ModalType };

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload, loading: false };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    // ...
    default:
      return state;
  }
}
```

#### 2. Firestore データエンジンの構築 (`hooks/core/use-chat-data-engine.ts`)
Firestore の `onSnapshot` を購読し、メッセージとグループ情報をリアルタイムで Dispatch します。過去ログのロード（pagination）ロジックもここに記述します。

---

### Phase 3: ドメイン固有カスタムフック群の実装

役割に応じてカスタムフックをカテゴリ別に作成します。

#### A. API 関連フック (`hooks/api/`)
- `use-message-actions.ts`: メッセージ送信・編集・削除、Firebase Firestore への書込み、および Gemini API / Google Cloud Translation を用いた文字翻訳。
- `use-group-actions.ts`: グループ名の変更、脱退処理、削除処理。
- `use-invite-manager.ts`: 招待コード生成とクリップボードコピー。
- `use-report-system.ts`: 通報モーダルの起動と通報データの保存。

#### B. インタラクション関連フック (`hooks/interaction/`)
- `use-message-input.ts`: テキストエリアの自動リサイズ（Auto-resize textarea）および Enter キー送信の制御。
- `use-cheer-system.ts`: 聖書を読んだ仲間や未投稿メンバーへの「応援」送信処理。
- `use-message-interaction.ts`: コンテキストメニュー（右クリック / 長押し）の表示位置と選択中メッセージの保持。

#### C. 表示・ビュー関連フック (`hooks/view/`)
- `use-scroll-manager.ts`: チャット最下部への自動スクロール、および過去ログ追加読み込み時のスクロール位置保持計算。
- `use-unity-score.ts`: 当日のグループ通読達成率（%）の動的計算。
- `use-group-chat-ui.ts`: ModalStore と連携した UI ダイアログ表示制御。

---

### Phase 4: UIサブコンポーネント群の構築

チャット画面の構成要素を切り出して構築します。

1. **`chat-header.tsx`**: グループ名、団結度インジケーター（Unity Meter）、メンバーボタン、ドロップダウンメニューを表示。
2. **`group-chat-message-list-container.tsx`**: スクロール検出用コンテナ。上部スクロールで過去メッセージをロード。
3. **`group-chat-message-list.tsx`**: メッセージ配列のマップレンダリング。
4. **`message-item.tsx`**: 自分のメッセージ（右寄せ）と他人のメッセージ（左寄せ）、送信時刻、リアクション、訳文を表示。
5. **`gospel-link.tsx`**: メッセージ内の聖書参照（例: 「1 Nephi 3:7」）を検知し、ハイパーリンク化。
6. **`group-chat-footer.tsx` & `message-input.tsx`**: 送信入力フォームおよび返信プレビューを表示。

---

### Phase 5: モーダルダイアログシステムの実装

11種類のモーダルダイアログを実装し、`group-chat-modals.tsx` で一元管理します。

```tsx
// group-chat-modals.tsx
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

### Phase 6: スタイリングとデザインシステム

CSS にてモダンなグラスモフィズム（Glassmorphic UI）、ダークモード対応、滑らかなアニメーションを設定します。

- `group-chat.css`: メインコンテナの Flexbox レイアウト、スクロールバーカスタム。
- `message-item.css`: 吹き出しのグラデーション背景、ホバー時のクイックリアクションバー。
- `group-chat-modals.css`: モーダルのバックドロップ（`backdrop-filter: blur(8px)`）およびアニメーション。

---

### Phase 7: メインコンポーネントの統合

最後に `group-chat-provider.tsx` と `group-chat.tsx` を組み立てます。

```tsx
// group-chat.tsx
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

### 検証項目
1. **Firestore リアルタイム受信**: 別端末またはブラウザタブからメッセージを投稿し、即座に画面へ反映されるか。
2. **スクロール位置の維持**: 上部にスクロールして過去ログを取得した際、スクロールジャンプが発生せず位置が固定されるか。
3. **Optimistic Update のフォールバック**: ネットワーク切断時に送信失敗アニメーションまたはリトライが表示されるか。
4. **Context レンダリング頻度**: `React.memo` や DevTools Profiler を使用し、メッセージ入力時にヘッダーやモーダルが無駄に再レンダリングされていないか。

---

## まとめ

このガイドの手順に従うことで、巨大で複雑な `GroupChat` コンポーネントを保守性が高くパフォーマンスに優れた構造でゼロから再構築することができます。
分離された Context とフックの構造を活かすことで、新機能の追加や単体テストの記述も容易になります。
