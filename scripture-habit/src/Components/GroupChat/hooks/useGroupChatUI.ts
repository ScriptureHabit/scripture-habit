import { useState, useEffect, useRef } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { safeStorage } from '../../../Utils/storage';
import { GroupData } from '../../../types/chat';

export const useGroupChatUI = (
  groupId: string,
  groupData: GroupData | null,
  language: string,
  API_BASE: string
) => {
  const [translatedGroupName, setTranslatedGroupName] = useState('');
  const [translatedGroupDesc, setTranslatedGroupDesc] = useState('');
  const [showAddNoteTooltip, setShowAddNoteTooltip] = useState(false);
  const [showInactivityPolicyBanner, setShowInactivityPolicyBanner] = useState(false);

  const groupNameTranslateRef = useRef<{ id: string | null; lang: string | null; textHash?: number }>({ id: null, lang: null });
  const groupDescTranslateRef = useRef<{ id: string | null; lang: string | null; textHash?: number }>({ id: null, lang: null });

  // Auto-translation logic
  useEffect(() => {
    setTranslatedGroupName('');
    setTranslatedGroupDesc('');

    if (groupNameTranslateRef.current.id !== groupId) {
      groupNameTranslateRef.current = { id: groupId, lang: null };
      groupDescTranslateRef.current = { id: groupId, lang: null };
    }

    const autoTranslate = async () => {
      if (!groupData?.name || !language) return;

      const savedTrans = groupData.translations?.[language];
      const nameToSet = savedTrans?.name;
      const descToSet = savedTrans?.description;

      const needsName = !nameToSet;
      const needsDesc = groupData.description && !descToSet;

      if (nameToSet) setTranslatedGroupName(nameToSet);
      if (descToSet) setTranslatedGroupDesc(descToSet);

      if (!needsName && !needsDesc) return;

      const translateText = async (text: string, type: string) => {
        if (!text) return '';
        const currentRef = type === 'group_name' ? groupNameTranslateRef : groupDescTranslateRef;
        if (currentRef.current.lang === language && currentRef.current.textHash === text.length) {
          return sessionStorage.getItem(`trans_${type}_${groupId}_${language}`) || '';
        }

        const cacheKey = `trans_${type}_${groupId}_${language}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          currentRef.current = { id: groupId, lang: language, textHash: text.length };
          return cached;
        }

        currentRef.current = { id: groupId, lang: language, textHash: text.length };

        try {
          const idToken = await auth?.currentUser?.getIdToken();
          if (!idToken) return '';
          const response = await fetch(`${API_BASE}/api/translate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ text, targetLanguage: language })
          });

          if (response.ok) {
            const data = await response.json();
            if (data.translatedText) {
              sessionStorage.setItem(cacheKey, data.translatedText);
              return data.translatedText;
            }
          }
        } catch (e) {
          console.error(`Failed to auto-translate ${type}:`, e);
        }
        return '';
      };

      const namePromise = needsName ? translateText(groupData.name, 'group_name') : Promise.resolve(null);
      const descPromise = needsDesc ? translateText(groupData.description || '', 'group_desc') : Promise.resolve(null);

      const [newName, newDesc] = await Promise.all([namePromise, descPromise]);

      if (newName) setTranslatedGroupName(newName);
      if (newDesc) setTranslatedGroupDesc(newDesc);

      if (newName || newDesc) {
        try {
          const updatePayload: any = {};
          if (newName) updatePayload[`translations.${language}.name`] = newName;
          if (newDesc) updatePayload[`translations.${language}.description`] = newDesc;
          await updateDoc(doc(db, 'groups', groupId), updatePayload);
        } catch (e) {
          console.error("Error saving translations:", e);
        }
      }
    };

    autoTranslate();
  }, [groupId, groupData?.name, groupData?.description, groupData?.translations, language]);

  // Tooltip & Inactivity Banner
  useEffect(() => {
    if (!groupId) return;
    const visitCountStr = safeStorage.get('groupChatVisitCount');
    const visitCount = visitCountStr ? parseInt(visitCountStr, 10) : 0;
    const newVisitCount = visitCount + 1;
    safeStorage.set('groupChatVisitCount', newVisitCount.toString());

    if (newVisitCount % 2 === 1) {
      const timer = setTimeout(() => setShowAddNoteTooltip(true), 1000);
      return () => clearTimeout(timer);
    }

    const hasDismissedBanner = safeStorage.get('hasDismissedInactivityPolicy');
    if (!hasDismissedBanner) {
      setShowInactivityPolicyBanner(true);
    }
  }, [groupId]);

  return {
    translatedGroupName,
    translatedGroupDesc,
    showAddNoteTooltip,
    setShowAddNoteTooltip,
    showInactivityPolicyBanner,
    setShowInactivityPolicyBanner
  };
};
