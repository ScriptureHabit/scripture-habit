import { FC } from 'react';
import UserProfileModal from '../UserProfileModal/UserProfileModal';
import { Group, Message, UserProfileBrief } from '../../types/chat';
import { UserData } from '../../types/user';

// Sub-modal components
import LeaveGroupModal from './Modals/LeaveGroupModal';
import DeleteGroupModal from './Modals/DeleteGroupModal';
import EditGroupNameModal from './Modals/EditGroupNameModal';
import DeleteMessageModal from './Modals/DeleteMessageModal';
import EditMessageModal from './Modals/EditMessageModal';
import ReactionsModal from './Modals/ReactionsModal';
import MembersModal from './Modals/MembersModal';
import UnityModal from './Modals/UnityModal';
import CheerConfirmModal from './Modals/CheerConfirmModal';
import ReportModal from './Modals/ReportModal';
import InviteModal from './Modals/InviteModal';

interface GroupChatModalsProps {
    t: (key: string, replacements?: any) => string;
    language: string | null;
    userData: UserData | null;
    groupData: Group | null;

    // Leave Group Modal
    showLeaveModal: boolean;
    setShowLeaveModal: (show: boolean) => void;
    isLeaving: boolean;
    handleLeaveGroup: () => Promise<void>;

    // Delete Group
    showDeleteModal: boolean;
    setShowDeleteModal: (show: boolean) => void;
    deleteConfirmationName: string;
    setDeleteConfirmationName: (name: string) => void;
    handleDeleteGroup: () => Promise<void>;

    // Edit Group Name
    showEditNameModal: boolean;
    setShowEditNameModal: (show: boolean) => void;
    newGroupName: string;
    setNewGroupName: (name: string) => void;
    newGroupDescription: string;
    setNewGroupDescription: (desc: string) => void;
    newTranslatedName: string;
    setNewTranslatedName: (name: string) => void;
    newTranslatedDesc: string;
    setNewTranslatedDesc: (desc: string) => void;
    handleUpdateGroupName: () => Promise<void>;
    translatedGroupName: string | null;
    translatedGroupDesc: string | null;

    // Delete Message
    showDeleteMessageModal: boolean;
    setShowDeleteMessageModal: (show: boolean) => void;
    messageToDelete: Message | null;
    setMessageToDelete: (msg: Message | null) => void;
    handleConfirmDeleteMessage: () => Promise<void>;

    // Edit Message
    editingMessage: Message | null;
    editText: string;
    setEditText: (text: string) => void;
    handleCancelEdit: () => void;
    handleSaveEdit: () => Promise<void>;

    // Reactions
    showReactionsModal: boolean;
    setShowReactionsModal: (show: boolean) => void;
    reactionsToShow: any[];

    // Members
    showMembersModal: boolean;
    setShowMembersModal: (show: boolean) => void;
    membersList: UserProfileBrief[];
    membersLoading: boolean;
    setSelectedMember: (member: UserProfileBrief | null) => void;

    // Unity
    showUnityModal: boolean;
    setShowUnityModal: (show: boolean) => void;
    unityPercentage: number;
    unityModalData: {
        posted: { id: string; nickname: string }[];
        notPosted: { id: string; nickname: string }[];
    };
    cheeredTodayUids: Set<string>;
    handleCheerClick: (member: UserProfileBrief) => void;

    // Cheer Confirm
    cheerTarget: UserProfileBrief | null;
    setCheerTarget: (target: UserProfileBrief | null) => void;
    isSendingCheer: boolean;
    handleSendCheer: () => Promise<void>;

    // Report User/Message
    showReportModal: boolean;
    setShowReportModal: (show: boolean) => void;
    reportReason: string;
    setReportReason: (reason: string) => void;
    confirmReport: () => Promise<void>;

    // User Profile
    selectedMember: UserProfileBrief | null;
    handleUserProfileClick: (userId: string | null) => Promise<void>;

    // Invite Links
    showInviteModal: boolean;
    setShowInviteModal: (show: boolean) => void;
    handleCopyInviteLink: () => void;
    handleRegenerateInviteCode: () => Promise<void>;
}

