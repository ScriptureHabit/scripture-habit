import './JoinGroup.css';
import { useState, useEffect, useCallback } from "react";
import { getToken } from "firebase/app-check";
import { auth, db, appCheck } from '../../firebase';
import { doc, onSnapshot, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { onAuthStateChanged, User } from "firebase/auth";
import '../groupform/GroupForm.css';
import GroupCard from '../../groups/GroupCard';
import { useLanguage } from '../../context/LanguageContext';
import UserProfileModal from '../userprofilemodal/UserProfileModal';
import Mascot from '../mascot/Mascot';
import { toast } from 'react-toastify';
import { Group } from '../../types/chat';
import { UserData } from '../../types/user';
import { parseTimestampToDate } from '../../utils/timeUtils';

export default function JoinGroup() {
  const { t, language } = useLanguage();
  const API_BASE = window.location.hostname === 'localhost' ? '' : 'https://scripturehabit.app';
  const [error, setError] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [publicGroups, setPublicGroups] = useState<Group[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [selectedMemberForProfile, setSelectedMemberForProfile] = useState<UserData | null>(null);
  const [translatedNames, setTranslatedNames] = useState<Record<string, string>>({});
  const [translatedDescs, setTranslatedDescs] = useState<Record<string, string>>({});
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const handleTranslateGroup = useCallback(async (groupId: string, name: string, description?: string, translations?: Record<string, {name: string, description?: string}>) => {
    // 1. Check for manual translation in Firestore (Prioritize this)
    const manualTrans = translations?.[language];
    if (manualTrans?.name || manualTrans?.description) {
      if (manualTrans.name) {
        setTranslatedNames(prev => ({ ...prev, [groupId]: manualTrans.name }));
      }
      if (manualTrans.description) {
        setTranslatedDescs(prev => ({ ...prev, [groupId]: manualTrans.description! }));
      }
      return;
    }

    // 2. Performance: Avoid duplicate network calls
    let alreadyTranslating = false;
    setTranslatingIds(prev => {
      if (prev.has(groupId)) {
        alreadyTranslating = true;
        return prev;
      }
      const next = new Set(prev);
      next.add(groupId);
      return next;
    });

    if (alreadyTranslating) return;

    try {
      if (!user) return;
      const idToken = await user.getIdToken();
      let appCheckToken = '';
      if (appCheck) {
        const appCheckTokenResponse = await getToken(appCheck, false);
        appCheckToken = appCheckTokenResponse.token;
      }

      const headers: Record<string, string> = { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      };
      if (appCheckToken) {
        headers['X-Firebase-AppCheck'] = appCheckToken;
      }

      const translate = async (text: string, type: 'group_name' | 'group_description') => {
        if (!text) return null;
        const res = await fetch(`${API_BASE}/api/translate`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ text, targetLanguage: language, updateType: type })
        });
        if (!res.ok) throw new Error('Translation failed');
        const data = await res.json();
        return data.translatedText;
      };

      const [newName, newDesc] = await Promise.all([
        translate(name, 'group_name'),
        description ? translate(description, 'group_description') : Promise.resolve(null)
      ]);

      if (newName) setTranslatedNames(prev => ({ ...prev, [groupId]: newName }));
      if (newDesc) setTranslatedDescs(prev => ({ ...prev, [groupId]: newDesc }));

    } catch (error) {
      console.error("Error translating group info:", error);
      toast.error(t('groupChat.errorTranslation') || "Failed to translate");
    } finally {
      setTranslatingIds(prev => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
    }
  }, [language, t, user, API_BASE]);

  useEffect(() => {
    let userDocUnsubscribe = () => { };
    const authUnsubscribe = onAuthStateChanged(auth!, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        userDocUnsubscribe = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserData(docSnap.data() as UserData);
          }
        }, (err) => {
          if (err.code !== 'permission-denied') console.error("[JoinGroup] User data listener error:", err);
        });
      }
    });

    const fetchPublicGroups = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/groups`);
        if (resp.ok) {
          const groups = await resp.json();
          setPublicGroups(groups || []);
          return;
        }
        console.warn('Backend /groups returned', resp.status);
      } catch (e) {
        console.warn('Backend /groups fetch failed, falling back to client query:', e);
      }

      try {
        // Fallback to client-side query if backend fails
        // Simple query with 'isPublic' filter to match security rules
        const q = query(
          collection(db, 'groups'), 
          where('isPublic', '==', true),
          limit(100)
        );
        const querySnapshot = await getDocs(q);
        const groups: Group[] = [];
        querySnapshot.forEach((doc) => {
          groups.push({ id: doc.id, ...doc.data() } as Group);
        });
        setPublicGroups(groups.sort((a,b) => (b.membersCount || 0) - (a.membersCount || 0)).slice(0, 50));
      } catch (e) {
        console.error('Error fetching public groups (client fallback):', e);
        setPublicGroups([]);
      }
    };
    fetchPublicGroups();

    return () => { authUnsubscribe(); userDocUnsubscribe(); };
  }, [API_BASE]);

  const joinGroup = async (groupId: string, groupData: Group) => {
    if (!user) {
      setError(t('joinGroup.errorLoggedIn'));
      return;
    }

    const currentGroupIds = userData?.groupIds || (userData?.groupId ? [userData.groupId] : []);

    if (currentGroupIds.length >= 12) {
      setError(t('joinGroup.errorMaxGroups'));
      return;
    }

    if (currentGroupIds.includes(groupId)) {
      setError(t('joinGroup.errorAlreadyMember'));
      return;
    }

    if (groupData.members && groupData.members.includes(user.uid)) {
      setError(t('joinGroup.errorAlreadyMember'));
      return;
    }

    if (groupData.membersCount && groupData.maxMembers && groupData.membersCount >= groupData.maxMembers) {
      setError(t('joinGroup.errorFull'));
      return;
    }

    try {
      const idToken = await user.getIdToken();
      let appCheckToken = '';
      if (appCheck) {
        const appCheckTokenResponse = await getToken(appCheck, false);
        appCheckToken = appCheckTokenResponse.token;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      };
      if (appCheckToken) {
        headers['X-Firebase-AppCheck'] = appCheckToken;
      }

      const resp = await fetch(`${API_BASE}/api/join-group`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ groupId })
      });
      if (resp.ok) {
        toast.success(`🎉 ${t('joinGroup.successJoined')} ${groupData.name}`);
        navigate(`/${language}/dashboard`, { state: { initialGroupId: groupId, initialView: 2 } });
        return;
      }
      const errText = await resp.text();
      console.warn('Server join failed:', resp.status, errText);
      setError(`${t('joinGroup.errorJoinFailed')} ${errText}`);
    } catch (e) {
      console.error('Server join failed with error:', e);
      setError(t('joinGroup.errorJoinFailed'));
    }
  };

  const [memberNames, setMemberNames] = useState<{uid: string, nickname: string}[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [groupNoteCount, setGroupNoteCount] = useState(0);

  const handleJoinClick = async (groupId: string, groupData: Group) => {
    setSelectedGroup({ ...groupData, id: groupId });
    setShowConfirmModal(true);
    setGroupNoteCount(groupData.noteCount || 0);

    // Use memberPreviews already in the group data to avoid security-blocked user fetches
    if (groupData.memberPreviews && groupData.memberPreviews.length > 0) {
      setMemberNames(groupData.memberPreviews.map(m => ({
        uid: m.uid,
        nickname: m.nickname || 'Member'
      })));
    } else {

      setMemberNames([]);
    }
    setLoadingMembers(false);
  };

  useEffect(() => {
    if (selectedGroup && !translatedNames[selectedGroup.id] && !translatingIds.has(selectedGroup.id)) {
      handleTranslateGroup(selectedGroup.id, selectedGroup.name || "", selectedGroup.description, selectedGroup.translations);
    }
  }, [selectedGroup, language, handleTranslateGroup, translatedNames, translatingIds]);

  if (!t) return null; // Wait for translations

  const confirmJoin = async () => {
    if (selectedGroup) {
      await joinGroup(selectedGroup.id, selectedGroup);
      setShowConfirmModal(false);
      setSelectedGroup(null);
      setMemberNames([]);
    }
  };

  const handleOpenGroup = (groupId: string) => {
    navigate(`/${language}/dashboard`, { state: { initialGroupId: groupId, initialView: 2 } });
  };

  return (
    <div className="App">
      <div className="AppGlass join-group-container">
        {error && <p className="error-banner">{error}</p>}

        <Mascot
          userData={userData}
          customMessage={t('mascot.groupOptionsPrompt')}
          reversed={true}
        />

        <div className="public-groups-section">
          <div className="section-header">
            <h2>{t('joinGroup.publicGroupsTitle')}</h2>
            <p>{t('joinGroup.publicGroupsDesc')}</p>
          </div>

          {publicGroups.length === 0 ? (
            <p className="no-groups-message">{t('joinGroup.noPublicGroups')}</p>
          ) : (
            <div className="groups-grid">
              {publicGroups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  currentUser={user}
                  onJoin={() => handleJoinClick(group.id, group)}
                  onOpen={() => handleJoinClick(group.id, group)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="create-group-cta">
          <p>{t('joinGroup.createGroupCta')}</p>
          <Link to="/group-form" className="create-group-link">{t('joinGroup.createGroupLink')}</Link>
        </div>

        <div className="back-to-dashboard-container">
          <Link to="/dashboard" className="back-link">
            {t('groupOptions.backToDashboard')}
          </Link>
        </div>

      </div>

      {/* Join Confirmation Modal */}
      {showConfirmModal && selectedGroup && (
        <div className="group-modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="group-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-section">
              <div className="modal-group-title-container">
                <h3 className="modal-group-title">
                  {translatingIds.has(selectedGroup.id) ? '...' : (translatedNames[selectedGroup.id] || selectedGroup.name)}
                </h3>
              </div>
              {translatedNames[selectedGroup.id] && translatedNames[selectedGroup.id] !== selectedGroup.name && (
                <p className="original-text-hint">
                  {t('groupChat.original')}: {selectedGroup.name}
                </p>
              )}
            </div>

            {selectedGroup.description && (
              <div className="modal-description-section">
                <p className="modal-description-text">
                  {translatingIds.has(selectedGroup.id) ? '...' : (translatedDescs[selectedGroup.id] || selectedGroup.description)}
                </p>
                {translatedDescs[selectedGroup.id] && translatedDescs[selectedGroup.id] !== selectedGroup.description && (
                  <p className="original-text-hint">
                    {t('groupChat.original')}: {selectedGroup.description}
                  </p>
                )}
              </div>
            )}

            {selectedGroup.createdAt && (
              <p className="modal-created-at">
                {t('joinGroup.createdAt')}: {(() => {
                  const date = parseTimestampToDate(selectedGroup.createdAt);
                  if (isNaN(date.getTime())) return '';
                  return date.toLocaleDateString(language === 'ja' ? 'ja-JP' : undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  });
                })()}
              </p>
            )}

            <div className="modal-members-section">
              <div className="modal-members-header">
                <h4>
                  {t('groupChat.members')} ({selectedGroup.membersCount || 0})
                </h4>
                <span className="modal-note-stats">
                  <span className="emoji">📄</span> {groupNoteCount} {t('joinGroup.notes')}
                </span>
              </div>
              {loadingMembers ? (
                <p className="modal-loading-text">{t('letterBox.loading') || 'Loading members...'}</p>
              ) : (
                <div className="modal-members-list">
                  {memberNames.length > 0 ? (
                    memberNames.map((userObj, idx) => (
                      <span
                        key={idx}
                        className="modal-member-badge"
                      >
                        {userObj.nickname || 'Unknown'}
                      </span>
                    ))
                  ) : (
                    <p className="modal-none-text">{t('groupCard.noDescription') || 'None'}</p>
                  )}
                </div>
              )}
            </div>

            {/* Profile Modal inside Confirm Modal */}
            {selectedMemberForProfile && (
              <div className="user-profile-modal-wrapper">
                <UserProfileModal
                  user={selectedMemberForProfile}
                  onClose={() => setSelectedMemberForProfile(null)}
                />
              </div>
            )}

            <p className="modal-confirm-message">
              {userData?.groupIds?.includes(selectedGroup.id)
                ? t('joinGroup.errorAlreadyMember')
                : t('joinGroup.joinConfirmMessage')}
            </p>

            <div className="modal-actions-container">
              <button
                className="close-modal-btn"
                onClick={() => setShowConfirmModal(false)}
              >
                {t('joinGroup.cancelJoin')}
              </button>
              {userData?.groupIds?.includes(selectedGroup.id) ? (
                <button
                  className="close-modal-btn confirm-join-btn open-group-btn"
                  onClick={() => handleOpenGroup(selectedGroup.id)}
                >
                  {t('groupCard.open')}
                </button>
              ) : (
                <button
                  className="close-modal-btn confirm-join-btn"
                  onClick={confirmJoin}
                >
                  {t('joinGroup.confirmJoin')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
