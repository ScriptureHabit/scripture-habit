import express from 'express';
import { admin, db } from '../lib/firebase-admin.js';
import { aiLimiter, verifyAppCheck, authenticate } from '../lib/middleware.js';
import { ponderQuestionsSchema, translateSchema, translateBatchSchema, weeklyRecapSchema, personalRecapSchema, languageNames } from '../lib/schemas.js';
import axios from 'axios';
import crypto from 'crypto';

const router = express.Router();

/**
 * --- AI Helper ---
 * Unified Gemini API call logic.
 */
const callGemini = async (prompt) => {
    if (!process.env.GEMINI_API_KEY) throw new Error('Gemini API Key missing');
    
    // Using the Gemini 3.1 Flash-Lite Preview model with minimal thinking for best speed/cost
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const response = await axios.post(apiUrl, { 
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            thinkingConfig: {
                thinkingLevel: "minimal"
            }
        }
    });

    const generatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!generatedText) throw new Error('AI failed to generate a response');
    
    return generatedText.trim();
};

const handleAiError = (res, err, contextMessage) => {
    const errorBody = err.response?.data || err.message;
    console.error(`[AI Error] ${contextMessage}:`, errorBody);
    if (err.response?.status === 400) {
        return res.status(400).json({ error: `AI ${contextMessage} bad request`, details: errorBody });
    }
    res.status(500).json({ 
        error: `AI ${contextMessage} failed`, 
        details: typeof errorBody === 'string' ? errorBody : JSON.stringify(errorBody)
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
    
    const { text, targetLanguage, messageId, groupId, updateType, force } = validation.data;

    try {
        const cacheKey = crypto.createHash('md5').update(`${text}_${targetLanguage}`).digest('hex');
        const cacheRef = db.collection('translation_cache').doc(cacheKey);
        const cacheDoc = await cacheRef.get();
        
        let translatedText = null;
        if (cacheDoc.exists && !force) {
            translatedText = cacheDoc.data().translatedText;
        } else {
            const targetLangName = languageNames[targetLanguage] || targetLanguage;
            const prompt = `Task: Translate the following text into ${targetLangName}. 
            【STRICT RULES】:
            1. If the text is a structured note with labels like **Category:**, **Chapter:** and **Comment:** (or their equivalents), you MUST preserve this exact markdown structure.
            2. Translate the labels themselves into ${targetLangName} (e.g., use **カテゴリ:** for Japanese, **Category:** for English, **Escritura:** for Portuguese).
            3. Each label and its value MUST be on its own line. NEVER merge them into a single line.
            4. ALWAYS use bold markdown for labels: **Label:**
            5. Keep all line breaks exactly as they appear in the original.
            6. Output ONLY the translated content.

            Example structure (MANDATORY):
            **Category:** [Translated Name]
            **Chapter:** [Translated Chapter]

            **Comment:**
            [Translated Text]

            Text:
            """
            ${text}
            """`;
            
            const resultText = await callGemini(prompt);
            translatedText = resultText.replace(/<translation>|<\/translation>/gi, '').replace(/^.*?translation.*?:/i, '').replace(/^["'](.*)["']$/g, '$1').trim();
            
            if (!translatedText) throw new Error('AI blocked response');
            
            await cacheRef.set({ originalText: text, translatedText, targetLanguage, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        }

        // If messageId and groupId are provided, persist the translation to the message document
        if (messageId && groupId && translatedText) {
            try {
                const messageRef = db.collection('groups').doc(groupId).collection('messages').doc(messageId);
                await messageRef.update({
                    [`translations.${targetLanguage}`]: translatedText
                });
            } catch (updateErr) {
                console.error('[AI Error] Failed to update message with translation:', updateErr.message);
                // We still return the translation even if persistent storage fails
            }
        }


        // If it's a group-level metadata (name/desc), persist to the group doc in backend
        if (groupId && translatedText && updateType) {
            try {
                const groupRef = db.collection('groups').doc(groupId);
                const field = updateType === 'group_name' ? 'name' : 'description';
                await groupRef.update({
                    [`translations.${targetLanguage}.${field}`]: translatedText
                });
            } catch (groupUpdateErr) {
                console.error(`[AI Error] Failed to update group metadata (${updateType}):`, groupUpdateErr.message);
            }
        }

        res.json({ success: true, translatedText });
    } catch (err) {
        handleAiError(res, err, 'translation');
    }
});

/**
 * AI Batch Translation
 */
router.post('/translate-batch', authenticate, aiLimiter, verifyAppCheck, async (req, res) => {
    const validation = translateBatchSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });
    
    const { messages, targetLanguage, groupId } = validation.data;
    const finalResults = {};
    const toTranslate = [];

    // 1. Check cache for each message
    for (const msg of messages) {
        const cacheKey = crypto.createHash('md5').update(`${msg.text}_${targetLanguage}`).digest('hex');
        const cacheRef = db.collection('translation_cache').doc(cacheKey);
        const cacheDoc = await cacheRef.get();
        if (cacheDoc.exists) {
            finalResults[msg.id] = cacheDoc.data().translatedText;
        } else {
            toTranslate.push(msg);
        }
    }

    // 2. If everything was cached, return early
    if (toTranslate.length === 0) return res.json({ success: true, translations: finalResults });

    // 3. Batch translate the rest
    try {
        const targetLangName = languageNames[targetLanguage] || targetLanguage;
        const prompt = `Task: Translate these message items into ${targetLangName}.
            【STRICT RULES】:
            1. Preserve the exact markdown structure, especially bold labels like **Category:** or **Comment:**.
            2. Translate the labels themselves into ${targetLangName}.
            3. Output ONLY a valid JSON object mapping IDs to their translations. NO markdown backticks or extra text.
            
            Format: {"msg_id": "translated_text", ...}
            
            Messages:
            ${JSON.stringify(toTranslate.map(m => ({ id: m.id, text: m.text })))} `;
        
        const resultRaw = await callGemini(prompt);
        // Robust JSON cleaning: Find first { and last }
        const jsonStart = resultRaw.indexOf('{');
        const jsonEnd = resultRaw.lastIndexOf('}');
        if (jsonStart === -1 || jsonEnd === -1) {
            console.error('[AI Batch] Invalid JSON response:', resultRaw);
            throw new Error('AI returned invalid JSON format');
        }
        const cleanedJson = resultRaw.substring(jsonStart, jsonEnd + 1);
        const batchTranslations = JSON.parse(cleanedJson);

        // 4. Update results, cache, and Firestore
        const batch = db.batch();
        for (const msg of toTranslate) {
            const translated = batchTranslations[msg.id];
            if (translated) {
                finalResults[msg.id] = translated;
                
                // Cache
                const cacheKey = crypto.createHash('md5').update(`${msg.text}_${targetLanguage}`).digest('hex');
                const cacheRef = db.collection('translation_cache').doc(cacheKey);
                batch.set(cacheRef, { originalText: msg.text, translatedText: translated, targetLanguage, createdAt: admin.firestore.FieldValue.serverTimestamp() });
                
                // Message Persistence (use set with merge to avoid "document not found" errors)
                const messageRef = db.collection('groups').doc(groupId).collection('messages').doc(msg.id);
                batch.set(messageRef, { 
                    translations: { [targetLanguage]: translated } 
                }, { merge: true });
            }
        }
        await batch.commit();

        res.json({ success: true, translations: finalResults });
    } catch (err) {
        handleAiError(res, err, 'batch translation');
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
        if (!gSnap.exists || gSnap.data().ownerUserId !== uid) return res.status(403).send('Access denied: Owner only');

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

        await groupRef.update({
            lastRecapGeneratedAt: admin.firestore.FieldValue.serverTimestamp()
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
