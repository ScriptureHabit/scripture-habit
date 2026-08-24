import { useState, useEffect, useRef } from 'react';
import { getToken } from 'firebase/app-check';
import { auth, appCheck } from '../../../../firebase';
import { GroupData } from '../../../../types/chat';
import { useLanguage } from '../../../../hooks/use-language';

export const useGroupChatUI = (
  groupId: string,
  groupData: GroupData | null,
  language: string
) => {
  const { t } = useLanguage();
  const [translatedGroupName, setTranslatedGroupName] = useState('');
  const [translatedGroupDesc, setTranslatedGroupDesc] = useState('');

  const groupNameTranslateRef = useRef<{ id: string | null; lang: string | null; textHash?: number }>({ id: null, lang: null });
  const groupDescTranslateRef = useRef<{ id: string | null; lang: string | null; textHash?: number }>({ id: null, lang: null });

  // Auto-translation logic for group name & description
  useEffect(() => {
    if (!groupId) {
      queueMicrotask(() => {
        setTranslatedGroupName('');
        setTranslatedGroupDesc('');
      });
      return;
    }

    if (groupNameTranslateRef.current.id !== groupId) {
      queueMicrotask(() => {
        setTranslatedGroupName('');
        setTranslatedGroupDesc('');
      });
      groupNameTranslateRef.current = { id: groupId, lang: null };
      groupDescTranslateRef.current = { id: groupId, lang: null };
    }

    const autoTranslate = async () => {
      if (!groupData?.name || !language) return;

      const isAiGroup = Boolean(groupData.isAiGroup || groupData.aiCompanionUid === 'ai-partner-bot');
      if (isAiGroup) {
        const savedTrans = groupData.translations?.[language];
        const defaultAiName = t('groupChat.aiGroupDefaultGroupName');
        const defaultAiDesc = t('groupChat.aiGroupDefaultGroupDesc');
        queueMicrotask(() => {
          setTranslatedGroupName(savedTrans?.name || defaultAiName);
          setTranslatedGroupDesc(savedTrans?.description || defaultAiDesc);
        });
        return;
      }

      const savedTrans = groupData.translations?.[language];
      const nameToSet = savedTrans?.name;
      const descToSet = savedTrans?.description;

      const needsName = !nameToSet;
      const needsDesc = groupData.description && !descToSet;

      if (nameToSet) {
        queueMicrotask(() => {
          setTranslatedGroupName(nameToSet);
        });
      }
      if (descToSet) {
        queueMicrotask(() => {
          setTranslatedGroupDesc(descToSet);
        });
      }

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
          let appCheckToken = '';
          if (appCheck) {
            const appCheckTokenResponse = await getToken(appCheck, false);
            appCheckToken = appCheckTokenResponse.token;
          }

          if (!idToken) return '';
          
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          };
          if (appCheckToken) {
            headers['X-Firebase-AppCheck'] = appCheckToken;
          }

          const response = await fetch('/api/ai/translate', {
            method: 'POST',
            headers,
            body: JSON.stringify({ 
              text, 
              targetLanguage: language,
              groupId,
              updateType: type === 'group_name' ? 'group_name' : 'group_description'
            })
          });

          if (response.ok) {
            const data = await response.json();
            if (data.translatedText) {
              sessionStorage.setItem(cacheKey, data.translatedText);
              return data.translatedText;
            }
          }
        } catch (e) {
          console.error('[useGroupChatUI] Failed to auto-translate type:', type, e);
        }
        return '';
      };

      const namePromise = needsName ? translateText(groupData.name, 'group_name') : Promise.resolve(null);
      const descPromise = needsDesc ? translateText(groupData.description || '', 'group_description') : Promise.resolve(null);

      const [newName, newDesc] = await Promise.all([namePromise, descPromise]);

      if (newName) setTranslatedGroupName(newName);
      if (newDesc) setTranslatedGroupDesc(newDesc);
    };

    autoTranslate();
  }, [groupId, groupData?.name, groupData?.description, groupData?.translations, groupData?.isAiGroup, groupData?.aiCompanionUid, language, t]);

  return {
    translatedGroupName,
    translatedGroupDesc
  };
};
