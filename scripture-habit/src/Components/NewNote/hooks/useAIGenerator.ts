import { useState } from 'react';
import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import { auth } from '../../../firebase';
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
            const API_BASE = Capacitor.isNativePlatform() ? 'https://scripturehabit.app' : '';

            const response = await axios.post(`${API_BASE}/api/generate-ponder-questions`, {
                scripture,
                chapter,
                language: language || 'en'
            }, {
                headers: {
                    'Authorization': `Bearer ${idToken}`
                }
            });

            if (response.data && response.data.questions) {
                setAiQuestion(response.data.questions);
            }
        } catch (error: any) {
            console.error("Error generating AI questions:", error);
            const errorMsg = error.response?.data?.details || error.message;
            toast.error(`Failed to generate AI questions: ${errorMsg}`);
        } finally {
            setAiLoading(false);
        }
    };

    return { aiQuestion, setAiQuestion, aiLoading, handleGenerateQuestions };
};
