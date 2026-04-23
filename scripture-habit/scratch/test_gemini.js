
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const callGemini = async (prompt) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('GEMINI_API_KEY not found in .env');
        return;
    }
    
    // Model from the code
    const model = 'gemini-3.1-flash-lite-preview';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    try {
        console.log(`Calling model: ${model}`);
        const response = await axios.post(apiUrl, { 
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                thinkingConfig: {
                    thinkingLevel: "minimal"
                }
            }
        });
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error status:', error.response?.status);
        console.error('Error data:', JSON.stringify(error.response?.data, null, 2));
        console.error('Error message:', error.message);
    }
};

callGemini('Test prompt');
