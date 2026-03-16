import './JoinGroup.css';
import { useState, useEffect, useCallback } from "react";
import { auth, db } from '../../firebase';
import { doc, getDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { onAuthStateChanged, User } from "firebase/auth";
import '../GroupForm/GroupForm.css';
import GroupCard from '../../groups/GroupCard';
import { useLanguage } from '../../Context/LanguageContext';
import UserProfileModal from '../UserProfileModal/UserProfileModal';
import Mascot from '../Mascot/Mascot';
import { toast } from 'react-toastify';
import { Group } from '../../types/chat';
import { UserData } from '../../types/user';

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

  const handleTranslateGroup = useCallback(async (groupId: string, name: string, description?: string, translations?: any) => {
    if (translatingIds.has(groupId)) return;

    // 1. Check for manual translation in Firestore
    const manualTrans = translations?.[language];
    if (manualTrans?.name || manualTrans?.description) {
      if (manualTrans.name) setTranslatedNames(prev => ({ ...prev, [groupId]: manualTrans.name }));
      if (manualTrans.description) setTranslatedDescs(prev => ({ ...prev, [groupId]: manualTrans.description }));
      return;
    }

    // Toggle if already translated
    if (translatedNames[groupId] || translatedDescs[groupId]) {
      setTranslatedNames(prev => {
        const next = { ...prev };
        delete next[groupId];
        return next;
      });
      setTranslatedDescs(prev => {
        const next = { ...prev };
        delete next[groupId];
        return next;
      });
      return;
    }

    setTranslatingIds(prev => {
      const next = new Set(prev);
      next.add(groupId);
      return next;
    });

    try {
      const idToken = await (user?.getIdToken() || Promise.resolve(null));
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

      const translate = async (text: string) => {
        if (!text) return null;
        const res = await fetch(`${API_BASE}/api/translate`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ text, targetLanguage: language })
        });
        if (!res.ok) throw new Error('Translation failed');
        const data = await res.json();
        return data.translatedText;
      };

      const [newName, newDesc] = await Promise.all([
        translate(name),
        description ? translate(description) : Promise.resolve(null)
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
  }, [language, t, user, translatingIds, translatedDescs, translatedNames, API_BASE]);

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
        const q = query(
          collection(db, 'groups'),
          where('isPublic', '==', true)
        );
        const querySnapshot = await getDocs(q);
        const groups: Group[] = [];
        querySnapshot.forEach((doc) => {
          groups.push({ id: doc.id, ...doc.data() } as Group);
        });
        setPublicGroups(groups);
      } catch (e) {
        console.error('Error fetching public groups (composite query fallback):', e);
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
      const resp = await fetch(`${API_BASE}/api/join-group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
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

  const [memberNames, setMemberNames] = useState<UserData[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [groupNoteCount, setGroupNoteCount] = useState(0);

  const handleJoinClick = async (groupId: string, groupData: Group) => {
    setSelectedGroup({ ...groupData, id: groupId });
    setShowConfirmModal(true);
    setMemberNames([]); // Reset
    setLoadingMembers(true);
    setGroupNoteCount(groupData.noteCount || 0);

    if (groupData.members && groupData.members.length > 0) {
      try {
        // Fetch up to 10 members for preview to avoid excessive reads/latency, or just fetch all since groups are small
        const memberIds = groupData.members.slice(0, 20);
        const names = await Promise.all(memberIds.map(async (uid) => {
          try {
            const uSnap = await getDoc(doc(db, 'users', uid));
            if (uSnap.exists()) {
              return { uid, ...uSnap.data() } as UserData;
            }
          } catch {
            console.warn("Failed to fetch user", uid);
          }
          return null;
        }));
        setMemberNames(names.filter((n): n is UserData => n !== null));
      } catch (e) {
        console.error("Error fetching member names:", e);
      }
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
        {error && <p className="error" style={{ color: 'red', textAlign: 'center', width: '100%', marginBottom: '1rem' }}>{error}</p>}

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
                  currentUser={user as any}
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

        <div style={{ textAlign: 'center', marginTop: '1rem', width: '100%' }}>
          <Link to="/dashboard" className="back-link">
            {t('groupOptions.backToDashboard')}
          </Link>
        </div>

      </div>

      {/* Join Confirmation Modal */}
      {showConfirmModal && selectedGroup && (
        <div className="group-modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="group-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #edf2f7', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <h3 style={{ margin: 0 }}>
                  {translatingIds.has(selectedGroup.id) ? '...' : (translatedNames[selectedGroup.id] || selectedGroup.name)}
                </h3>
              </div>
              {translatedNames[selectedGroup.id] && translatedNames[selectedGroup.id] !== selectedGroup.name && (
                <p style={{ fontSize: '0.75rem', color: '#a0aec0', marginTop: '4px' }}>
                  {t('groupChat.original')}: {selectedGroup.name}
                </p>
              )}
            </div>

            {selectedGroup.description && (
              <div style={{ marginBottom: '1rem' }}>
                <p style={{ color: '#4A5568', marginBottom: '0.5rem', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
                  {translatingIds.has(selectedGroup.id) ? '...' : (translatedDescs[selectedGroup.id] || selectedGroup.description)}
                </p>
                {translatedDescs[selectedGroup.id] && translatedDescs[selectedGroup.id] !== selectedGroup.description && (
                  <p style={{ fontSize: '0.75rem', color: '#a0aec0' }}>
                    {t('groupChat.original')}: {selectedGroup.description}
                  </p>
                )}
              </div>
            )}

            {selectedGroup.createdAt && (
              <p style={{ fontSize: '0.8rem', color: '#a0aec0', marginBottom: '1rem' }}>
                {t('joinGroup.createdAt')}: {(() => {
                  let date: Date;
                  const c = selectedGroup.createdAt as any;
                  if (c?.toDate) date = c.toDate();
                  else if (c?.seconds) date = new Date(c.seconds * 1000);
                  else if (c?._seconds) date = new Date(c._seconds * 1000);
                  else date = new Date(c);

                  if (isNaN(date.getTime())) return '';
                  return date.toLocaleDateString(language === 'ja' ? 'ja-JP' : undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  });
                })()}
              </p>
            )}

            <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.25rem' }}>
                <h4 style={{ fontSize: '0.9rem', color: '#4A5568', margin: 0 }}>
                  {t('groupChat.members')} ({selectedGroup.membersCount || 0})
                </h4>
                <span style={{ fontSize: '0.8rem', color: '#718096', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '1rem' }}>📄</span> {groupNoteCount} {t('joinGroup.notes')}
                </span>
              </div>
              {loadingMembers ? (
                <p style={{ fontSize: '0.8rem', color: '#718096' }}>{t('letterBox.loading') || 'Loading members...'}</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {memberNames.length > 0 ? (
                    memberNames.map((userObj, idx) => (
                      <span
                        key={idx}
                        onClick={() => setSelectedMemberForProfile(userObj)}
                        style={{
                          backgroundColor: '#EDF2F7',
                          color: '#4A5568',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '9999px',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                        }}
                      >
                        {userObj.nickname || 'Unknown'}
                      </span>
                    ))
                  ) : (
                    <p style={{ fontSize: '0.8rem', color: '#718096' }}>{t('groupCard.noDescription') || 'None'}</p>
                  )}
                </div>
              )}
            </div>

            {/* Profile Modal inside Confirm Modal */}
            {selectedMemberForProfile && (
              <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 3000 }}>
                <UserProfileModal
                  user={selectedMemberForProfile}
                  onClose={() => setSelectedMemberForProfile(null)}
                />
              </div>
            )}

            <p style={{ marginBottom: '1.5rem' }}>
              {userData?.groupIds?.includes(selectedGroup.id)
                ? t('joinGroup.errorAlreadyMember')
                : t('joinGroup.joinConfirmMessage')}
            </p>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
              <button
                className="close-modal-btn"
                onClick={() => setShowConfirmModal(false)}
                style={{ marginTop: 0, flex: 1 }}
              >
                {t('joinGroup.cancelJoin')}
              </button>
              {userData?.groupIds?.includes(selectedGroup.id) ? (
                <button
                  className="close-modal-btn confirm-join-btn"
                  onClick={() => handleOpenGroup(selectedGroup.id)}
                  style={{
                    marginTop: 0,
                    flex: 1,
                    backgroundColor: 'var(--blue-gradient-start)'
                  }}
                >
                  {t('groupCard.open')}
                </button>
              ) : (
                <button
                  className="close-modal-btn confirm-join-btn"
                  onClick={confirmJoin}
                  style={{
                    marginTop: 0,
                    flex: 1
                  }}
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