const GroupChatModals: FC<GroupChatModalsProps> = (props) => {
    return (
        <>
            <LeaveGroupModal
                t={props.t}
                showLeaveModal={props.showLeaveModal}
                setShowLeaveModal={props.setShowLeaveModal}
                isLeaving={props.isLeaving}
                handleLeaveGroup={props.handleLeaveGroup}
            />

            <DeleteGroupModal
                t={props.t}
                groupData={props.groupData}
                showDeleteModal={props.showDeleteModal}
                setShowDeleteModal={props.setShowDeleteModal}
                deleteConfirmationName={props.deleteConfirmationName}
                setDeleteConfirmationName={props.setDeleteConfirmationName}
                handleDeleteGroup={props.handleDeleteGroup}
            />

            <EditGroupNameModal
                t={props.t}
                language={props.language}
                groupData={props.groupData}
                showEditNameModal={props.showEditNameModal}
                setShowEditNameModal={props.setShowEditNameModal}
                newGroupName={props.newGroupName}
                setNewGroupName={props.setNewGroupName}
                newGroupDescription={props.newGroupDescription}
                setNewGroupDescription={props.setNewGroupDescription}
                newTranslatedName={props.newTranslatedName}
                setNewTranslatedName={props.setNewTranslatedName}
                newTranslatedDesc={props.newTranslatedDesc}
                setNewTranslatedDesc={props.setNewTranslatedDesc}
                handleUpdateGroupName={props.handleUpdateGroupName}
                translatedGroupName={props.translatedGroupName}
                translatedGroupDesc={props.translatedGroupDesc}
            />

            <DeleteMessageModal
                t={props.t}
                showDeleteMessageModal={props.showDeleteMessageModal}
                setShowDeleteMessageModal={props.setShowDeleteMessageModal}
                messageToDelete={props.messageToDelete}
                setMessageToDelete={props.setMessageToDelete}
                handleConfirmDeleteMessage={props.handleConfirmDeleteMessage}
            />

            <EditMessageModal
                t={props.t}
                editingMessage={props.editingMessage}
                editText={props.editText}
                setEditText={props.setEditText}
                handleCancelEdit={props.handleCancelEdit}
                handleSaveEdit={props.handleSaveEdit}
            />

            <ReactionsModal
                t={props.t}
                showReactionsModal={props.showReactionsModal}
                setShowReactionsModal={props.setShowReactionsModal}
                reactionsToShow={props.reactionsToShow}
                handleUserProfileClick={props.handleUserProfileClick}
            />

            <MembersModal
                t={props.t}
                userData={props.userData}
                groupData={props.groupData}
                showMembersModal={props.showMembersModal}
                setShowMembersModal={props.setShowMembersModal}
                membersList={props.membersList}
                membersLoading={props.membersLoading}
                setSelectedMember={props.setSelectedMember}
            />

            <UnityModal
                t={props.t}
                userData={props.userData}
                showUnityModal={props.showUnityModal}
                setShowUnityModal={props.setShowUnityModal}
                unityPercentage={props.unityPercentage}
                unityModalData={props.unityModalData}
                cheeredTodayUids={props.cheeredTodayUids}
                handleCheerClick={props.handleCheerClick}
                handleUserProfileClick={props.handleUserProfileClick}
                membersLoading={props.membersLoading}
            />

            <CheerConfirmModal
                t={props.t}
                cheerTarget={props.cheerTarget}
                setCheerTarget={props.setCheerTarget}
                isSendingCheer={props.isSendingCheer}
                handleSendCheer={props.handleSendCheer}
            />

            <ReportModal
                t={props.t}
                showReportModal={props.showReportModal}
                setShowReportModal={props.setShowReportModal}
                reportReason={props.reportReason}
                setReportReason={props.setReportReason}
                confirmReport={props.confirmReport}
            />

            {props.selectedMember && (
                <UserProfileModal
                    user={props.selectedMember}
                    onClose={() => props.setSelectedMember(null)}
                />
            )}

            <InviteModal
                t={props.t}
                language={props.language}
                userData={props.userData}
                groupData={props.groupData}
                showInviteModal={props.showInviteModal}
                setShowInviteModal={props.setShowInviteModal}
                handleCopyInviteLink={props.handleCopyInviteLink}
                handleRegenerateInviteCode={props.handleRegenerateInviteCode}
            />
        </>
    );
};

export default GroupChatModals;
