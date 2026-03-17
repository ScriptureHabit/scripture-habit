import { FC } from 'react';
import ReactMarkdown from 'react-markdown';
import Mascot from '../Mascot/Mascot';
import UserProfileModal from '../UserProfileModal/UserProfileModal';
import {
    UilTimes, UilCopy,
    UilExclamationTriangle, UilCommentAlt,
    UilWhatsapp, UilFacebookMessenger, UilInstagram
} from '@iconscout/react-unicons';
import { Group, Message, UserProfileBrief } from '../../types/chat';
import { UserData } from '../../types/user';

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
    handleShareLine: () => void;
    handleShareWhatsApp: () => void;
    handleShareMessenger: () => void;
    handleShareInstagram: () => void;
    handleRegenerateInviteCode: () => Promise<void>;
}

const GroupChatModals: FC<GroupChatModalsProps> = ({
    t,
    language,
    userData,
    groupData,

    // Leave Group Modal
    showLeaveModal,
    setShowLeaveModal,
    isLeaving,
    handleLeaveGroup,


    // Delete Group
    showDeleteModal,
    setShowDeleteModal,
    deleteConfirmationName,
    setDeleteConfirmationName,
    handleDeleteGroup,

    // Edit Group Name
    showEditNameModal,
    setShowEditNameModal,
    newGroupName,
    setNewGroupName,
    newGroupDescription,
    setNewGroupDescription,
    newTranslatedName,
    setNewTranslatedName,
    newTranslatedDesc,
    setNewTranslatedDesc,
    handleUpdateGroupName,
    translatedGroupName,
    translatedGroupDesc,

    // Delete Message
    showDeleteMessageModal,
    setShowDeleteMessageModal,
    messageToDelete,
    setMessageToDelete,
    handleConfirmDeleteMessage,

    // Edit Message
    editingMessage,
    editText,
    setEditText,
    handleCancelEdit,
    handleSaveEdit,

    // Reactions
    showReactionsModal,
    setShowReactionsModal,
    reactionsToShow,

    // Members
    showMembersModal,
    setShowMembersModal,
    membersList,
    membersLoading,
    setSelectedMember,

    // Unity
    showUnityModal,
    setShowUnityModal,
    unityPercentage,
    unityModalData,
    cheeredTodayUids,
    handleCheerClick,

    // Cheer Confirm
    cheerTarget,
    setCheerTarget,
    isSendingCheer,
    handleSendCheer,

    // Report User/Message
    showReportModal,
    setShowReportModal,
    reportReason,
    setReportReason,
    confirmReport,


    // User Profile
    selectedMember,
    handleUserProfileClick,

    // Invite Links
    showInviteModal,
    setShowInviteModal,
    handleCopyInviteLink,
    handleShareLine,
    handleShareWhatsApp,
    handleShareMessenger,
    handleShareInstagram,
    handleRegenerateInviteCode
}) => {
    return (
        <>
            {showLeaveModal && (
                <div className="leave-modal-overlay">
                    <div className="leave-modal-content">
                        <h3>{t('groupChat.leaveGroup')}?</h3>
                        <p>{t('groupChat.leaveConfirmMessage')}</p>
                        <div className="leave-modal-actions">
                            <button className="modal-btn cancel" onClick={() => setShowLeaveModal(false)} disabled={isLeaving}>{t('groupChat.cancel')}</button>
                            <button className="modal-btn leave" onClick={handleLeaveGroup} disabled={isLeaving}>
                                {isLeaving ? '...' : t('groupChat.confirmLeave')}
                            </button>
                        </div>
                    </div>
                </div>
            )}



            {showDeleteModal && (
                <div className="leave-modal-overlay">
                    <div className="leave-modal-content">
                        <h3 className="delete-modal-title">{t('groupChat.deleteGroup')}?</h3>
                        <p>{t('groupChat.deleteConfirmMessage')}</p>
                        <div style={{ marginBottom: '1rem' }}>
                            {groupData && (
                                <ReactMarkdown components={{ p: ({ children }) => <span>{children}</span> }}>
                                    {t('groupChat.typeToConfirm').replace('{groupName}', groupData.name)}
                                </ReactMarkdown>
                            )}
                        </div>
                        <input
                            type="text"
                            className="delete-confirmation-input"
                            value={deleteConfirmationName}
                            onChange={(e) => setDeleteConfirmationName(e.target.value)}
                            placeholder={t('groupChat.enterGroupNamePlaceholder')}
                        />
                        <div className="leave-modal-actions">
                            <button className="modal-btn cancel" onClick={() => { setShowDeleteModal(false); setDeleteConfirmationName(''); }}>{t('groupChat.cancel')}</button>
                            <button
                                className="modal-btn leave"
                                onClick={handleDeleteGroup}
                                disabled={deleteConfirmationName !== groupData?.name}
                            >
                                {t('groupChat.confirmDelete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showEditNameModal && (
                <div className="leave-modal-overlay">
                    <div className="leave-modal-content edit-group-modal">
                        <h3>{t('groupChat.changeGroupName')}</h3>

                        <div className="edit-group-field" style={{ width: '100%', textAlign: 'left', marginTop: '1rem' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--gray)', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>
                                {t('groupForm.groupNameLabel')}
                            </label>
                            <input
                                type="text"
                                className="delete-confirmation-input"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                placeholder={t('groupChat.enterNewGroupName')}
                                style={{ marginBottom: '1rem' }}
                            />
                        </div>

                        <div className="edit-group-field" style={{ width: '100%', textAlign: 'left' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--gray)', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>
                                {t('groupForm.descriptionLabel')}
                            </label>
                            <textarea
                                className="delete-confirmation-input"
                                value={newGroupDescription}
                                onChange={(e) => setNewGroupDescription(e.target.value)}
                                placeholder={t('groupForm.descriptionLabel')}
                                style={{ minHeight: '80px', resize: 'vertical', padding: '10px' }}
                            />
                        </div>

                        <div style={{ width: '100%', height: '1px', background: 'var(--gray)', opacity: 0.2, margin: '1rem 0' }}></div>
                        <h4 style={{ fontSize: '0.9rem', color: 'var(--gray)', margin: '0 0 10px 0' }}>
                            {t('languages.' + language) || language} {t('groupChat.translation') || 'Translation'}
                        </h4>

                        <div className="edit-group-field" style={{ width: '100%', textAlign: 'left' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--gray)', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>
                                {t('groupForm.groupNameLabel')} ({t('languages.' + language) || language})
                            </label>
                            <input
                                type="text"
                                className="delete-confirmation-input"
                                value={newTranslatedName}
                                onChange={(e) => setNewTranslatedName(e.target.value)}
                                placeholder={t('groupChat.enterNewGroupName') + ` (${language})`}
                                style={{ marginBottom: '1rem' }}
                            />
                        </div>

                        <div className="edit-group-field" style={{ width: '100%', textAlign: 'left' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--gray)', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>
                                {t('groupForm.descriptionLabel')} ({t('languages.' + language) || language})
                            </label>
                            <textarea
                                className="delete-confirmation-input"
                                value={newTranslatedDesc}
                                onChange={(e) => setNewTranslatedDesc(e.target.value)}
                                placeholder={t('groupForm.descriptionLabel') + ` (${language})`}
                                style={{ minHeight: '80px', resize: 'vertical', padding: '10px' }}
                            />
                        </div>

                        <div className="leave-modal-actions" style={{ marginTop: '1.5rem' }}>
                            <button className="modal-btn cancel" onClick={() => {
                                setShowEditNameModal(false);
                                setNewGroupName('');
                                setNewGroupDescription('');
                                setNewTranslatedName('');
                                setNewTranslatedDesc('');
                            }}>{t('groupChat.cancel')}</button>
                            <button
                                className="modal-btn primary"
                                onClick={handleUpdateGroupName}
                                disabled={
                                    !newGroupName.trim() ||
                                    (
                                        (newGroupName === groupData?.name) &&
                                        (newGroupDescription === (groupData?.description || '')) &&
                                        (newTranslatedName === (translatedGroupName || (language ? groupData?.translations?.[language]?.name : '') || '')) &&
                                        (newTranslatedDesc === (translatedGroupDesc || (language ? groupData?.translations?.[language]?.description : '') || ''))
                                    )
                                }
                            >
                                {t('groupChat.save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showDeleteMessageModal && (
                <div className="leave-modal-overlay">
                    <div className="leave-modal-content" style={{ maxWidth: '360px' }}>
                        <h3>{t('groupChat.deleteMessageConfirm')}</h3>
                        {(messageToDelete?.isNote || messageToDelete?.isEntry) && messageToDelete?.originalNoteId && (
                            <p style={{ color: '#ff9800', fontSize: '0.9rem', margin: '0.5rem 0' }}>
                                ⚠️ {t('groupChat.deleteMessageWarning')}
                            </p>
                        )}
                        <div className="leave-modal-actions">
                            <button className="modal-btn cancel" onClick={() => { setShowDeleteMessageModal(false); setMessageToDelete(null); }}>
                                {t('groupChat.cancel')}
                            </button>
                            <button className="modal-btn leave" onClick={handleConfirmDeleteMessage}>
                                {t('groupChat.deleteMessage')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editingMessage && (
                <div className="leave-modal-overlay">
                    <div className="leave-modal-content edit-message-modal">
                        <h3>{t('groupChat.editMessage')}</h3>
                        <textarea
                            className="edit-message-textarea"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            autoFocus
                        />
                        <div className="leave-modal-actions">
                            <button className="modal-btn cancel" onClick={handleCancelEdit}>
                                {t('groupChat.cancel')}
                            </button>
                            <button className="modal-btn leave" onClick={handleSaveEdit} style={{ background: 'var(--pink)' }}>
                                {t('groupChat.editMessage')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showReactionsModal && (
                <div className="leave-modal-overlay" onClick={() => setShowReactionsModal(false)}>
                    <div className="leave-modal-content reactions-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '300px' }}>
                        <h3>👍 Reactions</h3>
                        <div className="reactions-list">
                            {reactionsToShow.map((reaction, idx) => (
                                <div
                                    key={idx}
                                    className="reaction-user"
                                    onClick={() => {
                                        handleUserProfileClick(reaction.userId);
                                        setShowReactionsModal(false);
                                    }}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <span className="reaction-user-emoji">👍</span>
                                    <span className="reaction-user-name">{reaction.nickname}</span>
                                </div>
                            ))}
                        </div>
                        <div className="leave-modal-actions">
                            <button className="modal-btn cancel" onClick={() => setShowReactionsModal(false)}>
                                {t('groupChat.cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showMembersModal && (
                <div className="leave-modal-overlay" onClick={() => setShowMembersModal(false)}>
                    <div className="leave-modal-content members-modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3>{t('groupChat.groupMembers')} ({membersList.length})</h3>
                            <button className="close-menu-btn" onClick={() => setShowMembersModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                <UilTimes size="24" />
                            </button>
                        </div>

                        <div className="members-list-container" style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                            {membersLoading ? (
                                <p style={{ textAlign: 'center', padding: '1rem', color: 'var(--gray)' }}>Loading members...</p>
                            ) : (
                                membersList.map((member) => (
                                    <div
                                        key={member.id}
                                        className="member-item"
                                        onClick={() => setSelectedMember(member)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem', borderRadius: '8px', background: 'var(--glass)', cursor: 'pointer' }}
                                    >
                                        <div className="member-avatar" style={{
                                            width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #FF919D 0%, #fc6777 100%)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '1.2rem',
                                            overflow: 'hidden'
                                        }}>
                                            {member.photoURL ? (
                                                <img src={member.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                member.nickname ? member.nickname.substring(0, 1).toUpperCase() : '?'
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontWeight: '500', color: 'var(--black)' }}>
                                                {member.nickname || 'Unknown User'}
                                                {member.id === groupData?.ownerUserId && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', background: '#ffe0e3', color: 'var(--pink)', padding: '2px 6px', borderRadius: '4px' }}>Owner</span>}
                                                {member.id === userData?.uid && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', background: '#e0e0e0', color: 'var(--gray)', padding: '2px 6px', borderRadius: '4px' }}>You</span>}
                                            </span>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--gray)' }}>
                                                {(() => {
                                                    const lastActive = (groupData?.memberLastActive && member.id && groupData.memberLastActive[member.id]) || member.lastPostDate;
                                                    if (!lastActive) return t('groupChat.noActivity') || "No recent activity";

                                                    let dateObj;
                                                    if (lastActive.toDate) dateObj = lastActive.toDate();
                                                    else if (lastActive.seconds) dateObj = new Date(lastActive.seconds * 1000);
                                                    else dateObj = new Date(lastActive);

                                                    const now = new Date();
                                                    const diffDays = Math.floor((now.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24));

                                                    if (diffDays <= 0) return t('groupChat.activeToday') || "Active today";
                                                    if (diffDays === 1) return t('groupChat.activeYesterday') || "Active yesterday";
                                                    if (diffDays < 30) return (t('groupChat.activeDaysAgo') || "Active {days} days ago").replace('{days}', String(diffDays));
                                                    const diffMonths = Math.floor(diffDays / 30);
                                                    return (t('groupChat.activeMonthsAgo') || "Active > {months} months ago").replace('{months}', String(diffMonths));
                                                })()}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showUnityModal && (
                <div className="leave-modal-overlay" onClick={() => setShowUnityModal(false)}>
                    <div className="leave-modal-content unity-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '380px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '1.5rem' }}>
                        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <span style={{ fontSize: '1.8rem' }}>
                                {unityPercentage === 100 ? '☀️' :
                                    unityPercentage >= 66 ? '🌕' :
                                        unityPercentage >= 33 ? '🌠' :
                                            '🌑'}
                            </span>
                            <button className="close-menu-btn" onClick={() => setShowUnityModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray)' }}>
                                <UilTimes size="24" />
                            </button>
                        </div>

                        <div className="unity-modal-body" style={{ overflowY: 'auto', flex: 1, paddingRight: '5px' }}>
                            <p className="unity-description" style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--black)', textAlign: 'center', margin: '1rem 0', lineHeight: '1.4' }}>
                                {t('groupChat.unityModalDescription') || "Let's all aim for the Celestial Kingdom together!"}
                            </p>

                            <div className="unity-percentage-display" style={{ textAlign: 'center', margin: '1.5rem 0' }}>
                                <div style={{ fontSize: '3.5rem', fontWeight: '800', color: 'var(--pink)', lineHeight: '1' }}>{unityPercentage}%</div>
                                <div className="unity-progress-container" style={{ width: '100%', height: '14px', background: 'rgba(0,0,0,0.05)', borderRadius: '7px', overflow: 'hidden', marginTop: '12px' }}>
                                    <div className="unity-progress-bar" style={{ width: `${unityPercentage}%`, height: '100%', background: 'linear-gradient(90deg, #FF919D 0%, #fc6777 100%)', transition: 'width 1s cubic-bezier(0.34, 1.56, 0.64, 1)' }}></div>
                                </div>

                                <div className="unity-legend" style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(0,0,0,0.02)', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
                                    <h5 style={{ margin: '0 0 10px 0', fontSize: '0.8rem', color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>{t('groupChat.unityModalLegendTitle') || "Progress Guide"}</h5>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                                            <span style={{ fontSize: '1.1rem' }}>☀️</span>
                                            <span style={{ color: unityPercentage === 100 ? 'var(--pink)' : 'var(--black)', fontWeight: unityPercentage === 100 ? 'bold' : 'normal' }}>{t('groupChat.unityModalLegendCelestial') || "Celestial (100%)"}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                                            <span style={{ fontSize: '1.1rem' }}>🌕</span>
                                            <span style={{ color: (unityPercentage >= 66 && unityPercentage < 100) ? 'var(--pink)' : 'var(--black)', fontWeight: (unityPercentage >= 66 && unityPercentage < 100) ? 'bold' : 'normal' }}>{t('groupChat.unityModalLegendTerrestrial') || "Terrestrial (66%~)"}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                                            <span style={{ fontSize: '1.1rem' }}>🌠</span>
                                            <span style={{ color: (unityPercentage >= 33 && unityPercentage < 66) ? 'var(--pink)' : 'var(--black)', fontWeight: (unityPercentage >= 33 && unityPercentage < 66) ? 'bold' : 'normal' }}>{t('groupChat.unityModalLegendTelestial') || "Telestial (33%~)"}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                                            <span style={{ fontSize: '1.1rem' }}>🌑</span>
                                            <span style={{ color: unityPercentage < 33 ? 'var(--pink)' : 'var(--black)', fontWeight: unityPercentage < 33 ? 'bold' : 'normal' }}>{t('groupChat.unityModalLegendEmpty') || "Starting (0%~)"}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {membersLoading ? (
                                <div style={{ textAlign: 'center', padding: '2rem' }}>
                                    <div className="spinner-mini" style={{ margin: '0 auto', width: '30px', height: '30px', border: '3px solid rgba(255,145,157,0.3)', borderTopColor: 'var(--pink)' }}></div>
                                    <p style={{ marginTop: '10px', color: 'var(--gray)' }}>Loading members...</p>
                                </div>
                            ) : (
                                <div className="unity-lists" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    <div className="unity-list-section">
                                        <h4 style={{ color: '#27ae60', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 10px 0', fontSize: '1rem' }}>
                                            <span style={{ fontSize: '1.2rem' }}>✅</span> {t('groupChat.unityModalPosted') || "Members who posted notes"}
                                        </h4>
                                        <div className="unity-nicknames" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {unityModalData.posted.length > 0 ? (
                                                unityModalData.posted.map((member, i) => (
                                                    <span
                                                        key={i}
                                                        className="unity-nickname-chip"
                                                        onClick={() => handleUserProfileClick(member.id)}
                                                        style={{
                                                            background: '#e8f8f0',
                                                            color: '#27ae60',
                                                            padding: '6px 12px',
                                                            borderRadius: '20px',
                                                            fontSize: '0.9rem',
                                                            fontWeight: '500',
                                                            boxShadow: '0 2px 4px rgba(39, 174, 96, 0.1)',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        {member.nickname}
                                                    </span>
                                                ))
                                            ) : (
                                                <span style={{ fontStyle: 'italic', color: 'var(--gray)', fontSize: '0.9rem', padding: '5px 0' }}>{t('groupChat.unityModalNoPostsYet') || "No posts yet today"}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="unity-list-section">
                                        <h4 style={{ color: 'var(--pink)', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 10px 0', fontSize: '1rem' }}>
                                            {t('groupChat.unityModalNotPosted') || "Let's encourage those who haven't posted yet!"}
                                        </h4>
                                        <div className="unity-nicknames" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {unityModalData.notPosted.length > 0 ? (
                                                unityModalData.notPosted.map((member, i) => (
                                                    <span
                                                        key={i}
                                                        className={`unity-nickname-chip ${cheeredTodayUids.has(member.id) ? 'cheered' : ''}`}
                                                        onClick={() => {
                                                            if (member.id === userData?.uid) return;
                                                            if (cheeredTodayUids.has(member.id)) return;
                                                            handleCheerClick(member);
                                                        }}
                                                        style={{
                                                            background: member.id === userData?.uid ? '#f0f0f0' : (cheeredTodayUids.has(member.id) ? '#f5f5f5' : '#fff0f3'),
                                                            color: member.id === userData?.uid ? 'var(--gray)' : (cheeredTodayUids.has(member.id) ? '#bdc3c7' : 'var(--pink)'),
                                                            padding: '6px 12px',
                                                            borderRadius: '20px',
                                                            fontSize: '0.9rem',
                                                            fontWeight: '500',
                                                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                                                            cursor: (member.id === userData?.uid || cheeredTodayUids.has(member.id)) ? 'default' : 'pointer',
                                                            border: member.id === userData?.uid ? '1px dashed #ccc' : (cheeredTodayUids.has(member.id) ? '1px solid #eee' : 'none'),
                                                            opacity: cheeredTodayUids.has(member.id) ? 0.8 : 1
                                                        }}
                                                    >
                                                        {member.id === userData?.uid ? `${member.nickname} (${t('profile.you') || 'You'})` : (cheeredTodayUids.has(member.id) ? `✅ ${member.nickname}` : member.nickname)}
                                                    </span>
                                                ))
                                            ) : (
                                                <div style={{ background: '#fff9e6', color: '#B8860B', padding: '10px 15px', borderRadius: '12px', fontSize: '0.95rem', fontWeight: 'bold', width: '100%', textAlign: 'center', border: '1px solid #ffeeba' }}>
                                                    ✨ {t('groupChat.unityModalAllPosted') || 'Everyone has posted today! Amazing unity!'} ✨
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="leave-modal-actions" style={{ marginTop: '1.5rem' }}>
                            <button className="modal-btn primary" onClick={() => setShowUnityModal(false)} style={{ width: '100%', maxWidth: 'none' }}>
                                {t('groupChat.welcomeGuideButton') || t('welcomeGuideButton') || "Got it!"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {cheerTarget && (
                <div className="leave-modal-overlay cheer-modal-overlay" onClick={() => setCheerTarget(null)}>
                    <div className="leave-modal-content cheer-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '360px', padding: '2rem' }}>
                        <div style={{ marginBottom: '1rem', textAlign: 'center' }}></div>
                        <h3 style={{ textAlign: 'center', marginBottom: '1rem', color: 'var(--black)' }}>{t('groupChat.cheerConfirmTitle') || "Send a Cheer"}</h3>
                        <p style={{ textAlign: 'center', color: 'var(--gray)', marginBottom: '2rem', lineHeight: '1.4', fontSize: '1rem' }}>
                            {t('groupChat.cheerConfirmMessage')?.replace('{nickname}', cheerTarget.nickname || '') || `Would you like to send a cheer to ${cheerTarget.nickname || ''}?`}
                        </p>
                        <div className="leave-modal-actions" style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                            <button
                                className="modal-btn delete"
                                onClick={handleSendCheer}
                                disabled={isSendingCheer}
                                style={{
                                    background: 'var(--pink)',
                                    color: 'white',
                                    width: '100%',
                                    padding: '14px',
                                    borderRadius: '12px',
                                    fontWeight: '600',
                                    fontSize: '1.05rem',
                                    border: 'none',
                                    cursor: isSendingCheer ? 'not-allowed' : 'pointer',
                                    boxShadow: '0 4px 12px rgba(255, 145, 157, 0.3)'
                                }}
                            >
                                {isSendingCheer ? (
                                    <div className="spinner-mini" style={{ width: '20px', height: '20px', margin: '0 auto', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white' }}></div>
                                ) : (t('groupChat.cheerConfirmButton') || "Send Cheer")}
                            </button>
                            <button
                                className="modal-btn cancel"
                                onClick={() => setCheerTarget(null)}
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    borderRadius: '12px',
                                    border: '1px solid #ddd',
                                    background: 'white',
                                    color: 'var(--gray)',
                                    fontWeight: '500',
                                    cursor: 'pointer'
                                }}
                            >
                                {t('profile.cancel') || "Cancel"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showReportModal && (
                <div className="leave-modal-overlay report-modal-overlay" onClick={() => setShowReportModal(false)}>
                    <div className="leave-modal-content report-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <UilExclamationTriangle size="24" color="#E53E3E" />
                                {t('groupChat.reportUser')}
                            </h3>
                            <button className="close-menu-btn" onClick={() => setShowReportModal(false)}>
                                <UilTimes size="24" />
                            </button>
                        </div>

                        <div className="report-modal-body">
                            <p className="report-hint">{t('groupChat.reportReason')}:</p>

                            <div className="report-options">
                                <label className={`report-option-label ${reportReason === 'inappropriate' ? 'selected' : ''}`}>
                                    <input
                                        type="radio"
                                        name="reportReason"
                                        value="inappropriate"
                                        checked={reportReason === 'inappropriate'}
                                        onChange={(e) => setReportReason(e.target.value)}
                                    />
                                    <span>{t('groupChat.reportInappropriate')}</span>
                                </label>

                                <label className={`report-option-label ${reportReason === 'harassment' ? 'selected' : ''}`}>
                                    <input
                                        type="radio"
                                        name="reportReason"
                                        value="harassment"
                                        checked={reportReason === 'harassment'}
                                        onChange={(e) => setReportReason(e.target.value)}
                                    />
                                    <span>{t('groupChat.reportHarassment')}</span>
                                </label>

                                <label className={`report-option-label ${reportReason === 'spam' ? 'selected' : ''}`}>
                                    <input
                                        type="radio"
                                        name="reportReason"
                                        value="spam"
                                        checked={reportReason === 'spam'}
                                        onChange={(e) => setReportReason(e.target.value)}
                                    />
                                    <span>{t('groupChat.reportSpam')}</span>
                                </label>

                                <label className={`report-option-label ${reportReason === 'other' ? 'selected' : ''}`}>
                                    <input
                                        type="radio"
                                        name="reportReason"
                                        value="other"
                                        checked={reportReason === 'other'}
                                        onChange={(e) => setReportReason(e.target.value)}
                                    />
                                    <span>{t('groupChat.reportOther')}</span>
                                </label>
                            </div>

                            <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#FFF5F5', borderRadius: '8px', borderLeft: '4px solid #E53E3E' }}>
                                <h4 style={{ color: '#C53030', margin: '0 0 8px 0', fontSize: '0.95rem' }}>
                                    {t('groupChat.reportConfirmTitle') || "Confirm Report"}
                                </h4>
                                <p style={{ color: '#742A2A', fontSize: '0.85rem', margin: 0, lineHeight: '1.4' }}>
                                    {t('groupChat.reportConfirmMessage') || "Are you sure you want to report this message? This report will be sent directly to the Scripture Habit administrators."}
                                </p>
                            </div>
                        </div>

                        <div className="leave-modal-actions">
                            <button className="modal-btn cancel" onClick={() => setShowReportModal(false)}>
                                {t('groupChat.cancel')}
                            </button>
                            <button className="modal-btn leave report-submit" onClick={confirmReport}>
                                {t('groupChat.report')}
                            </button>
                        </div>
                    </div>
                </div>
            )}



            {selectedMember && (
                <UserProfileModal
                    user={selectedMember}
                    onClose={() => setSelectedMember(null)}
                />
            )}

            {showInviteModal && (
                <div className="leave-modal-overlay" onClick={() => setShowInviteModal(false)}>
                    <div className="leave-modal-content invite-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{t('groupChat.inviteLink')}</h3>
                            <button className="close-menu-btn" onClick={() => setShowInviteModal(false)}>
                                <UilTimes size="24" />
                            </button>
                        </div>
                        <div className="invite-modal-body">
                            <Mascot customMessage={t('groupChat.inviteFriendsPrompt')} userData={userData as any} />
                            <div className="invite-link-card" onClick={handleCopyInviteLink}>
                                <div className="invite-link-content">
                                    <span className="invite-link-url">{window.location.origin}/join/{groupData?.inviteCode}</span>
                                </div>
                                <div className="copy-badge">
                                    <UilCopy size="18" />
                                    <span>{t('groupChat.inviteLink')}</span>
                                </div>
                            </div>
                            
                            {groupData?.inviteCodeExpiresAt && (
                                <p className="invite-expiry-text" style={{ fontSize: '0.8rem', color: 'var(--gray)', marginTop: '0.8rem', textAlign: 'center', opacity: 0.8 }}>
                                    {t('groupChat.inviteExpiresAt') || 'Expires at'}: {(() => {
                                        const date = groupData.inviteCodeExpiresAt.toDate ? groupData.inviteCodeExpiresAt.toDate() : new Date(groupData.inviteCodeExpiresAt);
                                        return date.toLocaleString(language === 'ja' ? 'ja-JP' : 'en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        });
                                    })()}
                                </p>
                            )}

                            {userData?.uid === groupData?.ownerUserId && (
                                <button className="regenerate-invite-btn" onClick={handleRegenerateInviteCode} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    margin: '1.2rem auto 0', background: 'rgba(255, 255, 255, 0.1)', border: '1px solid var(--pink)',
                                    color: 'var(--pink)', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '0.85rem',
                                    fontWeight: '500', transition: 'all 0.2s'
                                }}>
                                    <span>🔄</span> {t('groupChat.regenerateInviteCode') || 'Regenerate'}
                                </button>
                            )}
                            <div className="share-buttons-grid">
                                <button className="share-btn line" onClick={handleShareLine}>
                                    <UilCommentAlt size="20" />
                                    <span>{t('groupChat.inviteLine')}</span>
                                </button>
                                <button className="share-btn whatsapp" onClick={handleShareWhatsApp}>
                                    <UilWhatsapp size="20" />
                                    <span>{t('groupChat.inviteWhatsApp')}</span>
                                </button>
                                <button className="share-btn messenger" onClick={handleShareMessenger}>
                                    <UilFacebookMessenger size="20" />
                                    <span>{t('groupChat.inviteMessenger')}</span>
                                </button>
                                <button className="share-btn instagram" onClick={handleShareInstagram}>
                                    <UilInstagram size="20" />
                                    <span>{t('groupChat.inviteInstagram')}</span>
                                </button>
                            </div>
                            <p className="invite-footer-hint">{t('groupChat.inviteLinkHint')}</p>
                        </div>
                    </div>
                </div>
            )}

        </>
    );
};

export default GroupChatModals;
