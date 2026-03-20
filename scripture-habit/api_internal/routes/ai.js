import express from 'express';
import { admin, db } from '../lib/firebase-admin.js';
import { aiLimiter, verifyAppCheck, authenticate } from '../lib/middleware.js';
import { ponderQuestionsSchema, translateSchema, weeklyRecapSchema, personalRecapSchema, languageNames } from '../lib/schemas.js';
import axios from 'axios';
import crypto from 'crypto';

const router = express.Router();

/**
 * --- AI Helper ---
 * Unified Gemini API call logic.
 */
const callGemini = async (prompt) => {
    if (!process.env.GEMINI_API_KEY) throw new Error('Gemini API Key missing');
    
    // Using the user-requested gemini-2.5-flash model
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const response = await axios.post(apiUrl, { 
        contents: [{ parts: [{ text: prompt }] }] 
    });

    const generatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!generatedText) throw new Error('AI failed to generate a response');
    
    return generatedText.trim();
};

const handleAiError = (res, err, contextMessage) => {
    console.error(`[AI Error] ${contextMessage}:`, err.response?.data || err.message);
    res.status(500).json({ 
        error: `AI ${contextMessage} failed`, 
        details: err.response?.data?.error?.message || err.message 
    });
};

// --- Routes ---

/**
 * AI Ponder Questions
 */
router.post('/generate-ponder-questions', authenticate, aiLimiter, verifyAppCheck, async (req, res) => {
    const validation = ponderQuestionsSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });
    
    const { scripture, chapter, language } = validation.data;
    const baseLang = language?.split('-')[0] || 'en';
    const targetLangName = languageNames[baseLang] || 'English';

    try {
        const prompt = `You are a warm, encouraging scripture study facilitator who loves to help people apply the gospel to their daily lives.
            Based on the scripture: ${scripture} ${chapter}, provide ONE simple, clear, and easy-to-understand question.
            
            【STRICT RULES】:
            1. You MUST respond ONLY in ${targetLangName}.
            2. The question should be easy for everyone (including children and new students) to think about. NO academic or difficult theological terms.
            3. Focus on "Personal Application" (How does this part apply to your life today?).
            4. Output ONLY the question text as plain text. No bullet points or markers.`;

        const result = await callGemini(prompt);
        res.json({ success: true, questions: result });
    } catch (err) {
        handleAiError(res, err, 'ponder questions');
    }
});

/**
 * AI Translation
 */
router.post('/translate', authenticate, aiLimiter, verifyAppCheck, async (req, res) => {
    const validation = translateSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: 'Invalid input' });
    
    const { text, targetLanguage } = validation.data;

    try {
        const cacheKey = crypto.createHash('md5').update(`${text}_${targetLanguage}`).digest('hex');
        const cacheRef = db.collection('translation_cache').doc(cacheKey);
        const cacheDoc = await cacheRef.get();
        if (cacheDoc.exists) return res.json({ translatedText: cacheDoc.data().translatedText });

        const targetLangName = languageNames[targetLanguage] || targetLanguage;
        const prompt = `Task: Translate the following text into ${targetLangName}. Output only the translated text. No explanations.\n\nText:\n"""\n${text}\n"""`;
        
        const resultText = await callGemini(prompt);
        // Clean result in case of markdown or quotes
        const cleanedText = resultText.replace(/<translation>|<\/translation>/gi, '').replace(/^.*?translation.*?:/i, '').replace(/^["'](.*)["']$/g, '$1').trim();

        if (!cleanedText) throw new Error('AI blocked response');

        cacheRef.set({ originalText: text, translatedText: cleanedText, targetLanguage, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        res.json({ success: true, translatedText: cleanedText });
    } catch (err) {
        handleAiError(res, err, 'translation');
    }
});

/**
 * AI Weekly Recap
 */
router.post('/generate-weekly-recap', authenticate, aiLimiter, verifyAppCheck, async (req, res) => {
    const validation = weeklyRecapSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: 'Invalid input' });

    const { groupId, language } = validation.data;
    const baseLang = language?.split('-')[0] || 'en';
    const targetLangName = languageNames[baseLang] || 'English';
    const uid = req.user.uid;

    try {
        const groupRef = db.collection('groups').doc(groupId);
        const gSnap = await groupRef.get();
        if (!gSnap.exists || !(gSnap.data().members || []).includes(uid)) return res.status(404).send('Access denied');

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const snapshot = await groupRef.collection('messages')
            .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(sevenDaysAgo))
            .limit(60).get();

        const notes = [];
        snapshot.forEach(d => { if (d.data().isNote || d.data().isEntry) notes.push(d.data().text); });
        if (notes.length === 0) return res.json({ message: 'No notes found for this week.' });

        const prompt = `Task: Summarize these anonymous scripture study notes into an encouraging weekly reflection for a group.
            Notes: ${notes.join('\n\n')}
            
            【STRICT RULES】:
            1. You MUST respond ONLY in ${targetLangName}.
            2. Keep the tone encouraging, warm, and spiritually uplifting.`;
            
        const generatedText = await callGemini(prompt);

        await groupRef.collection('messages').add({
            text: generatedText,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            senderId: 'system',
            isSystemMessage: true,
            messageType: 'weeklyRecap'
        });

        res.json({ success: true, recap: generatedText });
    } catch (err) {
        handleAiError(res, err, 'weekly recap');
    }
});

/**
 * AI Discussion Starter
 */
router.post('/generate-discussion-topic', authenticate, aiLimiter, verifyAppCheck, async (req, res) => {
    const { language } = req.body;
    const baseLang = language?.split('-')[0] || 'en';
    const targetLangName = languageNames[baseLang] || 'English';

    try {
        const prompt = `You are a facilitator for a scripture study group. 
            Suggest 1 discussion starter question that encourages members to share their experiences and testimonies. 
            
            【STRICT RULES】:
            1. You MUST respond ONLY in ${targetLangName}.
            2. Output ONLY the question text. No bullet points.`;

        const generatedText = await callGemini(prompt);
        res.json({ success: true, topic: generatedText });
    } catch (err) {
        handleAiError(res, err, 'discussion topic');
    }
});

/**
 * AI Personal Weekly Recap
 */
router.post('/generate-personal-weekly-recap', authenticate, aiLimiter, verifyAppCheck, async (req, res) => {
    const validation = personalRecapSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: 'Invalid input' });

    const { uid, language } = validation.data;
    const baseLang = language?.split('-')[0] || 'en';
    const targetLangName = languageNames[baseLang] || 'English';

    try {
        if (req.user.uid !== uid) return res.status(403).send('Forbidden');

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const snapshot = await db.collection('users').doc(uid).collection('notes')
            .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(sevenDaysAgo))
            .limit(60).get();

        const notes = [];
        snapshot.forEach(d => { if (d.data().text || d.data().comment) notes.push(d.data().comment || d.data().text); });
        if (notes.length === 0) return res.json({ message: 'No personal notes found for this week.' });

        const prompt = `Task: Write a warm personal letter summarizing these study notes and encouraging the user. 
            Start with "Dear Friend" (or the equivalent in the output language).
            Notes: ${notes.join('\n\n')}
            
            【STRICT RULES】:
            1. You MUST respond ONLY in ${targetLangName}.`;

        const generatedText = await callGemini(prompt);

        res.json({ success: true, recap: generatedText });
    } catch (err) {
        handleAiError(res, err, 'personal recap');
    }
});

export default router;
