import {
    UilEstate,
    UilClipboardAlt,
    UilUsersAlt,
    UilUser,
} from "@iconscout/react-unicons";
import React from 'react';

// --- Sidebar Data ---

export type SidebarKey = 'dashboard' | 'myNotes' | 'profile' | 'myGroup';

export interface SidebarItem {
    id: SidebarKey;
    icon: React.ElementType;
    heading: string;
}

export const SidebarData: SidebarItem[] = [
    {
        id: 'dashboard',
        icon: UilEstate,
        heading: "Dashboard",
    },
    {
        id: 'myNotes',
        icon: UilClipboardAlt,
        heading: "My Notes",
    },
    {
        id: 'profile',
        icon: UilUser,
        heading: "Profile",
    },
    {
        id: 'myGroup',
        icon: UilUsersAlt,
        heading: "My Group",
    },
];

// --- Scripture Options ---

export type ScriptureValue = 
    | "Old Testament" 
    | "New Testament" 
    | "Book of Mormon" 
    | "Doctrine and Covenants" 
    | "Pearl of Great Price" 
    | "Ordinances and Proclamations" 
    | "General Conference" 
    | "BYU Speeches" 
    | "Other";

export interface ScriptureOption {
    value: ScriptureValue;
    label: string;
}

const SCRIPTURE_VALUES: ScriptureValue[] = [
    "Old Testament",
    "New Testament",
    "Book of Mormon",
    "Doctrine and Covenants",
    "Pearl of Great Price",
    "Ordinances and Proclamations",
    "General Conference",
    "BYU Speeches",
    "Other"
];

export const ScripturesOptions: ScriptureOption[] = SCRIPTURE_VALUES.map(value => ({
    value,
    label: value
}));
