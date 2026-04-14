import { FC } from 'react';
import UserProfileModal from '../userprofilemodal/user-profile-modal';
import { 
  useChatData, 
  useChatMessageActions, 
  useChatGroupActions, 
  useChatUIActions 
} from './chat-context';
import { useChatStore } from '../../store/useChatStore';
import { useModalStore } from '../../store/useModalStore';
import { UserProfile } from '../../types/chat';

// Sub-modal components
import LeaveGroupModal from './modals/leave-group-modal';
import DeleteGroupModal from './modals/delete-group-modal';
import EditGroupNameModal from './modals/edit-group-name-modal';
import DeleteMessageModal from './modals/delete-message-modal';
import EditMessageModal from './modals/edit-message-modal';
import ReactionsModal from './modals/reactions-modal';
import MembersModal from './modals/members-modal';
import UnityModal from './modals/unity-modal';
import CheerConfirmModal from './modals/cheer-confirm-modal';
import ReportModal from './modals/report-modal';
import InviteModal from './modals/invite-modal';
import './group-chat-modals.css';

const GroupChatModals: FC = () => {
    // 1. Data
    const { 
        userData, groupData, unityPercentage, language, 
        membersList, membersMap, unityModalData 
    } = useChatData();

    // 2. Actions
    const { 
        handleConfirmDeleteMessage, handleSaveEdit 
    } = useChatMessageActions();

    const { 
        handleLeaveGroup, handleDeleteGroup, handleUpdateGroupName, 
        handleCopyInviteLink, handleRegenerateInviteCode,
        handleUserProfileClick,
        translatedGroupName, translatedGroupDesc, isLeaving, isDeleting,
        isSendingCheer, cheeredTodayUids, confirmReport, handleSendCheer, handleCheerClick
    } = useChatGroupActions();

    const { t } = useChatUIActions();

    // 3. Zustand UI State (Chat Specific)
    const { 
        editingMessage, setEditingMessage, editText, setEditText, messageToDelete, setMessageToDelete,
        showDeleteMessageModal, setShowDeleteMessageModal, showUnityModal, setShowUnityModal,
        showReportModal, setShowReportModal, showInviteModal, setShowInviteModal,
        cheerTarget, setCheerTarget, reportReason, setReportReason,
        selectedMember, setSelectedMember 
    } = useChatStore();

    // 4. Zustand Modal State (Shared across App)
    const { 
        activeModal, setActiveModal, reactionsToShow,
        newGroupName, setNewGroupName, newGroupDescription, setNewGroupDescription,
        newTranslatedName, setNewTranslatedName, newTranslatedDesc, setNewTranslatedDesc,
        deleteConfirmationName, setDeleteConfirmationName
    } = useModalStore();

    return (
        <>
            <LeaveGroupModal
                t={t}
                showLeaveModal={activeModal === 'leave'}
                setShowLeaveModal={(show) => setActiveModal(show ? 'leave' : null)}
                isLeaving={isLeaving}
                handleLeaveGroup={handleLeaveGroup}
            />

            <DeleteGroupModal
                t={t}
                groupData={groupData}
                showDeleteModal={activeModal === 'delete'}
                setShowDeleteModal={(show) => setActiveModal(show ? 'delete' : null)}
                deleteConfirmationName={deleteConfirmationName}
                setDeleteConfirmationName={setDeleteConfirmationName}
                isDeleting={isDeleting}
                handleDeleteGroup={async () => {
                   await handleDeleteGroup(deleteConfirmationName);
                }}
            />

            <EditGroupNameModal
                t={t}
                language={language}
                groupData={groupData}
                showEditNameModal={activeModal === 'editName'}
                setShowEditNameModal={(show) => setActiveModal(show ? 'editName' : null)}
                newGroupName={newGroupName}
                setNewGroupName={setNewGroupName}
                newGroupDescription={newGroupDescription}
                setNewGroupDescription={setNewGroupDescription}
                newTranslatedName={newTranslatedName}
                setNewTranslatedName={setNewTranslatedName}
                newTranslatedDesc={newTranslatedDesc}
                setNewTranslatedDesc={setNewTranslatedDesc}
                handleUpdateGroupName={async () => {
                    const success = await handleUpdateGroupName(newGroupName, newGroupDescription, newTranslatedName, newTranslatedDesc);
                    if (success) setActiveModal(null);
                }}
                translatedGroupName={translatedGroupName}
                translatedGroupDesc={translatedGroupDesc}
            />

            <DeleteMessageModal
                t={t}
                showDeleteMessageModal={showDeleteMessageModal}
                setShowDeleteMessageModal={setShowDeleteMessageModal}
                messageToDelete={messageToDelete}
                setMessageToDelete={setMessageToDelete}
                handleConfirmDeleteMessage={async () => {
                    if (messageToDelete) {
                        await handleConfirmDeleteMessage(messageToDelete);
                        setShowDeleteMessageModal(false);
                    }
                }}
            />

            <EditMessageModal
                t={t}
                editingMessage={editingMessage}
                editText={editText}
                setEditText={setEditText}
                handleCancelEdit={() => { setEditingMessage(null); setEditText(''); }}
                handleSaveEdit={async () => {
                    if (editingMessage) {
                        const success = await handleSaveEdit(editingMessage, editText);
                        if (success) {
                            setEditingMessage(null);
                            setEditText('');
                        }
                    }
                }}
            />

            <ReactionsModal
                t={t}
                showReactionsModal={activeModal === 'reactions'}
                setShowReactionsModal={(show) => setActiveModal(show ? 'reactions' : null)}
                reactionsToShow={reactionsToShow}
                handleUserProfileClick={handleUserProfileClick}
            />

            <MembersModal
                t={t}
                userData={userData}
                groupData={groupData}
                showMembersModal={activeModal === 'members'}
                setShowMembersModal={(show) => setActiveModal(show ? 'members' : null)}
                membersList={membersList}
                membersMap={membersMap}
                membersLoading={false}
                setSelectedMember={setSelectedMember}
            />

            <UnityModal
                t={t}
                userData={userData}
                showUnityModal={showUnityModal}
                setShowUnityModal={setShowUnityModal}
                unityPercentage={unityPercentage}
                unityModalData={unityModalData} 
                cheeredTodayUids={cheeredTodayUids}
                handleCheerClick={handleCheerClick}
                handleUserProfileClick={handleUserProfileClick}
                membersLoading={false}
            />

            <CheerConfirmModal
                t={t}
                cheerTarget={cheerTarget}
                setCheerTarget={setCheerTarget} 
                isSendingCheer={isSendingCheer}
                handleSendCheer={async () => { await handleSendCheer(); }}
            />

            <ReportModal
                t={t}
                showReportModal={showReportModal}
                setShowReportModal={setShowReportModal}
                reportReason={reportReason}
                setReportReason={setReportReason}
                confirmReport={async () => { await confirmReport(); }}
            />

            {selectedMember && (
                <UserProfileModal
                    user={selectedMember as unknown as UserProfile}
                    onClose={() => setSelectedMember(null)}
                />
            )}

            <InviteModal
                t={t}
                language={language}
                userData={userData}
                groupData={groupData}
                showInviteModal={showInviteModal}
                setShowInviteModal={setShowInviteModal}
                handleCopyInviteLink={handleCopyInviteLink}
                handleRegenerateInviteCode={handleRegenerateInviteCode}
            />
        </>
    );
};

export default GroupChatModals;
