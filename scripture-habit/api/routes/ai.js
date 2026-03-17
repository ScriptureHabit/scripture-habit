import express from 'express';
import { admin, db } from '../lib/firebase-admin.js';
import { aiLimiter, verifyAppCheck } from '../lib/middleware.js';
import { ponderQuestionsSchema, translateSchema, weeklyRecapSchema, personalRecapSchema, languageNames } from '../lib/schemas.js';
import axios from 'axios';
import crypto from 'crypto';

const router = express.Router();

// AI Ponder Questions
router.post('/generate-ponder-questions', aiLimiter, verifyAppCheck, async (req, res) => {
    const validation = ponderQuestionsSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });
    const { scripture, chapter, language } = validation.data;

    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
    const idToken = authHeader.split('Bearer ')[1];

    try {
        await admin.auth().verifyIdToken(idToken);
        if (!process.env.GEMINI_API_KEY) throw new Error('Gemini API Key missing');

        const prompts = {
            'ja': `あなたはScripture Centralの創設者であり、著名な法学者、聖典学者のJohn W. Welch教授です。原則、教えをもとに、ユーザーが知見を深めるための質問を一つだけ用意してください。箇条書きや記号は使わず、質問文のみをプレーンテキストで出力してください。聖典箇所: ${scripture} ${chapter}`,
            'en': `You are Professor John W. Welch, founder of Scripture Central and a renowned legal and biblical scholar. Provide one question based on ${scripture} ${chapter} that helps the user deepen their insight. Output ONLY the question text as plain text. No bullet points.`,
        };
        const prompt = prompts[language] || prompts['en'];

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const response = await axios.post(apiUrl, { contents: [{ parts: [{ text: prompt }] }] });

        const generatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!generatedText) throw new Error('AI failed');

        res.json({ questions: generatedText.trim() });
    } catch (err) {
        res.status(500).json({ error: 'AI failed', details: err.message });
    }
});

// AI Translation
router.post('/translate', aiLimiter, verifyAppCheck, async (req, res) => {
    const validation = translateSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: 'Invalid input' });
    const { text, targetLanguage } = validation.data;

    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const cacheKey = crypto.createHash('md5').update(`${text}_${targetLanguage}`).digest('hex');
        const cacheRef = db.collection('translation_cache').doc(cacheKey);
        const cacheDoc = await cacheRef.get();
        if (cacheDoc.exists) return res.json({ translatedText: cacheDoc.data().translatedText });

        const targetLangName = languageNames[targetLanguage] || targetLanguage;
        const prompt = `Task: Translate the following text into ${targetLangName}. Output only the translated text. No explanations.\n\nText:\n"""\n${text}\n"""`;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const response = await axios.post(apiUrl, { contents: [{ parts: [{ text: prompt }] }] });

        const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        let resultText = rawText.replace(/<translation>|<\/translation>/gi, '').replace(/^.*?translation.*?:/i, '').replace(/^["'](.*)["']$/g, '$1').trim();

        if (!resultText) throw new Error('AI blocked response');

        cacheRef.set({ originalText: text, translatedText: resultText, targetLanguage, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        res.json({ translatedText: resultText });
    } catch (err) {
        res.status(500).json({ error: 'Translation failed' });
    }
});

// AI Weekly Recap
router.post('/generate-weekly-recap', aiLimiter, verifyAppCheck, async (req, res) => {
    const validation = weeklyRecapSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: 'Invalid input' });
    const { groupId, language } = validation.data;

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const idToken = authHeader.split('Bearer ')[1];

    try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        const uid = decoded.uid;

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

        const prompt = `Summarize these anonymous scripture study notes into an encouraging weekly reflection for a group: ${notes.join('\n\n')}`;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const response = await axios.post(apiUrl, { contents: [{ parts: [{ text: prompt }] }] });

        const generatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!generatedText) throw new Error('AI recap failed');

        await groupRef.collection('messages').add({
            text: generatedText.trim(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            senderId: 'system',
            isSystemMessage: true,
            messageType: 'weeklyRecap'
        });

        res.json({ recap: generatedText.trim() });
    } catch (err) {
        res.status(500).json({ error: 'Recap failed' });
    }
});

// AI Personal Weekly Recap
router.post('/generate-personal-weekly-recap', aiLimiter, verifyAppCheck, async (req, res) => {
    const validation = personalRecapSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: 'Invalid input' });
    const { uid, language } = validation.data;

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const idToken = authHeader.split('Bearer ')[1];

    try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        if (decoded.uid !== uid) return res.status(403).send('Forbidden');

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const snapshot = await db.collection('users').doc(uid).collection('notes')
            .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(sevenDaysAgo))
            .limit(60).get();

        const notes = [];
        snapshot.forEach(d => { if (d.data().text || d.data().comment) notes.push(d.data().comment || d.data().text); });
        if (notes.length === 0) return res.json({ message: 'No personal notes found for this week.' });

        const prompt = `Write a warm personal letter (starting with "Dear Friend") summarizing these study notes and encouraging the user: ${notes.join('\n\n')}`;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const response = await axios.post(apiUrl, { contents: [{ parts: [{ text: prompt }] }] });

        const generatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        res.json({ recap: generatedText.trim() });
    } catch (err) {
        res.status(500).json({ error: 'Personal recap failed' });
    }
});

export default router;
