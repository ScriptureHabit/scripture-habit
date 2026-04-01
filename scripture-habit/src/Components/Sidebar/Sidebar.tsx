import React, { useState, useEffect, useRef } from 'react';
import './Sidebar.css';
import { SidebarData } from '../../Data/Data';
import {
  UilUsersAlt,
  UilBookOpen,
  UilPlusCircle,
} from "@iconscout/react-unicons";
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useLanguage } from '../../Context/LanguageContext';
import { Group } from '../../types/chat';
import { UserData } from '../../types/user';

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

  useEffect(() => {
    // 1. Check Firestore Data (Real-time sync makes this fast)
    if (group.translations && group.translations[language] && group.translations[language].name) {
      setTranslatedName(group.translations[language].name);
      return;
    }

    // Check if we already attempted translation in this session
    if (translationAttemptedRef.current) return;

    // Firestore update helper
    const saveTranslationToFirestore = async (translatedText: string) => {
      try {
        const groupRef = doc(db, 'groups', group.id);
        // Construct the update object strictly for this language's name to merge
        const updateData: Record<string, string> = {};
        updateData[`translations.${language}.name`] = translatedText;

        await updateDoc(groupRef, updateData);
        console.log(`Saved translation for ${language} to Firestore`);
      } catch (err) {
        console.error('Failed to save translation to Firestore:', err);
      }
    };

    const autoTranslate = async () => {
      if (!group.name || !language) return;

      const cacheKey = `trans_name_${group.id}_${language}`;
      const cached = sessionStorage.getItem(cacheKey);

      if (cached) {
        setTranslatedName(cached);
        translationAttemptedRef.current = true;
        return;
      }

      translationAttemptedRef.current = true;

      try {
        const idToken = await auth?.currentUser?.getIdToken();
        const API_BASE = window.location.hostname === 'localhost' ? '' : 'https://scripturehabit.app';

        const res = await fetch(`${API_BASE}/api/translate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          },
          body: JSON.stringify({
            text: group.name,
            targetLanguage: language,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.translatedText) {
            setTranslatedName(data.translatedText);
            sessionStorage.setItem(cacheKey, data.translatedText);

            // SAVE TO FIRESTORE
            await saveTranslationToFirestore(data.translatedText);
          }
        } else {
          console.warn('Translation API returned error status:', res.status);
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
      >
        <span style={{ fontSize: '1.2rem', marginRight: '2px' }}>{getGroupStatusEmoji(group)}</span>
        <span style={{ fontSize: '0.75rem', marginRight: '4px', color: getUnityPercentage(group) === 100 ? '#B8860B' : 'var(--gray)', fontWeight: getUnityPercentage(group) === 100 ? 'bold' : 'normal' }}>
          {getUnityPercentage(group)}%
        </span>
        <span>
          {displayName}
          {group.members && <span style={{ fontSize: '0.85em', color: 'var(--gray)', fontWeight: 'normal', marginLeft: '4px' }}>({group.members.length})</span>}
        </span>
        {(group.unreadCount ?? 0) > 0 && (
          <span className="unread-badge" style={{ marginLeft: 'auto' }}>{(group.unreadCount ?? 0) > 99 ? '99+' : group.unreadCount}</span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`menuItem ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <span style={{ fontSize: '1.2rem', marginRight: '2px' }}>{getGroupStatusEmoji(group)}</span>
      <span style={{ fontSize: '0.75rem', marginRight: '4px', color: getUnityPercentage(group) === 100 ? '#B8860B' : 'var(--gray)', fontWeight: getUnityPercentage(group) === 100 ? 'bold' : 'normal' }}>
        {getUnityPercentage(group)}%
      </span>
      <span className="group-name-sidebar">{displayName}</span>
      {(group.unreadCount ?? 0) > 0 && (
        <span className="unread-badge">{(group.unreadCount ?? 0) > 99 ? '99+' : group.unreadCount}</span>
      )}
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
  userData: UserData | null;
}

const Sidebar: React.FC<SidebarProps> = ({ selected, setSelected, userGroups = [], activeGroupId, setActiveGroupId, hideMobile = false, userData }) => {
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

  const getGroupStatusEmoji = (group: Group): string => {
    const percentage = getUnityPercentage(group);

    if (percentage === 100) return '☀️';
    if (percentage >= 66) return '🌕';
    if (percentage >= 33) return '🌠';
    return '🌑';
  };

  const getUnityPercentage = (group: Group): number => {
    if (!group || !group.members || group.members.length === 0) return 0;

    const effectiveTimeZone = group.timeZone || userData?.timeZone || 'UTC';
    const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: effectiveTimeZone });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    const uniquePosters = new Set<string>();

    // SOURCE 1: dailyActivity
    if (group.dailyActivity?.activeMembers && (group.dailyActivity.date === todayStr || group.dailyActivity.date === new Date().toDateString())) {
      group.dailyActivity.activeMembers.forEach(uid => uniquePosters.add(uid));
    }



    // Exclude members who joined today UNLESS they have already posted
    const memberJoinedAt = group.memberJoinedAt || {};
    const eligibleMembers = group.members.filter(uid => {
      if (uniquePosters.has(uid)) return true; // If they posted, they are eligible regardless of join date

      const joinedTs = memberJoinedAt[uid];
      if (!joinedTs) return true;
      let joinedTime = 0;
      if (joinedTs?.toDate) joinedTime = joinedTs.toDate().getTime();
      else if (joinedTs?.seconds) joinedTime = joinedTs.seconds * 1000;
      return joinedTime < todayTime;
    });

    if (eligibleMembers.length === 0) return 0;

    const eligiblePostersCount = [...uniquePosters].filter(uid => eligibleMembers.includes(uid)).length;
    return Math.round((eligiblePostersCount / eligibleMembers.length) * 100);
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
            onClick={() => setSelected(0)}
          >
            <DashboardIcon />
            <span>{t('sidebar.dashboard')}</span>
          </div>

          {/* My Notes */}
          <div className={selected === 1 ? 'menuItem active' : 'menuItem'}
            onClick={() => setSelected(1)}
          >
            <NotesIcon />
            <span>{t('sidebar.myNotes')}</span>
          </div>

          {/* Languages */}
          <div className={selected === 3 ? 'menuItem active' : 'menuItem'}
            onClick={() => setSelected(3)}
          >
            <ProfileIcon />
            <span>{t('sidebar.profile')}</span>
          </div>

          {/* Desktop Groups Section */}
          <div className="groups-section desktop-groups">
            <div className="menu-header">
              {t('sidebar.myGroups')} <span style={{ fontSize: '1.2em' }}>({userGroups.length}/4)</span>
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
                  getUnityPercentage={getUnityPercentage}
                />
              ))}
            </div>

            {userGroups.length < 4 && (
              <div className="menuItem create-group-item" onClick={() => navigate(`/${language}/group-options`)}>
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
            {userGroups.some(g => (g.unreadCount ?? 0) > 0) && (
              <span className="unread-dot"></span>
            )}
          </div>

          <div className={selected === 4 ? 'menuItem active' : 'menuItem'} onClick={() => setSelected(4)}>
            <UilBookOpen />
            <span>{t('sidebar.story')}</span>
          </div>
        </div>
      </div>


      {/* Mobile Group Selection Modal */}
      {showGroupModal && (
        <div className="group-modal-overlay" onClick={() => setShowGroupModal(false)}>
          <div className="group-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{t('sidebar.selectGroup')} <span style={{ fontSize: '1.2em' }}>({userGroups.length}/4)</span></h3>
            <div className="modal-group-list">
              {userGroups.map((group) => (
                <SidebarGroupItem
                  key={group.id}
                  group={group}
                  language={language}
                  isActive={activeGroupId === group.id}
                  onClick={() => handleGroupClick(group.id)}
                  getGroupStatusEmoji={getGroupStatusEmoji}
                  getUnityPercentage={getUnityPercentage}
                  isModal={true}
                />
              ))}
            </div>
            {userGroups.length < 4 && (
              <div className="modal-create-group" onClick={() => { navigate(`/${language}/group-options`); setShowGroupModal(false); }}>
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