import { create } from 'zustand';
import { Message, UserProfileBrief } from '../types/chat';

export interface ContextMenu {
  show: boolean;
  x: number;
  y: number;
  messageId: string | null;
  message?: Message | null;
  showBelow?: boolean;
}

interface ChatUIState {
  // Interaction
  replyTo: Message | null;
  setReplyTo: (msg: Message | null) => void;
  
  editingMessage: Message | null;
  setEditingMessage: (msg: Message | null) => void;
  
  editText: string;
  setEditText: (text: string) => void;
  
  contextMenu: ContextMenu;
  setContextMenu: (menu: ContextMenu) => void;
  
  messageToDelete: Message | null;
  setMessageToDelete: (msg: Message | null) => void;

  // Modals (Chat-specific)
  showDeleteMessageModal: boolean;
  setShowDeleteMessageModal: (show: boolean) => void;
  
  showUnityModal: boolean;
  setShowUnityModal: (show: boolean) => void;
  
  showInviteModal: boolean;
  setShowInviteModal: (show: boolean) => void;
  
  showReportModal: boolean;
  setShowReportModal: (show: boolean) => void;
  
  showInactivityPolicyBanner: boolean;
  setShowInactivityPolicyBanner: (show: boolean) => void;
  
  showAddNoteTooltip: boolean;
  setShowAddNoteTooltip: (show: boolean) => void;
  
  showMobileMenu: boolean;
  setShowMobileMenu: (show: boolean) => void;

  // Transient Data
  cheerTarget: UserProfileBrief | null;
  setCheerTarget: (target: UserProfileBrief | null) => void;
  
  reportReason: string;
  setReportReason: (reason: string) => void;

  selectedMember: UserProfileBrief | null;
  setSelectedMember: (member: UserProfileBrief | null) => void;

  // Refs (Stored as Mutable Refs in store if needed, or better just placeholders)
  textareaRef: any; 
  containerRef: any;
  contextMenuRef: any;

  closeContextMenu: () => void;
  resetChatUI: () => void;
}

const initialContextMenu: ContextMenu = { show: false, x: 0, y: 0, messageId: null, message: null, showBelow: false };

export const useChatStore = create<ChatUIState>((set) => ({
  replyTo: null,
  setReplyTo: (msg) => set({ replyTo: msg }),
  
  editingMessage: null,
  setEditingMessage: (msg) => set({ editingMessage: msg }),
  
  editText: '',
  setEditText: (text) => set({ editText: text }),
  
  contextMenu: initialContextMenu,
  setContextMenu: (menu) => set({ contextMenu: menu }),
  closeContextMenu: () => set({ contextMenu: initialContextMenu }),
  
  messageToDelete: null,
  setMessageToDelete: (msg) => set({ messageToDelete: msg }),

  showDeleteMessageModal: false,
  setShowDeleteMessageModal: (show) => set({ showDeleteMessageModal: show }),
  
  showUnityModal: false,
  setShowUnityModal: (show) => set({ showUnityModal: show }),
  
  showInviteModal: false,
  setShowInviteModal: (show) => set({ showInviteModal: show }),
  
  showReportModal: false,
  setShowReportModal: (show) => set({ showReportModal: show }),
  
  showInactivityPolicyBanner: false,
  setShowInactivityPolicyBanner: (show) => set({ showInactivityPolicyBanner: show }),
  
  showAddNoteTooltip: false,
  setShowAddNoteTooltip: (show) => set({ showAddNoteTooltip: show }),
  
  showMobileMenu: false,
  setShowMobileMenu: (show) => set({ showMobileMenu: show }),

  cheerTarget: null,
  setCheerTarget: (target) => set({ cheerTarget: target }),
  
  reportReason: '',
  setReportReason: (reason) => set({ reportReason: reason }),

  selectedMember: null,
  setSelectedMember: (member) => set({ selectedMember: member }),

  textareaRef: { current: null },
  containerRef: { current: null },
  contextMenuRef: { current: null },

  resetChatUI: () => set({
    replyTo: null,
    editingMessage: null,
    editText: '',
    contextMenu: initialContextMenu,
    messageToDelete: null,
    showDeleteMessageModal: false,
    showUnityModal: false,
    showInviteModal: false,
    showReportModal: false,
    showInactivityPolicyBanner: false,
    showAddNoteTooltip: false,
    showMobileMenu: false,
    cheerTarget: null,
    reportReason: '',
    selectedMember: null
  })
}));
