import { create } from 'zustand';
import { MilestoneData, useMilestoneStore } from './use-milestone-store';

export interface LevelUpData {
    level: number;
    days: number;
    nickname?: string;
    achievedDate?: string;
}

interface LevelUpState {
    levelUpData: LevelUpData | null;
    isOpen: boolean;
    pendingMilestone: MilestoneData | null;
    openLevelUp: (data: LevelUpData, pendingMilestone?: MilestoneData | null) => void;
    closeLevelUp: () => void;
}

export const useLevelUpStore = create<LevelUpState>((set, get) => ({
    levelUpData: null,
    isOpen: false,
    pendingMilestone: null,
    openLevelUp: (data: LevelUpData, pendingMilestone: MilestoneData | null = null) => 
        set({ levelUpData: data, isOpen: true, pendingMilestone }),
    closeLevelUp: () => {
        const { pendingMilestone } = get();
        set({ isOpen: false, levelUpData: null, pendingMilestone: null });
        // If there's a pending milestone that was queued, trigger it after level up modal closes
        if (pendingMilestone) {
            setTimeout(() => {
                useMilestoneStore.getState().openMilestone(pendingMilestone);
            }, 300);
        }
    }
}));
