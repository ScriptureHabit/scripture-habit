# Scripture Habit Group Chat (`GroupChat`) Comprehensive Step-by-Step Construction Guide

This document is an exhaustive engineering and architecture guide for building the entire `src/components/groupchat` module from scratch.
It covers real-time Firestore synchronization, performance-optimized Context separation into 4 distinct contexts (Context Isolation Pattern), logic-component split using custom hooks, 100% Unity score fireworks & announcement API integration, modular UI subcomponents, and an 11-modal management system with full code examples.

---

## 1. Overall Architecture Overview

The `GroupChat` module is the core real-time group communication component of the Scripture Habit application.

```
                       ┌─────────────────────────┐
                       │   GroupChatProvider     │
                       └────────────┬────────────┘
                                    │
    ┌──────────────────┬────────────┴─────────────┬──────────────────┐
    ▼                  ▼                          ▼                  ▼
ChatDataContext   ChatMessageActionsContext   ChatGroupActionsContext   ChatUIActionsContext
(Data & State)   (Message Mutations)        (Group & Member Ops)      (UI & Scroll)
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
(Header & Unity Meter)  (Scroll & Message List)      (Reply Bar & Input Box)
```

### Key Capabilities
- **Real-time Messaging**: Instant delta subscription via Firestore `onSnapshot` with Zod schema validation (`GroupSchema`, `UserProfileBriefSchema`).
- **Scroll & Pagination Optimization**: Dynamic backward scrolling pagination with seamless scroll anchor retention using `useScrollManager`.
- **Unity Score & 100% Celebration Engine (`useUnityScore`)**: Dynamically calculates group completion percentage. Upon reaching 100%, triggers 3-second celebration fireworks (`canvas-confetti`), persists local daily flag, and sends a POST request to `/api/groups/announce-unity` with AppCheck & ID Token authentication. Handles midnight resets via `useUnityMidnightReset`.
- **Cheer & Reactions (`useCheerSystem`)**: Direct encouragement messages for unposted members and emoji reaction toggles.
- **On-Demand Translation & Gospel Links (`GospelLink`)**: Multilingual message translation via Gemini / Google Cloud Translate APIs and automated LDS Gospel Library verse detection & hyperlinking.
- **Group Management & Moderation**: Owner controls for group settings, invite codes, member management, and message reporting/deletion.

### 4-Tier Context Isolation Pattern
To avoid unnecessary re-renders across subcomponents when state changes, state and actions are partitioned into 4 specialized React Contexts.

The nesting order follows the unidirectional dependency chain: **Data Layer (`ChatDataContext`) ➔ Domain Mutations (`ChatMessageActionsContext` / `ChatGroupActionsContext`) ➔ UI Layer (`ChatUIActionsContext`)**.

---

## 2. Directory Taxonomy & File Responsibilities

