import { useState, useMemo } from 'react';
import './sidebar.css';
import { SidebarData } from '../../data/data';
import {
  UilUsersAlt,
  UilBookOpen,
  UilPlusCircle,
} from "@iconscout/react-unicons";
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../hooks/use-language';
import { useGroupTranslation } from '../../hooks/use-group-translation';
import { MAX_GROUPS_PER_USER } from '../../config';
import { Group } from '../../types/chat';

import { getUnityStatusEmoji } from '../../utils/unity-utils';
import { hasGroupUnread, hasAnyGroupUnread } from '../../utils/group-utils';

interface SidebarGroupItemProps {
  group: Group;
  language: string;
  isActive: boolean;
  onClick: () => void;
  getGroupStatusEmoji: (group: Group) => string;
  getUnityPercentage: (group: Group) => number;
  isModal?: boolean;
  hasUnread?: boolean;
}

const SidebarGroupItem = ({
  group,
  language,
  isActive,
  onClick,
  getGroupStatusEmoji,
  getUnityPercentage,
  isModal = false,
  hasUnread = false
}: SidebarGroupItemProps) => {
  const { displayName } = useGroupTranslation(group, language);

  if (isModal) {
    return (
      <div
        className={`modal-group-item ${isActive ? 'active-group' : ''}`}
        onClick={onClick}
        data-testid="sidebar-group-item"
      >
        <span className="status-emoji-sidebar">{getGroupStatusEmoji(group)}</span>
        <span className={`unity-percentage-sidebar ${getUnityPercentage(group) === 100 ? 'celestial' : ''}`} data-testid="sidebar-unity-percentage">
          {getUnityPercentage(group)}%
        </span>
        <span className="group-name-sidebar-modal">
          {displayName}
        </span>
        {hasUnread && <span className="group-unread-dot" title="Unread messages" data-testid="modal-group-unread-dot" />}
      </div>
    );
  }

  return (
    <div
      className={`menuItem ${isActive ? 'active' : ''}`}
      onClick={onClick}
      data-testid="sidebar-group-item"
      data-group-id={group.id}
      data-group-name={group.name}
    >
      <span className="status-emoji-sidebar">{getGroupStatusEmoji(group)}</span>
      <span className={`unity-percentage-sidebar ${getUnityPercentage(group) === 100 ? 'celestial' : ''}`} data-testid="sidebar-unity-percentage">
        {getUnityPercentage(group)}%
      </span>
      <span className="group-name-sidebar" data-testid="group-name-sidebar">{displayName}</span>
      {hasUnread && <span className="group-unread-dot" title="Unread messages" data-testid="sidebar-group-unread-dot" />}
    </div>
  );
};

interface SidebarProps {
  selected: number;
  setSelected: (val: number) => void;
  userGroups?: Group[];
  activeGroupId: string | null;
  setActiveGroupId: (id: string | null) => void;
  hideMobile?: boolean;
  currentUserId?: string | null;
}

