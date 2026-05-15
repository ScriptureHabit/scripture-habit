
import React, { useState, useEffect, useRef } from 'react';
import './sidebar.css';
import { SidebarData } from '../../data/data';
import {
  UilUsersAlt,
  UilBookOpen,
  UilPlusCircle,
} from "@iconscout/react-unicons";
import { useNavigate } from 'react-router-dom';
import { auth, appCheck } from '../../firebase';
// Removed unused Firestore imports
import { getToken } from "firebase/app-check";
import { useLanguage } from '../../hooks/use-language';
import { MAX_GROUPS_PER_USER } from '../../config';
import { Group } from '../../types/chat';

interface SidebarGroupItemProps {
  group: Group;
  language: string;
  isActive: boolean;
  onClick: () => void;
  getGroupStatusEmoji: (group: Group) => string;
  getUnityPercentage: (group: Group) => number;
  isModal?: boolean;
}

const SidebarGroupItem: React.FC<SidebarGroupItemProps> = ({ group, language, isActive, onClick, getGroupStatusEmoji, getUnityPercentage, isModal = false }) => {
  const [translatedName, setTranslatedName] = useState('');
  const translationAttemptedRef = useRef(false);

  // Debug log for Webkit unity percentage issue
  if (group.name?.includes('Persistence')) {
    console.log(`[SidebarGroupItem] Rendering ${group.name}: unity=${getUnityPercentage(group)}%, id=${group.id}`);
  }

  useEffect(() => {
    // 1. Check Firestore Data (Real-time sync makes this fast)
    if (group.translations && group.translations[language] && group.translations[language].name) {
      setTranslatedName(group.translations[language].name);
      return;
    }

    // 2. Skip translation if target is English (base language) or matches original
    if (language === 'en') {
      setTranslatedName(''); // Use group.name
      return;
    }

    // Check if we already attempted translation in this session
    if (translationAttemptedRef.current) return;

    const autoTranslate = async () => {
      if (!group.name || !language) return;

      const cacheKey = `trans_group_name_${group.id}_${language}`;
      const cached = sessionStorage.getItem(cacheKey);

      if (cached) {
        setTranslatedName(cached);
        translationAttemptedRef.current = true;
        return;
      }

      // Set ref immediately to prevent parallel duplicate calls
      translationAttemptedRef.current = true;

      try {
        const idToken = await auth?.currentUser?.getIdToken();
        if (!idToken) return;
        let appCheckToken = '';
        if (appCheck) {
          const appCheckTokenResponse = await getToken(appCheck, false);
          appCheckToken = appCheckTokenResponse.token;
        }
        const API_BASE = '';

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        };
        if (appCheckToken) {
          headers['X-Firebase-AppCheck'] = appCheckToken;
        }

        const res = await fetch(`${API_BASE}/api/ai/translate`, {
          method: 'POST',
          headers,

          body: JSON.stringify({
            text: group.name,
            targetLanguage: language,
            groupId: group.id,
            updateType: 'group_name'
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.translatedText) {
            setTranslatedName(data.translatedText);
            sessionStorage.setItem(cacheKey, data.translatedText);
          }
        } else {
          console.warn('Sidebar auto-translation returned error:', res.status);
        }
      } catch (err) {
        console.error('Sidebar auto-translation failed', err);
      }
    };

    autoTranslate();
  }, [group.id, group.name, group.translations, language]);

  const displayName = translatedName || group.name;

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
      <span className="group-name-sidebar">{displayName}</span>
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
}

const Sidebar: React.FC<SidebarProps> = ({ selected, setSelected, userGroups = [], activeGroupId, setActiveGroupId, hideMobile = false }) => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [showGroupModal, setShowGroupModal] = useState(false);

  const DashboardIcon = SidebarData[0].icon;
  const NotesIcon = SidebarData[1].icon;
  const ProfileIcon = SidebarData[2].icon;

  const handleGroupClick = (groupId: string) => {
    setActiveGroupId(groupId);
    setSelected(2); // Switch to GroupChat view
    setShowGroupModal(false);
  };

  const getUnityPercentageLocal = (group: Group): number => {
    return group.unityPercentage ?? 0;
  };

  const getGroupStatusEmoji = (group: Group): string => {
    const percentage = getUnityPercentageLocal(group);

    if (percentage === 100) return '☀️';
    if (percentage >= 66) return '🌕';
    if (percentage >= 33) return '🌠';
    return '🌑';
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
            onClick={() => navigate(`/${language}/dashboard`)}
            data-testid="sidebar-dashboard"
          >
            <DashboardIcon />
            <span>{t('sidebar.dashboard')}</span>
          </div>

          {/* My Notes */}
          <div className={selected === 1 ? 'menuItem active' : 'menuItem'}
            onClick={() => setSelected(1)}
            data-testid="sidebar-notes"
          >
            <NotesIcon />
            <span>{t('sidebar.myNotes')}</span>
          </div>

          {/* Languages */}
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
              {userGroups.map((group) => (
                <SidebarGroupItem
                  key={group.id}
                  group={group}
                  language={language}
                  isActive={selected === 2 && activeGroupId === group.id}
                  onClick={() => handleGroupClick(group.id)}
                  getGroupStatusEmoji={getGroupStatusEmoji}
                  getUnityPercentage={getUnityPercentageLocal}
                />
              ))}
            </div>

            {userGroups.length < MAX_GROUPS_PER_USER && (
              <div className="menuItem create-group-item" onClick={() => navigate(`/${language}/group-options`)} data-testid="sidebar-join-create-group">
                <UilPlusCircle />
                <span>{t('sidebar.joinCreateGroup')}</span>
              </div>
            )}
          </div>

          {/* Mobile Groups Trigger */}
          <div className={`menuItem mobile-groups-trigger ${selected === 2 ? 'active' : ''}`}
            onClick={() => setShowGroupModal(true)}
          >
            <UilUsersAlt />
          </div>

          <div 
            className={selected === 4 ? 'menuItem active' : 'menuItem'} 
            onClick={() => setSelected(4)}
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
              {userGroups.map((group) => (
                <SidebarGroupItem
                  key={group.id}
                  group={group}
                  language={language}
                  isActive={activeGroupId === group.id}
                  onClick={() => handleGroupClick(group.id)}
                  getGroupStatusEmoji={getGroupStatusEmoji}
                  getUnityPercentage={getUnityPercentageLocal}
                  isModal={true}
                />
              ))}
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

      {/* Sign Out Confirmation Modal */}

    </>
  );
};

export default Sidebar;


