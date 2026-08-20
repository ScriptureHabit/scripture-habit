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
  const isDemoGroup = Boolean(group?.isDemoGroup);
  const firestoreTrans = groupTranslations?.[language];

  const isDefaultAiName = !groupName || groupName === 'スクハビAI' || groupName === 'Scripture Habit AI' || groupName === t('groupChat.aiGroupDefaultGroupName');
  const isDefaultDemoName = !groupName || groupName === '日々の糧 📖' || groupName === 'Daily Bread 📖' || groupName === t('onboardingQuest.demoGroupName');
  const isDefaultAiDesc = !groupDescription || groupDescription === '1-on-1 Scripture Study Group with Scripture Habit AI' || groupDescription.includes('1-on-1') || groupDescription === t('groupChat.aiGroupDefaultGroupDesc');
  const isDefaultDemoDesc = !groupDescription || groupDescription === '毎日一緒に聖典を読み合う、温かい学習グループです！✨' || groupDescription === t('onboardingQuest.demoGroupDesc');

  const cacheKeyName = groupId && language ? `trans_name_${groupId}_${language}` : '';
  const cacheKeyDesc = groupId && language ? `trans_desc_${groupId}_${language}` : '';

  const cachedName = cacheKeyName ? sessionStorage.getItem(cacheKeyName) || '' : '';
  const cachedDesc = cacheKeyDesc ? sessionStorage.getItem(cacheKeyDesc) || '' : '';

  const isNameAlreadyTargetLang = groupName ? isLikelyAlreadyInLanguage(groupName, language) : true;
  const isDescAlreadyTargetLang = groupDescription ? isLikelyAlreadyInLanguage(groupDescription, language) : true;

  const hasFirestoreName = Boolean(firestoreTrans?.name);
  const hasFirestoreDesc = Boolean(firestoreTrans?.description);

  const needsNameTrans = !hasFirestoreName && !cachedName && !!groupName && !isNameAlreadyTargetLang && !(isAiGroup && isDefaultAiName) && !(isDemoGroup && isDefaultDemoName);
  const needsDescTrans = shouldTranslateDesc && !hasFirestoreDesc && !cachedDesc && !!groupDescription && !isDescAlreadyTargetLang && !(isAiGroup && isDefaultAiDesc) && !(isDemoGroup && isDefaultDemoDesc);

  useEffect(() => {
    if (!groupId || !language || (!needsNameTrans && !needsDescTrans)) {
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

  const displayName = firestoreTrans?.name || (
    isAiGroup && isDefaultAiName
      ? t('groupChat.aiGroupDefaultGroupName')
      : isDemoGroup && isDefaultDemoName
      ? t('onboardingQuest.demoGroupName')
      : cachedName || asyncName || groupName || ''
  );

  const displayDesc = firestoreTrans?.description || (
    isAiGroup && isDefaultAiDesc
      ? t('groupChat.aiGroupDefaultGroupDesc')
      : isDemoGroup && isDefaultDemoDesc
      ? t('onboardingQuest.demoGroupDesc')
      : cachedDesc || asyncDesc || groupDescription || ''
  );

  return {
    displayName,
    displayDesc,
    isLoading,
  };
}
