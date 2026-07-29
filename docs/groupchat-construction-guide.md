# Scripture Habit Group Chat (`GroupChat`) Comprehensive Step-by-Step Construction Guide

This document is an exhaustive engineering and architecture guide for building the entire `src/components/groupchat` module from scratch.
It covers real-time Firestore synchronization, performance-optimized Context separation into 4 distinct contexts, logic-component split using custom hooks, modular UI subcomponents, and a 11-modal management system.

---

## 1. Overall Architecture Overview

The `GroupChat` module is the core real-time group communication component of the Scripture Habit application.

### Key Capabilities
- **Real-time Messaging**: Instant delta subscription via Firestore `onSnapshot` with Optimistic UI updates.
- **Scroll & Pagination Optimization**: Dynamic backward scrolling pagination with seamless scroll anchor retention.
- **Unity Score Engine**: Dynamic calculation and visualization of group daily scripture reading and posting completion rates.
- **Cheer & Reactions**: Direct emoji reactions and encouragement notifications for group members.
- **On-Demand Translation & Gospel Links**: Multilingual message translation via Gemini / Google Cloud Translate APIs and automated LDS Gospel Library verse detection & hyperlinking.
- **Group Management & Moderation**: Owner controls for group settings, invite codes, member management, and message reporting/deletion.

### Core Architectural Principle: 4-Tier Context Isolation Pattern
To avoid unnecessary re-renders across subcomponents when state changes, state and actions are partitioned into 4 specialized React Contexts:

```
                       ┌─────────────────────────┐
                       │   GroupChatProvider     │
                       └────────────┬────────────┘
                                    │
    ┌──────────────────┬────────────┴─────────────┬──────────────────┐
    ▼                  ▼                          ▼                  ▼
ChatDataContext   ChatMessageActionsContext   ChatGroupActionsContext   ChatUIActionsContext
(Data & State)   (Message Mutations)        (Group & Member Ops)      (UI & Scroll)
```

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
│   │   ├── use-chat-data-engine.ts    # Firestore real-time listener & pagination
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
│       └── use-unity-score.ts         # Unity percentage calculation logic
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

#### 1. Context Definitions (`chat-context.ts`)
Divide data into 4 distinct contexts to prevent unnecessary component re-renders:

```typescript
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

#### 2. Context Provider Hierarchy (`chat-provider.tsx`)

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

### Phase 2: State Engine & Firestore Sync Controller

1. **State Reducer (`hooks/core/chat-reducer.ts`)**: Pure state reducer for messages, modals, loading indicators, and active reply targets.
2. **Firestore Listener Engine (`hooks/core/use-chat-data-engine.ts`)**: `onSnapshot` subscription to Firestore collection `groups/{groupId}/messages` with query pagination and state dispatching.
3. **Group Chat Provider Wiring (`group-chat-provider.tsx`)**: Integrates state engine with domain hooks and provides data values to `ChatProvider`.

---

### Phase 3: Domain Custom Hooks Architecture

- **API Hooks (`hooks/api/`)**: `use-message-actions.ts`, `use-group-actions.ts`, `use-invite-manager.ts`, `use-report-system.ts`, `use-user-profile.ts`.
- **Interaction Hooks (`hooks/interaction/`)**: `use-message-input.ts`, `use-cheer-system.ts`, `use-message-interaction.ts`, `use-group-chat-handlers.ts`.
- **View Hooks (`hooks/view/`)**: `use-scroll-manager.ts`, `use-unity-score.ts`, `use-unity-details.ts`, `use-group-chat-ui.ts`, `use-chat-visual-effects.ts`.

---

### Phase 4: Component Layer & Subcomponents

1. `chat-header.tsx`: Header title, unity score badge, member count, and dropdown actions.
2. `group-chat-message-list-container.tsx`: Message scroll container with load older trigger.
3. `group-chat-message-list.tsx`: Message array renderer.
4. `message-item.tsx`: Message bubble rendering (Self vs Peer layout), avatar, reactions, and translated text.
5. `gospel-link.tsx`: Automatic regex parser for LDS Scripture verses.
6. `group-chat-footer.tsx` & `message-input.tsx`: Input box with auto-resize and send controls.

---

### Phase 5: Modal System

`group-chat-modals.tsx` acts as the central router rendering 11 modal dialogs based on `activeModal` state from `useModalStore`.

---

### Phase 6: Styling & Visual Design

Clean CSS architecture with glassmorphism, responsive breakpoints, dark mode support, and smooth backdrop blurs.

---

### Phase 7: Component Assembly & Verification

Assemble `group-chat.tsx` by wrapping `GroupChatContent` with `GroupChatProvider` and notification clearing logic.

---

## 4. Verification & Best Practices

1. **Firestore Sync Verification**: Verify real-time updates across multiple client instances.
2. **Scroll Anchor Stability**: Ensure scroll top retention when fetching older message pages.
3. **Re-render Optimization**: Use React DevTools Profiler to ensure message typing only triggers local input re-renders.
