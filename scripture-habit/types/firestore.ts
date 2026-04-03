/**
 * Shared Firestore Schema Definitions
 * These types represent the source of truth for documents stored in Firestore.
 * They are shared between the Backend (api_internal, Cloud Functions) and 
 * the Frontend (React hooks, context).
 */

// Basic nested types
export type FirestoreTimestamp = { seconds: number; nanoseconds: number } | { toDate: () => Date } | Date | number | string | any;

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
    lastNoteAt?: FirestoreTimestamp;
    lastNoteByNickname?: string;
    lastNoteByUid?: string;
    messageCount?: number;
    noteCount?: number;
    lastRecapGeneratedAt?: FirestoreTimestamp;

    lastUnityAnnouncementDate?: string;

    
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
    totalNotesCount?: number;
    streakCount?: number;
    lastRecapGeneratedAt?: FirestoreTimestamp;
}

/**
 * Message Document Schema (inside /groups/{groupId}/messages)
 */
export interface MessageDocument {
    id?: string;
    text: string;
    senderId: string;
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
    translations?: Record<string, string>;
    messageData?: Record<string, string | number>; // Dynamic metadata for system messages

}


