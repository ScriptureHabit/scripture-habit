import { useState, useEffect, useCallback, useMemo } from 'react';
import { auth, db } from '../../../firebase';
import { doc, onSnapshot, collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../hooks/use-language';
import { MAX_GROUPS_PER_USER } from '../../../config';
import { Group } from '../../../types/chat';
import { UserData } from '../../../types/user';
import apiClient from '../../../utils/api-client';
import { getApiErrorMessage } from '../../../utils/api-error-parser';
import { toast } from 'react-toastify';

export function useJoinGroup() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const [error, setError] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [publicGroups, setPublicGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const groupsPerPage = 5;

  const [translatedNames, setTranslatedNames] = useState<Record<string, string>>({});
  const [translatedDescs, setTranslatedDescs] = useState<Record<string, string>>({});
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());

  const handleTranslateGroup = useCallback(async (
    groupId: string,
    name: string,
    description?: string,
    translations?: Record<string, { name: string; description?: string }>
  ) => {
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

    if (!user) {
      setTranslatedNames(prev => ({ ...prev, [groupId]: name }));
      if (description) {
        setTranslatedDescs(prev => ({ ...prev, [groupId]: description }));
      }
      return;
    }

    try {
      const translate = async (text: string, type: 'group_name' | 'group_description') => {
        if (!text) return null;
        const res = await apiClient.post('/api/ai/translate', {
          text,
          targetLanguage: language,
          updateType: type
        });
        return res.data.translatedText;
      };

      const [newName, newDesc] = await Promise.all([
        translate(name, 'group_name'),
        description ? translate(description, 'group_description') : Promise.resolve(null)
      ]);

      if (newName) setTranslatedNames(prev => ({ ...prev, [groupId]: newName }));
      if (newDesc) setTranslatedDescs(prev => ({ ...prev, [groupId]: newDesc }));

    } catch (e: unknown) {
      console.error("Error translating group info:", e);
      toast.error(t('groupChat.errorTranslation') || "Failed to translate");
      setTranslatedNames(prev => ({ ...prev, [groupId]: name }));
      if (description) {
        setTranslatedDescs(prev => ({ ...prev, [groupId]: description }));
      }
    } finally {
      setTranslatingIds(prev => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
    }
  }, [language, t, user]);

  useEffect(() => {
    const fetchPublicGroups = async () => {
      try {
        const resp = await apiClient.get('/api/groups?limit=20');
        if (resp.data && Array.isArray(resp.data)) {
          setPublicGroups(resp.data);
          return;
        }
      } catch (e) {
        console.warn('Backend /groups fetch failed, falling back to client query:', e);
      }

      try {
        const q = query(
          collection(db, 'groups'), 
          where('isPublic', '==', true),
          orderBy('lastMessageAt', 'desc'),
          limit(20)
        );
        const querySnapshot = await getDocs(q);
        const groups: Group[] = [];
        querySnapshot.forEach((doc) => {
          groups.push({ id: doc.id, ...doc.data() } as Group);
        });
        setPublicGroups(groups);
      } catch (e) {
        console.error('Error fetching public groups (client fallback):', e);
        setPublicGroups([]);
      }
    };

    fetchPublicGroups().finally(() => setLoadingGroups(false));

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
          if (err.code !== 'permission-denied') {
            console.error("[JoinGroup] User data listener error:", err);
          }
        });
      }
    });

    return () => { authUnsubscribe(); userDocUnsubscribe(); };
  }, []);

  const filteredGroups = useMemo(() => {
    const userGroupIds = userData?.groupIds || (userData?.groupId ? [userData.groupId] : []);
    const available = publicGroups.filter((g: Group) => !userGroupIds.includes(g.id));
    return [...available].sort((a, b) => {
      // Prioritize demo group (Daily Bread) at the top of the list
      if (a.isDemoGroup && !b.isDemoGroup) return -1;
      if (!a.isDemoGroup && b.isDemoGroup) return 1;
      return 0;
    });
  }, [publicGroups, userData]);

  const totalPages = Math.ceil(filteredGroups.length / groupsPerPage);

  const currentGroups = useMemo(() => {
    const startIndex = (currentPage - 1) * groupsPerPage;
    return filteredGroups.slice(startIndex, startIndex + groupsPerPage);
  }, [filteredGroups, currentPage, groupsPerPage]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const joinGroup = async (groupId: string, groupData: Group) => {
    if (!user) {
      setError(t('joinGroup.errorLoggedIn'));
      return;
    }

    const currentGroupIds = userData?.groupIds || (userData?.groupId ? [userData.groupId] : []);

    if (currentGroupIds.length >= MAX_GROUPS_PER_USER) {
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
      await apiClient.post('/api/groups/join-group', { groupId });
      navigate(`/${language}/dashboard`, {
        state: { 
          initialGroupId: groupId, 
          initialView: 2, 
          showJoinSuccessModal: true, 
          joinedGroupName: groupData.name || '' 
        }
      });
    } catch (e: unknown) {
      console.error('Server join failed with error:', e);
      setError(getApiErrorMessage(e, 'joinGroup.errorJoinFailed', t));
    }
  };

  return {
    user,
    userData,
    publicGroups,
    filteredGroups,
    currentGroups,
    loadingGroups,
    error,
    setError,
    currentPage,
    totalPages,
    handlePageChange,
    joinGroup,
    translatedNames,
    translatedDescs,
    translatingIds,
    handleTranslateGroup
  };
}
