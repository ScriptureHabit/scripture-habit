import { useState, useEffect } from 'react';
import { Group } from '../types/chat';
import { useLanguage } from './use-language';
import { isLikelyAlreadyInLanguage } from '../utils/language-utils';
import { requestTranslation } from '../utils/translation-batcher';

export interface UseGroupTranslationOptions {
  translateDescription?: boolean;
}

export interface UseGroupTranslationResult {
  displayName: string;
  displayDesc: string;
  isLoading: boolean;
}

export function useGroupTranslation(
  group: Group | null | undefined,
  language: string,
  options?: UseGroupTranslationOptions
): UseGroupTranslationResult {
  const { t } = useLanguage();
  const shouldTranslateDesc = options?.translateDescription ?? false;

  const groupId = group?.id;
  const groupName = group?.name;
  const groupDescription = group?.description;
  const groupTranslations = group?.translations;

  const [asyncName, setAsyncName] = useState<string | null>(null);
  const [asyncDesc, setAsyncDesc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const isAiGroup = Boolean(group?.isAiGroup || group?.aiCompanionUid === 'ai-partner-bot');
  const firestoreTrans = groupTranslations?.[language];

  const cacheKeyName = groupId && language ? `trans_name_${groupId}_${language}` : '';
  const cacheKeyDesc = groupId && language ? `trans_desc_${groupId}_${language}` : '';

  const cachedName = cacheKeyName ? sessionStorage.getItem(cacheKeyName) || '' : '';
  const cachedDesc = cacheKeyDesc ? sessionStorage.getItem(cacheKeyDesc) || '' : '';

  const isNameAlreadyTargetLang = groupName ? isLikelyAlreadyInLanguage(groupName, language) : true;
  const isDescAlreadyTargetLang = groupDescription ? isLikelyAlreadyInLanguage(groupDescription, language) : true;

  const hasFirestoreName = Boolean(firestoreTrans?.name);
  const hasFirestoreDesc = Boolean(firestoreTrans?.description);

  const needsNameTrans = !isAiGroup && !hasFirestoreName && !cachedName && !!groupName && !isNameAlreadyTargetLang;
  const needsDescTrans = shouldTranslateDesc && !isAiGroup && !hasFirestoreDesc && !cachedDesc && !!groupDescription && !isDescAlreadyTargetLang;

  useEffect(() => {
    if (!groupId || !language || isAiGroup || (!needsNameTrans && !needsDescTrans)) {
      return;
    }

    const attemptKey = `attempt_group_trans_${groupId}_${language}_${shouldTranslateDesc ? 'full' : 'name_only'}`;
    if (sessionStorage.getItem(attemptKey)) return;

    sessionStorage.setItem(attemptKey, 'true');

    let active = true;

    const translateGroup = async () => {
      setIsLoading(true);

      try {
        const promises: Promise<void>[] = [];

        if (needsNameTrans && groupName) {
          promises.push(
            requestTranslation({
              id: `group_name_${groupId}`,
              text: groupName,
              targetLanguage: language,
              groupId,
            }).then((translated) => {
              if (active && translated && translated !== groupName) {
                setAsyncName(translated);
                if (cacheKeyName) sessionStorage.setItem(cacheKeyName, translated);
              }
            })
          );
        }

        if (needsDescTrans && groupDescription) {
          promises.push(
            requestTranslation({
              id: `group_desc_${groupId}`,
              text: groupDescription,
              targetLanguage: language,
              groupId,
            }).then((translated) => {
              if (active && translated && translated !== groupDescription) {
                setAsyncDesc(translated);
                if (cacheKeyDesc) sessionStorage.setItem(cacheKeyDesc, translated);
              }
            })
          );
        }

        await Promise.all(promises);
      } catch (err) {
        console.error('Group auto-translation failed:', err);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    translateGroup();

    return () => {
      active = false;
    };
  }, [
    groupId,
    groupName,
    groupDescription,
    language,
    isAiGroup,
    needsNameTrans,
    needsDescTrans,
    shouldTranslateDesc,
    cacheKeyName,
    cacheKeyDesc,
  ]);

  const displayName = isAiGroup
    ? (firestoreTrans?.name || t('groupChat.aiGroupDefaultGroupName'))
    : (firestoreTrans?.name || cachedName || asyncName || groupName || '');

  const displayDesc = isAiGroup
    ? (firestoreTrans?.description || t('groupChat.aiGroupDefaultGroupDesc'))
    : (firestoreTrans?.description || cachedDesc || asyncDesc || groupDescription || '');

  return {
    displayName,
    displayDesc,
    isLoading,
  };
}
