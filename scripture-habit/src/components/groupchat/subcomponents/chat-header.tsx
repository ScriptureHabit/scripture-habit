import { useState, useEffect } from 'react';
import { UilArrowLeft, UilPen, UilCopy, UilCommentAlt, UilTrashAlt, UilTimes, UilUsersAlt } from '@iconscout/react-unicons';
import GroupMenuItem from './group-menu-item';
import { 
  useChatData, 
  useChatGroupActions, 
  useChatUIActions 
} from '../hooks/use-chat-context';
import { useChatStore } from '../../../store/use-chat-store';
import { useModalStore } from '../../../store/use-modal-store';
import { Group } from '../../../types/chat';
import { getUnityStatusEmoji } from '../../../utils/unity-utils';

const ChatHeader = () => {
  // 1. Data
  const { 
      groupData, unityPercentage, isOwner, language, groupId, userGroups, userData
  } = useChatData();

  const isFull = groupData ? (groupData.members?.length || 0) >= (groupData.maxMembers || 5) : false;

  // Onboarding back-to-dashboard guide state
  const isDemo = !!userData?.isAnonymousDemo;
  const step1Done = !!userData?.questCreatedGroup || (userData?.groupIds && userData?.groupIds.length > 0) || !!userData?.groupId;
  const step2Done = !isDemo && (!!userData?.questPostedNote || (userData?.totalNotes && userData?.totalNotes > 0));
  const isLegacyCompleted = !isDemo && !userData?.questCreatedGroup && !userData?.questPostedNote &&
    (userData?.totalNotes && userData?.totalNotes > 0) &&
    ((userData?.groupIds && userData?.groupIds.length > 0) || !!userData?.groupId);

  const shouldShowBackGuide = !userData?.hasCompletedOnboarding && !isLegacyCompleted && step1Done && !step2Done;
  const [showBackGuide, setShowBackGuide] = useState(false);

  useEffect(() => {
    if (!shouldShowBackGuide) return;

    const timer = setTimeout(() => {
      setShowBackGuide(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, [shouldShowBackGuide]);

  const isBackGuideActive = shouldShowBackGuide && showBackGuide;

  // 2. Actions
  const { 
      togglePublicStatus, handleShowMembers, handleShowUnityModal,
      handleCopyInviteLink,
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
      {isBackGuideActive && (
        <div 
          className="chat-spotlight-overlay" 
          onClick={onBack}
          data-testid="chat-header-spotlight-overlay"
        />
      )}
      <div className={`chat-header ${isBackGuideActive ? 'has-spotlight' : ''}`}>
        <div className="header-left">
          {onBack && (
            <div className={`back-button-container ${isBackGuideActive ? 'spotlight-active' : ''}`}>
              <div 
                className={`back-button ${isBackGuideActive ? 'onboarding-back-spotlight active-guide' : ''}`} 
                onClick={onBack}
                data-testid="chat-header-back-button"
                role="button"
                tabIndex={0}
              >
                <UilArrowLeft size="24" />
              </div>
              {isBackGuideActive && (
                <div 
                  className="chat-back-guide-tooltip"
                  onClick={onBack}
                  data-testid="chat-back-guide-tooltip"
                  role="button"
                  tabIndex={0}
                >
                  <div className="chat-back-guide-arrow" />
                  <div className="chat-back-guide-content">
                    <span className="chat-back-guide-badge">🌟</span>
                    <span className="chat-back-guide-text">{t('onboardingQuest.chatHeaderBackPrompt')}</span>
                  </div>
                </div>
              )}
            </div>
          )}
          <h2 data-testid="group-name-title">
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
            {!groupData?.isAiGroup && (
              <>
                {groupData?.members && <span className="member-count-badge">({groupData.members.length}/{groupData.maxMembers || 5})</span>}
                <div className="unity-score-container">
                  <span className={`unity-score-badge ${unityPercentage === 100 ? 'celestial' : ''}`} onClick={handleShowUnityModal} title="Unity Score: members who posted notes today" data-testid="chat-header-unity">
                    <span className="unity-icon">{getUnityStatusEmoji(unityPercentage)}</span>
                    <span className="unity-percent-text">{unityPercentage}%</span>
                  </span>
                </div>
              </>
            )}
          </h2>
        </div>
        {groupData && (
          <>
            <div className="header-right desktop-only">
              {isOwner && !groupData.isAiGroup && (
                <div className="group-status-toggle">
                  <span className="status-label">{groupData.isPublic ? t('groupChat.public') : t('groupChat.private')}</span>
                  <label className="switch">
                    <input type="checkbox" checked={groupData.isPublic || false} onChange={togglePublicStatus} aria-label={t('groupChat.public')} />
                    <span className="slider round"></span>
                  </label>
                </div>
              )}
              {!groupData.isAiGroup && (
                <div className="invite-code-wrapper">
                  <div
                    className={`invite-code-display ${isFull ? 'disabled' : ''}`}
                    onClick={() => {
                      if (!isFull) setShowInviteModal(true);
                    }}
                    title={isFull ? t('groupChat.groupFullTooltip') : t('groupChat.inviteLink')}
                  >
                    <span>{t('groupChat.inviteLink')}</span>
                    <UilCopy size="16" className="copy-icon" />
                  </div>
                  {isFull && (
                    <div className="group-capacity-warning">
                      {t('groupChat.maxMembersReachedMessage')}
                    </div>
                  )}
                </div>
              )}
              <div className="invite-code-display members-btn-desktop" onClick={handleShowMembers} title={t('groupChat.members')} data-testid="members-button">
                <UilCommentAlt size="16" className="copy-icon" />
                <span className="desktop-members-label">{t('groupChat.members')}</span>
              </div>

              <div
                className="invite-code-display members-btn-desktop danger-action-btn"
                onClick={() => setActiveModal('leave')}
                title={t('groupChat.leaveGroup')}
              >
                <UilTrashAlt size="16" />
                <span className="desktop-members-label">{t('groupChat.leaveGroup')}</span>
              </div>
            </div>
            <div className="hamburger-container mobile-only">
              {!groupData?.isAiGroup && groupData?.members?.length === 1 && (
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
              {!groupData.isAiGroup && (
                <div 
                  className={`mobile-menu-item-card invite-section-card ${isFull ? 'disabled' : ''}`}
                  onClick={isFull ? undefined : handleCopyInviteLink}
                  title={isFull ? t('groupChat.groupFullTooltip') : undefined}
                >
                  <div className="menu-item-icon-circle pink-bg">
                    <UilCopy size="22" />
                  </div>
                  <div className="menu-item-text-content">
                    <span className="menu-item-label-top">
                      {isFull ? t('groupChat.maxMembersReachedMessage') : t('groupChat.inviteCode')}
                    </span>
                    <span className="invite-code-text">{groupData.inviteCode}</span>
                  </div>
                </div>
              )}

              {/* Private Toggle */}
              {isOwner && !groupData.isAiGroup && (
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

              <div className="mobile-menu-divider-thin" />

              {/* Danger Actions */}
              <div className="mobile-menu-item-action danger" onClick={() => { setActiveModal('leave'); setShowMobileMenu(false); }}>
                <div className="menu-item-icon-circle danger-bg">
                  <UilTrashAlt size="20" />
                </div>
                <span className="menu-item-label">{t('groupChat.leaveGroup')}</span>
              </div>

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

