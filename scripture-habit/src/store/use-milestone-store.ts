import { create } from 'zustand';

export interface MilestoneData {
    days: number;
    nickname?: string;
    achievedDate?: string;
}

interface MilestoneState {
    milestoneData: MilestoneData | null;
    isOpen: boolean;
    openMilestone: (data: MilestoneData) => void;
    closeMilestone: () => void;
}

export const useMilestoneStore = create<MilestoneState>((set) => ({
    milestoneData: null,
    isOpen: false,
    openMilestone: (data: MilestoneData) => set({ milestoneData: data, isOpen: true }),
    closeMilestone: () => set({ isOpen: false, milestoneData: null })
}));
