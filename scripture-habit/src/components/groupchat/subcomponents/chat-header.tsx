import { FC } from 'react';
import { UilArrowLeft, UilPen, UilCopy, UilCommentAlt, UilTrashAlt, UilTimes, UilUsersAlt, UilAnalysis } from '@iconscout/react-unicons';
import GroupMenuItem from './group-menu-item';
import { 
  useChatData, 
  useChatGroupActions, 
  useChatUIActions 
} from '../hooks/use-chat-context';
import { useChatStore } from '../../../store/use-chat-store';
import { useModalStore } from '../../../store/use-modal-store';
import { Group } from '../../../types/chat';

const ChatHeader: FC = () => {
  // 1. Data
  const { 
      groupData, unityPercentage, isOwner, language, groupId, userGroups,
      isRecapAvailable, isRecapLoading
  } = useChatData();

  // 2. Actions
  const { 
      togglePublicStatus, handleShowMembers, handleShowUnityModal,
      handleGenerateWeeklyRecap, handleCopyInviteLink,
      translatedGroupName, translatedGroupDesc
  } = useChatGroupActions();

  const { 
      t, onBack, onGroupSelect 
  } = useChatUIActions();

  // 3. Zustand UI State
  const { 
    showMobileMenu, setShowMobileMenu, setShowInviteModal 
  } = useChatStore();
  const { 
    setActiveModal, setNewGroupName, setNewGroupDescription,
    setNewTranslatedName, setNewTranslatedDesc 
  } = useModalStore();

  return (
    <>
      <div className="chat-header">
        <div className="header-left">
          {onBack && (
            <div className="back-button" onClick={onBack}>
              <UilArrowLeft size="24" />
            </div>
          )}
          <h2>
            <span className="group-name-text" title={groupData ? groupData.name : t('groupChat.groupName')}>
              {groupData ? (translatedGroupName || groupData.name) : t('groupChat.groupName')}
            </span>
            {isOwner && (
              <button
                className="edit-group-name-btn"
                onClick={() => {
                  setNewGroupName(groupData?.name || '');
                  setNewGroupDescription(groupData?.description || '');
                  setNewTranslatedName(translatedGroupName || groupData?.translations?.[language || 'en']?.name || '');
                  setNewTranslatedDesc(translatedGroupDesc || groupData?.translations?.[language || 'en']?.description || '');
                  setActiveModal('editName');
                }}
                title={t('groupChat.changeGroupName')}
                aria-label={t('groupChat.changeGroupName')}
              >
                <UilPen size="18" />
              </button>
            )}
            {groupData?.members && <span className="member-count-badge">({groupData.members.length})</span>}
            {groupData && (
              <div className="unity-score-container">
                <span className={`unity-score-badge ${unityPercentage === 100 ? 'celestial' : ''}`} onClick={handleShowUnityModal} title="Unity Score: members who posted notes today" data-testid="chat-header-unity">
                  <span className="unity-icon">{unityPercentage === 100 ? '☀️' : unityPercentage >= 66 ? '🌕' : unityPercentage >= 33 ? '🌠' : '🌑'}</span>
                  <span className="unity-percent-text">{unityPercentage}%</span>
                </span>
              </div>
            )}
          </h2>
        </div>
        {groupData && (
          <>
            <div className="header-right desktop-only">
              {isOwner && (
                <div className="group-status-toggle">
                  <span className="status-label">{groupData.isPublic ? t('groupChat.public') : t('groupChat.private')}</span>
                  <label className="switch">
                    <input type="checkbox" checked={groupData.isPublic || false} onChange={togglePublicStatus} aria-label={t('groupChat.public')} />
                    <span className="slider round"></span>
                  </label>
                </div>
              )}
              <div className="invite-code-wrapper">
                <div className="invite-code-display" onClick={() => setShowInviteModal(true)} title={t('groupChat.inviteLink')}>
                  <span>{t('groupChat.inviteLink')}</span>
                  <UilCopy size="16" className="copy-icon" />
                </div>
              </div>
              <div className="invite-code-display members-btn-desktop" onClick={handleShowMembers} title={t('groupChat.members')}>
                <UilCommentAlt size="16" className="copy-icon" />
                <span className="desktop-members-label">{t('groupChat.members')}</span>
              </div>
              {isOwner && (
                <div
                  className={`invite-code-display members-btn-desktop recap-btn-desktop ${(!isRecapAvailable || isRecapLoading) ? 'disabled' : ''}`}
                  onClick={() => isRecapAvailable && !isRecapLoading && handleGenerateWeeklyRecap()}
                  title={!isRecapAvailable ? t('groupChat.recapRateLimit') : t('groupChat.generateWeeklyRecap')}
                >
                  <span className="emoji-icon-large">📊</span>
                  {isRecapLoading && <div className="spinner-mini"></div>}
                </div>
              )}
              {isOwner ? (
                <div
                  className="invite-code-display members-btn-desktop danger-action-btn"
                  onClick={() => setActiveModal('delete')}
                  title={t('groupChat.deleteGroup')}
                >
                  <UilTrashAlt size="16" />
                </div>
              ) : (
                <div
                  className="invite-code-display members-btn-desktop danger-action-btn"
                  onClick={() => setActiveModal('leave')}
                  title={t('groupChat.leaveGroup')}
                >
                  <UilTrashAlt size="16" />
                </div>
              )}
            </div>
            <div className="hamburger-container mobile-only">
              {groupData?.members?.length === 1 && (
                <button 
                  className="invite-present-btn" 
                  onClick={() => setShowInviteModal(true)}
                  title={t('groupChat.inviteFriends')}
                >
                  <span className="gift-emoji">🎁</span>
                </button>
              )}
              <button className="hamburger-btn" onClick={() => setShowMobileMenu(!showMobileMenu)} aria-label="Menu">
                <span className={`hamburger-icon ${showMobileMenu ? 'open' : ''}`}><span></span><span></span><span></span></span>
              </button>
            </div>
          </>
        )}
      </div>

      {showMobileMenu && groupData && (
        <div className="mobile-menu-overlay" onClick={() => setShowMobileMenu(false)}>
          <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-menu-header">
              <h3>{translatedGroupName || groupData.name}</h3>
              <button className="close-menu-btn" onClick={() => setShowMobileMenu(false)} aria-label={t('common.close')}>
                <UilTimes size="24" />
              </button>
            </div>
            <div className="mobile-menu-content">
              {/* Invite Code Section */}
              <div className="mobile-menu-item-card invite-section-card" onClick={handleCopyInviteLink}>
                <div className="menu-item-icon-circle pink-bg">
                  <UilCopy size="22" />
                </div>
                <div className="menu-item-text-content">
                  <span className="menu-item-label-top">{t('groupChat.inviteCode')}</span>
                  <span className="invite-code-text">{groupData.inviteCode}</span>
                </div>
              </div>

              {/* Private Toggle */}
              {isOwner && (
                <div className="mobile-menu-item-row toggle-row" onClick={(e) => { e.stopPropagation(); togglePublicStatus(); }}>
                  <span className="menu-item-label">{t('groupChat.private')}</span>
                  <div className={`custom-toggle ${!groupData.isPublic ? 'active' : ''}`}>
                    <div className="toggle-handle"></div>
                  </div>
                </div>
              )}

              <div className="mobile-menu-divider-thin" />

              {/* Action Items */}
              {isOwner && (
                <div className="mobile-menu-item-action" onClick={() => {
                  setNewGroupName(groupData?.name || '');
                  setNewGroupDescription(groupData?.description || '');
                  setNewTranslatedName(translatedGroupName || groupData?.translations?.[language || 'en']?.name || '');
                  setNewTranslatedDesc(translatedGroupDesc || groupData?.translations?.[language || 'en']?.description || '');
                  setActiveModal('editName');
                  setShowMobileMenu(false);
                }}>
                  <div className="menu-item-icon-circle pink-bg">
                    <UilPen size="20" />
                  </div>
                  <span className="menu-item-label">{t('groupChat.editGroupInfo')}</span>
                </div>
              )}

              <div className="mobile-menu-item-action" onClick={handleShowMembers}>
                <div className="menu-item-icon-circle pink-bg">
                  <UilUsersAlt size="20" />
                </div>
                <span className="menu-item-label">{t('groupChat.members')}</span>
              </div>

              {isOwner && (
                <div className="mobile-menu-item-action" onClick={() => { if (isRecapAvailable && !isRecapLoading) { handleGenerateWeeklyRecap(); setShowMobileMenu(false); } }}>
                  <div className="menu-item-icon-circle pink-bg">
                    <UilAnalysis size="20" />
                  </div>
                  <span className="menu-item-label">{t('groupChat.generateWeeklyRecap')}</span>
                </div>
              )}

              <div className="mobile-menu-divider-thin" />

              {/* Danger Actions */}
              {isOwner ? (
                <div className="mobile-menu-item-action danger" onClick={() => { setActiveModal('delete'); setShowMobileMenu(false); }}>
                  <div className="menu-item-icon-circle danger-bg">
                    <UilTrashAlt size="20" />
                  </div>
                  <span className="menu-item-label">{t('groupChat.deleteGroup')}</span>
                </div>
              ) : (
                <div className="mobile-menu-item-action danger" onClick={() => { setActiveModal('leave'); setShowMobileMenu(false); }}>
                  <div className="menu-item-icon-circle danger-bg">
                    <UilTrashAlt size="20" />
                  </div>
                  <span className="menu-item-label">{t('groupChat.leaveGroup')}</span>
                </div>
              )}

              {/* My Groups Section */}
              {userGroups && userGroups.length > 0 && (
                <>
                  <div className="mobile-menu-divider-thick" />
                  <div className="mobile-menu-groups-section">
                    <h4 className="section-title">{t('groupChat.myGroups')}</h4>
                    <div className="mobile-groups-list">
                      {userGroups.map((g: Group) => (
                        <GroupMenuItem
                          key={g.id}
                          group={g}
                          currentGroupId={groupId}
                          language={language || 'en'}
                          onSelect={() => { if (onGroupSelect) onGroupSelect(g.id); setShowMobileMenu(false); }}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatHeader;

