/**
 * Shared Firestore Schema Definitions
 * These types represent the source of truth for documents stored in Firestore.
 * They are shared between the Backend (api_internal, Cloud Functions) and 
 * the Frontend (React hooks, context).
 */

// Basic nested types
export type FirestoreTimestamp = 
    | { seconds: number; nanoseconds: number } 
    | { toDate: () => Date } 
    | Date 
    | number 
    | string 
    | { _methodName?: string }; // Support for FieldValue sentinels in backend

export interface ReactionPreview {
    uid: string;
    nickname?: string;
    photoURL?: string | null;
}

export interface MemberPreview {
    uid: string;
    nickname?: string;
}

/**
 * Group Document Schema
 */
export interface GroupDocument {
    name?: string;
    description?: string;
    members?: string[];
    membersCount?: number;
    ownerUserId?: string;
    maxMembers?: number;
    isDeleted?: boolean;
    
    // Visibility & Invitations
    isPrivate?: boolean;
    isPublic?: boolean;
    inviteCode?: string;
    inviteCodeExpiresAt?: FirestoreTimestamp; // Represents Firestore Timestamp
    
    // Activity Tracking (denormalized)
    memberPreviews?: MemberPreview[];
    memberLastActive?: Record<string, FirestoreTimestamp>;
    memberLastReadAt?: Record<string, FirestoreTimestamp>;
    memberKickThresholds?: Record<string, number>;
    memberJoinedAt?: Record<string, FirestoreTimestamp>;
    
    // Stats & History
    lastMessageAt?: FirestoreTimestamp;
    lastMessageByNickname?: string;
    lastMessageByUid?: string;
    lastNoteAt?: FirestoreTimestamp | null;
    lastNoteByNickname?: string | null;
    lastNoteByUid?: string | null;
    messageCount?: number;
    noteCount?: number;
    lastRecapGeneratedAt?: FirestoreTimestamp;

    lastUnityAnnouncementDate?: string;

    dailyActivity?: {
        date: string; // YYYY-MM-DD
        activeMembers: string[]; // List of UIDs who posted/chatted today
    };
    unityPercentage?: number; // 0-100 percentage for sidebar display

    // Metadata
    createdAt?: FirestoreTimestamp;
    lastInactivityCheckedAt?: FirestoreTimestamp;
    
    // Localization
    timeZone?: string;
    translations?: Record<string, { name: string; description?: string }>;
}

/**
 * Group Member Document Schema (inside /groups/{groupId}/members)
 */
export interface GroupMemberDocument {
    uid: string;
    nickname?: string;
    photoURL?: string;
    lastReadAt?: FirestoreTimestamp;
    lastActiveAt?: FirestoreTimestamp;
    lastNoteAt?: FirestoreTimestamp;
    readMessageCount?: number;
    joinedAt?: FirestoreTimestamp;
    kickThreshold?: number;
}

/**
 * User Document Schema
 */
export interface UserDocument {
    uid?: string;
    nickname?: string;
    photoURL?: string;
    bio?: string;
    stake?: string;
    ward?: string;
    
    // Group Status
    groupId?: string;
    groupIds?: string[];
    kickThreshold?: number;
    hasSetKickThreshold?: boolean;
    
    // Activity & System
    lastInteractionAt?: FirestoreTimestamp;
    language?: string;
    timeZone?: string;
    totalNotes?: number; // Standardized from totalNotesCount to match active logic
    streakCount?: number;
    cheersReceived?: number;
    lastRecapGeneratedAt?: FirestoreTimestamp;

    // Study & Streak Tracking
    lastPostAt?: FirestoreTimestamp | null;
    streak?: unknown; // Legacy field
    daysStudiedCount?: number;
    lastPostDate?: string | null;
    highestStreak?: number;

    // Recap Metadata
    lastRecapPrompt?: string | null;
    lastRecapSummary?: string | null;
    lastRecapAudioURL?: string | null;
}

/**
 * Message Document Schema (inside /groups/{groupId}/messages)
 */
export interface MessageDocument {
    id?: string;
    text: string;
    senderId: string;
    senderNickname?: string;
    senderPhotoURL?: string | null;
    createdAt: FirestoreTimestamp;
    
    // Message Types
    isSystemMessage?: boolean;
    messageType?: string;
    type?: string; // Legacy/alt key for message type
    
    // Note Synchronization
    isNote?: boolean;
    isEntry?: boolean;
    scripture?: string;
    chapter?: string;
    comment?: string;
    originalNoteId?: string;
    
    // Metadata
    editedAt?: FirestoreTimestamp;
    isEdited?: boolean;
    replyTo?: {
        id: string;
        senderNickname: string;
        text: string;
        isNote: boolean;
    } | string | null;
    
    // Interaction
    reactions?: Record<string, string[]>;
    reactionPreviews?: Record<string, ReactionPreview[]>;
    translations?: Record<string, string>;
    messageData?: Record<string, string | number>; // Dynamic metadata for system messages
    optimisticId?: string;
}

/**
 * Personal Note Document Schema (inside /users/{uid}/notes)
 */
export interface PersonalNoteDocument {
    id?: string;
    text: string;
    createdAt: FirestoreTimestamp;
    scripture: string;
    chapter?: string | null;
    title?: string | null;
    speaker?: string | null;
    comment: string;
    shareOption: 'all' | 'current' | 'specific' | 'none';
    sharedWithGroups: string[];
    sharedMessageIds: Record<string, string>;
    searchTokens?: string[];
    isEdited?: boolean;
    editedAt?: FirestoreTimestamp;
}


