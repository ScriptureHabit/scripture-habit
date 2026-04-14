import { useState } from 'react';
import apiClient from '../../../../utils/api-client';
import { toast } from 'react-toastify';
import { GroupData } from '../../../../types/chat';
import { parseTimestampToDate } from '../../../../utils/time-utils';

export const useRecapManager = (
  groupId: string,
  groupData: GroupData | null,
  language: string,
  t: (key: string) => string
) => {
  const [isRecapLoading, setIsRecapLoading] = useState(false);

  const handleGenerateWeeklyRecap = async () => {
    if (isRecapLoading) return;
    setIsRecapLoading(true);
    try {
      await apiClient.post('/api/generate-weekly-recap', { groupId, language });

      toast.success(t('groupChat.recapGenerated') || "Weekly recap generated!");
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }, message: string };
      console.error("Error generating recap:", err.message);
      const errorMessage = err.response?.data?.error || t('groupChat.errorGenerateRecap');
      toast.error(errorMessage);

    } finally {
      setIsRecapLoading(false);
    }
  };

  const getLastRecapDate = () => {
    if (!groupData?.lastRecapGeneratedAt) return null;
    return parseTimestampToDate(groupData.lastRecapGeneratedAt);
  };

  const lastRecapDate = getLastRecapDate();
  const daysSinceLastRecap = lastRecapDate ? (new Date().getTime() - lastRecapDate.getTime()) / (1000 * 60 * 60 * 24) : 100;
  const isRecapAvailable = daysSinceLastRecap >= 7;

  return { isRecapLoading, isRecapAvailable, daysSinceLastRecap, handleGenerateWeeklyRecap };
};
