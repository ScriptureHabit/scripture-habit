import {
    UilEstate,
    UilClipboardAlt,
    UilUsersAlt,
    UilUser,
} from "@iconscout/react-unicons";
import React from 'react';

// --- Sidebar Data ---

type SidebarKey = 'dashboard' | 'myNotes' | 'profile' | 'myGroup';

export interface SidebarItem {
    id: SidebarKey;
    icon: React.ElementType;
    heading: string;
}

export const SidebarData: SidebarItem[] = [
    {
        id: 'dashboard',
        icon: UilEstate,
        heading: "dashboard",
    },
    {
        id: 'myNotes',
        icon: UilClipboardAlt,
        heading: "My Notes",
    },
    {
        id: 'profile',
        icon: UilUser,
        heading: "profile",
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

export const SCRIPTURE_TRANSLATION_MAP: Record<ScriptureValue, string> = {
    "Old Testament": "scriptures.oldTestament",
    "New Testament": "scriptures.newTestament",
    "Book of Mormon": "scriptures.bookOfMormon",
    "Doctrine and Covenants": "scriptures.doctrineAndCovenants",
    "Pearl of Great Price": "scriptures.pearlOfGreatPrice",
    "Ordinances and Proclamations": "scriptures.ordinancesAndProclamations",
    "General Conference": "scriptures.generalConference",
    "BYU Speeches": "scriptures.byuSpeeches",
    "Other": "scriptures.other"
};
