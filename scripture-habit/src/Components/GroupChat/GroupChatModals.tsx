import { FC } from 'react';
import UserProfileModal from '../UserProfileModal/UserProfileModal';
import { useChatData, useChatActions, useChatInteraction, useChatUI } from './ChatContext';

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
import './GroupChatModals.css';

const GroupChatModals: FC = () => {
    const { userData, groupData, unityPercentage, language, membersList } = useChatData();
    const { 
        t, handleLeaveGroup, handleDeleteGroup, handleUpdateGroupName, handleConfirmDeleteMessage,
        handleSaveEdit, handleCancelEdit, handleUserProfileClick, handleSendCheer, handleCheerClick,
        confirmReport, handleCopyInviteLink, handleRegenerateInviteCode,
        isLeaving, isDeleting, deleteConfirmationName, setDeleteConfirmationName,
        newGroupName, setNewGroupName, newGroupDescription, setNewGroupDescription,
        newTranslatedName, setNewTranslatedName, newTranslatedDesc, setNewTranslatedDesc,
        translatedGroupName, translatedGroupDesc, reactionsToShow, 
        setSelectedMember,
        reportReason, setReportReason, isSendingCheer, cheeredTodayUids,
        cheerTarget, setCheerTarget, selectedMember, setActiveModal,
        setShowDeleteMessageModal, setShowUnityModal, setShowInviteModal, setShowReportModal
    } = useChatActions();
    
    const { editingMessage, editText, setEditText, messageToDelete, setMessageToDelete } = useChatInteraction();
    const { 
        activeModal, showDeleteMessageModal, showUnityModal, 
        showReportModal, showInviteModal, unityModalData
    } = useChatUI();

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
                handleCancelEdit={handleCancelEdit}
                handleSaveEdit={async () => {
                    if (editingMessage) {
                        await handleSaveEdit(editingMessage, editText);
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
                    user={selectedMember}
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