```
src/components/groupchat/
├── group-chat.tsx                      # Main Entry Point (Wraps Content with Provider)
├── group-chat-provider.tsx             # Central Provider combining state engine & domain hooks
├── chat-context.ts                     # 4 Context definitions & React Custom Hook getters
├── chat-provider.tsx                  # Context.Provider hierarchy wrapper component
├── group-chat.css                      # Core layout and container styles
├── group-chat-modals.tsx              # Central modal switch router component
├── group-chat-modals.css              # Shared modal overlay and dialog styling
├── hooks/
│   ├── use-chat-context.ts            # Context retrieval helper
│   ├── core/                           # State & Sync Core Engine
│   │   ├── chat-reducer.ts            # Pure reducer state transitions
│   │   ├── use-chat-data-engine.ts    # Firestore real-time listener & Zod schema validation
│   │   ├── use-chat-sync-controller.ts# Data sync orchestration
│   │   ├── use-group-chat-state.ts    # Group state hook
│   │   └── use-group-messages.ts      # Message caching and fetch logic
│   ├── api/                            # API & Firestore Data Mutations
│   │   ├── use-group-actions.ts       # Leave, delete, and update group
│   │   ├── use-invite-manager.ts      # Invite code generation & clipboard copy
│   │   ├── use-message-actions.ts     # Send, edit, delete, translate messages
│   │   ├── use-report-system.ts       # Message/User reporting handler
│   │   └── use-user-profile.ts        # Member user profile fetcher
│   ├── interaction/                    # User Input & Gesture Handlers
│   │   ├── use-cheer-system.ts        # Send cheer / check cheer status
│   │   ├── use-group-chat-handlers.ts  # Event handler delegate
│   │   ├── use-message-input.ts       # Textarea auto-resize & keyboard handlers
│   │   └── use-message-interaction.ts # Context menu & touch/click handler
│   └── view/                           # Visual, Layout & UI State
│       ├── use-chat-visual-effects.ts # Visual effects & animations
│       ├── use-group-chat-ui.ts       # Active modal & UI state manager
│       ├── use-scroll-manager.ts      # Auto-scroll & scroll anchor calculation
│       ├── use-unity-details.ts       # Unity modal member classification
│       └── use-unity-score.ts         # Unity percentage calculation, 100% fireworks & /api/groups/announce-unity handler
├── subcomponents/                      # UI Component Parts
│   ├── chat-header.tsx                # Chat top header bar
│   ├── group-chat-footer.tsx          # Footer container with reply preview & input
│   ├── group-chat-message-list-container.tsx # Scroll container & load older trigger
│   ├── group-chat-message-list.tsx    # Message array renderer
│   ├── message-item.tsx               # Individual message bubble component
│   ├── message-item.css
│   ├── message-input.tsx              # Input form and send button
│   ├── message-input.css
│   ├── system-message.tsx             # System notice banner component
│   ├── system-message.css
│   ├── gospel-link.tsx                # Scripture verse link parser
│   ├── group-chat-context-menu.tsx    # Context menu (Edit/Delete/Translate/Report)
│   └── group-menu-item.tsx            # Header dropdown menu item
└── modals/                             # 11 Modal Dialog Components
    ├── unity-modal.tsx                # Unity score details dialog
    ├── members-modal.tsx              # Group members list dialog
    ├── invite-modal.tsx               # Group invitation dialog
    ├── edit-group-name-modal.tsx      # Group details edit dialog
    ├── report-modal.tsx               # Content report dialog
    ├── cheer-confirm-modal.tsx        # Cheer confirmation dialog
    ├── delete-group-modal.tsx         # Group deletion confirmation
    ├── delete-message-modal.tsx       # Message deletion confirmation
    ├── edit-message-modal.tsx         # Message editing dialog
    ├── leave-group-modal.tsx          # Leave group confirmation
    └── reactions-modal.tsx            # Emoji reaction details dialog
```

---

## 3. Step-by-Step Construction Phases (Phase 1 to Phase 7)

### Phase 1: Data Models & Context Architecture

```typescript
// Implementation of chat-context.ts
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

#### Context Provider Hierarchy Wrapper (`chat-provider.tsx`)

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

### Phase 2: Unity Score Engine & 100% Announcement Handler (`hooks/view/use-unity-score.ts`)

Calculates the daily reading percentage for group members. Upon hitting 100%, triggers fireworks confetti (`canvas-confetti`) and dispatches a unity announcement request to `/api/groups/announce-unity`.

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
      confetti({ particleCount: 50, origin: { x: 0.2, y: 0.8 } });
      safeStorage.set(storageKey, todayStr);

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

### Phase 3: Central Modal Switch Router (`group-chat-modals.tsx`)

Renders 11 distinct modal dialogs based on `ModalStore`'s `activeModal`.

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

### Phase 4: Main Component Assembly (`group-chat.tsx`)

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

## 4. Verification & Troubleshooting

1. **Real-time Delta Sync Verification**: Confirm instant message propagation across multiple devices via `onSnapshot`.
2. **100% Unity Announcement Verification**: Confirm that 100% unity score triggers fireworks animation and POSTs to `/api/groups/announce-unity` with valid tokens.
3. **Re-render Isolation Audit**: Use React DevTools Profiler to ensure message typing only triggers local input component re-renders.
