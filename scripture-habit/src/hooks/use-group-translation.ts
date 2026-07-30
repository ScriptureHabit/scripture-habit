import { useState, useEffect } from 'react';
import apiClient from '../utils/api-client';
import { Group } from '../types/chat';

export interface UseGroupTranslationResult {
  displayName: string;
  displayDesc: string;
  isLoading: boolean;
}

export function useGroupTranslation(
  group: Group | null | undefined,
  language: string
): UseGroupTranslationResult {
  const [translatedName, setTranslatedName] = useState<string>('');
  const [translatedDesc, setTranslatedDesc] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const groupId = group?.id;
  const groupName = group?.name;
  const groupDescription = group?.description;
  const groupTranslations = group?.translations;

  useEffect(() => {
    if (!groupId || !language) {
      queueMicrotask(() => {
        setTranslatedName('');
        setTranslatedDesc('');
      });
      return;
    }

    // 1. Check Firestore Data (Real-time sync)
    const targetTrans = groupTranslations?.[language];
    let hasFirestoreName = false;
    let hasFirestoreDesc = false;

    const nameToSet = targetTrans?.name || '';
    const descToSet = targetTrans?.description || '';

    if (nameToSet) {
      hasFirestoreName = true;
    }
    if (descToSet) {
      hasFirestoreDesc = true;
    }

    // 2. Check Session Cache
    const cacheKeyName = `trans_name_${groupId}_${language}`;
    const cacheKeyDesc = `trans_desc_${groupId}_${language}`;

    const cachedName = sessionStorage.getItem(cacheKeyName) || '';
    const cachedDesc = sessionStorage.getItem(cacheKeyDesc) || '';

    queueMicrotask(() => {
      setTranslatedName(nameToSet || cachedName);
      setTranslatedDesc(descToSet || cachedDesc);
    });

    const needsNameTrans = !hasFirestoreName && !cachedName && !!groupName;
    const needsDescTrans = !hasFirestoreDesc && !cachedDesc && !!groupDescription;

    if (!needsNameTrans && !needsDescTrans) return;

    // 3. Prevent duplicate requests per group & language
    const attemptKey = `attempt_group_trans_${groupId}_${language}`;
    if (sessionStorage.getItem(attemptKey)) return;

    sessionStorage.setItem(attemptKey, 'true');

    const translateGroup = async () => {
      queueMicrotask(() => {
        setIsLoading(true);
      });

      try {
        const promises: Promise<void>[] = [];

        if (needsNameTrans && groupName) {
          promises.push(
            apiClient
              .post('/api/ai/translate', {
                text: groupName,
                targetLanguage: language,
                groupId,
                updateType: 'group_name',
              })
              .then((res) => {
                if (res.data?.translatedText) {
                  setTranslatedName(res.data.translatedText);
                  sessionStorage.setItem(cacheKeyName, res.data.translatedText);
                }
              })
          );
        }

        if (needsDescTrans && groupDescription) {
          promises.push(
            apiClient
              .post('/api/ai/translate', {
                text: groupDescription,
                targetLanguage: language,
                groupId,
                updateType: 'group_description',
              })
              .then((res) => {
                if (res.data?.translatedText) {
                  setTranslatedDesc(res.data.translatedText);
                  sessionStorage.setItem(cacheKeyDesc, res.data.translatedText);
                }
              })
          );
        }

        await Promise.all(promises);
      } catch (err) {
        console.error('Group auto-translation failed:', err);
      } finally {
        setIsLoading(false);
      }
    };

    translateGroup();
  }, [groupId, groupName, groupDescription, groupTranslations, language]);

  return {
    displayName: translatedName || groupName || '',
    displayDesc: translatedDesc || groupDescription || '',
    isLoading,
  };
}