const Sidebar = ({
  selected,
  setSelected,
  userGroups = [],
  activeGroupId,
  setActiveGroupId,
  hideMobile = false,
  currentUserId
}: SidebarProps) => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [showGroupModal, setShowGroupModal] = useState(false);

  const DashboardIcon = SidebarData[0].icon;
  const NotesIcon = SidebarData[1].icon;
  const ProfileIcon = SidebarData[2].icon;

  const hasAnyUnread = useMemo(() => {
    const isChatActive = selected === 2;
    return hasAnyGroupUnread(userGroups, currentUserId, activeGroupId, isChatActive);
  }, [userGroups, currentUserId, activeGroupId, selected]);

  const handleGroupClick = (groupId: string) => {
    setActiveGroupId(groupId);
    setSelected(2); // Switch to GroupChat view
    setShowGroupModal(false);
    navigate(`/${language}/dashboard?groupId=${encodeURIComponent(groupId)}`);
  };

  const getUnityPercentageLocal = (group: Group): number => {
    return group.unityPercentage ?? 0;
  };

  const getGroupStatusEmoji = (group: Group): string => {
    return getUnityStatusEmoji(getUnityPercentageLocal(group));
  };

  return (
    <>
      <div className={`Sidebar ${hideMobile ? 'hide-mobile' : ''}`}>
        <div className='logo'>
          Scripture Habit
        </div>
        <div className="menu">
          {/* Dashboard */}
          <div className={selected === 0 ? 'menuItem active' : 'menuItem'}
            onClick={() => {
              setSelected(0);
              navigate(`/${language}/dashboard`);
            }}
            data-testid="sidebar-dashboard"
          >
            <DashboardIcon />
            <span>{t('sidebar.dashboard')}</span>
          </div>

          {/* My Notes */}
          <div className={selected === 1 ? 'menuItem active' : 'menuItem'}
            onClick={() => {
              setSelected(1);
              navigate(`/${language}/dashboard?view=1`);
            }}
            data-testid="sidebar-notes"
          >
            <NotesIcon />
            <span>{t('sidebar.myNotes')}</span>
          </div>

          {/* Profile */}
          <div className={selected === 3 ? 'menuItem active' : 'menuItem'} 
            onClick={() => navigate(`/${language}/profile`)}
            data-testid="sidebar-profile"
          >
            <ProfileIcon />
            <span>{t('sidebar.profile')}</span>
          </div>

          {/* Desktop Groups Section */}
          <div className="groups-section desktop-groups">
            <div className="menu-header">
              {t('sidebar.myGroups')} <span>({userGroups.length}/{MAX_GROUPS_PER_USER})</span>
            </div>
            <div className="sidebar-group-list-container">
              {userGroups.map((group) => {
                const isViewingThisGroup = selected === 2 && activeGroupId === group.id;
                const isGroupUnread = hasGroupUnread(group, currentUserId, isViewingThisGroup);
                return (
                  <SidebarGroupItem
                    key={group.id}
                    group={group}
                    language={language}
                    isActive={isViewingThisGroup}
                    onClick={() => handleGroupClick(group.id)}
                    getGroupStatusEmoji={getGroupStatusEmoji}
                    getUnityPercentage={getUnityPercentageLocal}
                    hasUnread={isGroupUnread}
                  />
                );
              })}
            </div>

            {userGroups.length < MAX_GROUPS_PER_USER && (
              <div className="menuItem create-group-item" onClick={() => navigate(`/${language}/group-options`)} data-testid="sidebar-join-create-group">
                <UilPlusCircle />
                <span>{t('sidebar.joinCreateGroup')}</span>
              </div>
            )}
          </div>

          {/* Mobile Groups Trigger */}
          <div 
            className={`menuItem mobile-groups-trigger ${selected === 2 ? 'active' : ''}`}
            onClick={() => setShowGroupModal(true)}
            data-testid="sidebar-mobile-groups"
          >
            <UilUsersAlt />
            {hasAnyUnread && <span className="unread-dot" data-testid="mobile-unread-dot" />}
          </div>

          <div 
            className={selected === 4 ? 'menuItem active' : 'menuItem'} 
            onClick={() => {
              setSelected(4);
              navigate(`/${language}/dashboard?view=4`);
            }}
            data-testid="sidebar-story"
          >
            <UilBookOpen />
            <span>{t('sidebar.story')}</span>
          </div>
        </div>
      </div>

      {/* Mobile Group Selection Modal */}
      {showGroupModal && (
        <div className="group-modal-overlay" onClick={() => setShowGroupModal(false)}>
          <div className="group-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{t('sidebar.selectGroup')} <span>({userGroups.length}/4)</span></h3>
            <div className="modal-group-list">
              {userGroups.map((group) => {
                const isViewingThisGroup = selected === 2 && activeGroupId === group.id;
                const isGroupUnread = hasGroupUnread(group, currentUserId, isViewingThisGroup);
                return (
                  <SidebarGroupItem
                    key={group.id}
                    group={group}
                    language={language}
                    isActive={activeGroupId === group.id}
                    onClick={() => handleGroupClick(group.id)}
                    getGroupStatusEmoji={getGroupStatusEmoji}
                    getUnityPercentage={getUnityPercentageLocal}
                    isModal={true}
                    hasUnread={isGroupUnread}
                  />
                );
              })}
            </div>
            {userGroups.length < 4 && (
              <div className="modal-create-group" onClick={() => { navigate(`/${language}/group-options`); setShowGroupModal(false); }} data-testid="mobile-join-create-group">
                <UilPlusCircle />
                <span>{t('sidebar.joinCreateGroup')}</span>
              </div>
            )}
            <button className="close-modal-btn" onClick={() => setShowGroupModal(false)}>{t('sidebar.close')}</button>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
