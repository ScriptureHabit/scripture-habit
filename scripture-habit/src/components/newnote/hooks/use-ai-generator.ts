import { useState } from 'react';
import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import { auth, appCheck } from '../../../firebase';
import { getToken } from 'firebase/app-check';
import { toast } from 'react-toastify';

export const useAIGenerator = (language: string | null) => {
    const [aiQuestion, setAiQuestion] = useState<string>('');
    const [aiLoading, setAiLoading] = useState<boolean>(false);

    const handleGenerateQuestions = async (scripture: string, chapter: string) => {
        if (!scripture || !chapter) return;
        setAiLoading(true);
        try {
            const user = auth?.currentUser;
            if (!user) throw new Error("No user logged in");
            const idToken = await user.getIdToken(true);
            let appCheckToken = '';
            if (appCheck) {
                const acTokenResponse = await getToken(appCheck, false).catch(() => null);
                if (acTokenResponse) {
                    appCheckToken = acTokenResponse.token;
                }
            }
            const API_BASE = Capacitor.isNativePlatform() ? 'https://scripturehabit.app' : '';
            
            const headers: Record<string, string> = {
                'Authorization': `Bearer ${idToken}`
            };
            if (appCheckToken) {
                headers['X-Firebase-AppCheck'] = appCheckToken;
            }

            const response = await axios.post(`${API_BASE}/api/ai/generate-ponder-questions`, {
                scripture,
                chapter,
                language: language || 'en'
            }, {
                headers
            });

            if (response.data && response.data.questions) {
                setAiQuestion(response.data.questions);
            }
        } catch (error: unknown) {
            console.error("Error generating AI questions:", error);
            let errorMsg = 'Unknown error';
            if (axios.isAxiosError(error)) {
                errorMsg = error.response?.data?.details || error.message;
            } else if (error instanceof Error) {
                errorMsg = error.message;
            }
            toast.error(`Failed to generate AI questions: ${errorMsg}`);
        } finally {
            setAiLoading(false);
        }
    };

    return { aiQuestion, setAiQuestion, aiLoading, handleGenerateQuestions };
};
