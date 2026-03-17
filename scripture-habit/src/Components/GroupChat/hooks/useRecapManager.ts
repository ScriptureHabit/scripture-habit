import { useState } from 'react';
import { auth } from '../../../firebase';
import { toast } from 'react-toastify';
import { GroupData } from '../../../types/chat';

export const useRecapManager = (
  groupId: string,
  groupData: GroupData | null,
  API_BASE: string,
  language: string,
  t: (key: string) => string
) => {
  const [isRecapLoading, setIsRecapLoading] = useState(false);

  const handleGenerateWeeklyRecap = async () => {
    if (isRecapLoading) return;
    setIsRecapLoading(true);
    try {
      const idToken = await auth?.currentUser?.getIdToken();
      const response = await fetch(`${API_BASE}/api/generate-weekly-recap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ groupId, language })
      });

      if (response.ok) {
        toast.success(t('groupChat.recapGenerated') || "Weekly recap generated!");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to generate recap");
      }
    } catch (error) {
      console.error("Error generating recap:", error);
      toast.error(t('groupChat.errorGenerateRecap'));
    } finally {
      setIsRecapLoading(false);
    }
  };

  const getLastRecapDate = () => {
    if (groupData?.lastRecapGeneratedAt?.toDate) return groupData.lastRecapGeneratedAt.toDate();
    if (groupData?.lastRecapGeneratedAt?.seconds) return new Date(groupData.lastRecapGeneratedAt.seconds * 1000);
    return null;
  };

  const lastRecapDate = getLastRecapDate();
  const daysSinceLastRecap = lastRecapDate ? (new Date().getTime() - lastRecapDate.getTime()) / (1000 * 60 * 60 * 24) : 100;
  const isRecapAvailable = daysSinceLastRecap >= 7;

  return { isRecapLoading, isRecapAvailable, daysSinceLastRecap, handleGenerateWeeklyRecap };
};
