import { create } from 'zustand';
import { Note } from '../types/note';

export type ActiveModal = 'leave' | 'delete' | 'members' | 'reactions' | 'editName' | 'newNote' | 'editNote' | null;

export interface ReactionItem {
  userId: string;
  emoji: string;
  nickname: string;
}

interface ModalState {
  activeModal: ActiveModal;
  setActiveModal: (modal: ActiveModal) => void;
  
  deleteConfirmationName: string;
  setDeleteConfirmationName: (name: string) => void;
  
  noteToEdit: Note | null;
  setNoteToEdit: (note: Note | null) => void;

  reactionsToShow: ReactionItem[];
  setReactionsToShow: (reactions: ReactionItem[]) => void;

  newGroupName: string;
  setNewGroupName: (name: string) => void;
  newGroupDescription: string;
  setNewGroupDescription: (desc: string) => void;
  newTranslatedName: string;
  setNewTranslatedName: (name: string) => void;
  newTranslatedDesc: string;
  setNewTranslatedDesc: (desc: string) => void;
  
  resetModalState: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  activeModal: null,
  setActiveModal: (modal) => set({ activeModal: modal }),
  
  deleteConfirmationName: '',
  setDeleteConfirmationName: (name) => set({ deleteConfirmationName: name }),
  
  noteToEdit: null,
  setNoteToEdit: (note) => set({ noteToEdit: note }),

  reactionsToShow: [],
  setReactionsToShow: (reactions) => set({ reactionsToShow: reactions }),

  newGroupName: '',
  setNewGroupName: (name) => set({ newGroupName: name }),
  newGroupDescription: '',
  setNewGroupDescription: (desc) => set({ newGroupDescription: desc }),
  newTranslatedName: '',
  setNewTranslatedName: (name) => set({ newTranslatedName: name }),
  newTranslatedDesc: '',
  setNewTranslatedDesc: (desc) => set({ newTranslatedDesc: desc }),

  resetModalState: () => set({
    activeModal: null,
    deleteConfirmationName: '',
    noteToEdit: null,
    reactionsToShow: [],
    newGroupName: '',
    newGroupDescription: '',
    newTranslatedName: '',
    newTranslatedDesc: ''
  })
}));
