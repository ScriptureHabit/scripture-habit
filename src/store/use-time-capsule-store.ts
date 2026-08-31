import { create } from 'zustand';
import { TimeCapsule } from '../types/time-capsule';

interface TimeCapsuleState {
  // Creation Modal State
  isCreateOpen: boolean;
  targetDays: number;
  openCreateModal: (targetDays: number) => void;
  closeCreateModal: () => void;

  // Unlock / View Modal State
  isUnlockOpen: boolean;
  unlockedCapsule: TimeCapsule | null;
  openUnlockModal: (capsule: TimeCapsule) => void;
  closeUnlockModal: () => void;
}

export const useTimeCapsuleStore = create<TimeCapsuleState>((set) => ({
  isCreateOpen: false,
  targetDays: 10,
  openCreateModal: (targetDays: number) => set({ isCreateOpen: true, targetDays }),
  closeCreateModal: () => set({ isCreateOpen: false }),

  isUnlockOpen: false,
  unlockedCapsule: null,
  openUnlockModal: (capsule: TimeCapsule) => set({ isUnlockOpen: true, unlockedCapsule: capsule }),
  closeUnlockModal: () => set({ isUnlockOpen: false, unlockedCapsule: null })
}));
