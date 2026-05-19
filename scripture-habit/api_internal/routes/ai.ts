import express, { Response } from 'express';
import { admin, db } from '../lib/firebase-admin.js';
import { aiLimiter, verifyAppCheck, authenticate, AuthenticatedRequest } from '../lib/middleware.js';
import { ponderQuestionsSchema, translateSchema, translateBatchSchema, personalRecapSchema, languageNames } from '../lib/schemas.js';
import axios from 'axios';
import crypto from 'crypto';
import * as Sentry from "@sentry/node";

const router = express.Router();

router.use((req, _res, next) => {
    console.log(`[AI Route] ${req.method} ${req.path}`);
    next();
});

/**
 * --- AI Helper ---
 * Unified Gemini API call logic.
 */
const callGemini = async (prompt: string): Promise<string> => {
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
    }, { timeout: 30000 }); // 30s timeout

    const candidate = response.data?.candidates?.[0];
    
    // Check for safety blocks
    if (candidate?.finishReason === 'SAFETY') {
        throw new Error('AI content blocked by safety filters');
    }

    const generatedText = candidate?.content?.parts?.[0]?.text;
    if (!generatedText) {
        console.error('[AI] Empty response. Full body:', JSON.stringify(response.data));
        throw new Error('AI failed to generate a response');
    }
    
    return generatedText.trim();
};

const handleAiError = (res: Response, err: unknown, contextMessage: string) => {
    // Safely extract error body without circular references
    const axiosErr = err as { response?: { data?: unknown, status?: number }, message?: string };
    const errorBody = axiosErr.response?.data || axiosErr.message || String(err);
    console.error(`[AI Error] ${contextMessage}:`, errorBody);
    
    const status = axiosErr.response?.status || 500;

    // Capture specific AI error details in Sentry
    Sentry.captureException(err, {
        tags: { context: contextMessage, ai_status: status },
        extra: { errorBody }
    });

    res.status(status).json({
        error: `AI ${contextMessage} failed`,
        details: typeof errorBody === 'string' ? errorBody : (axiosErr.message || 'Unknown error')
    });
};

const withTimeout = <T>(promise: Promise<T>, ms: number, errorMessage = 'Timeout'): Promise<T> => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(errorMessage)), ms);
        promise
            .then(res => {
                clearTimeout(timer);
                resolve(res);
            })
            .catch(err => {
                clearTimeout(timer);
                reject(err);
            });
    });
};

// --- Routes ---

/**
 * AI Ponder Questions
 */
router.post('/generate-ponder-questions', authenticate, aiLimiter, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    const validation = ponderQuestionsSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });
    
    const { scripture, chapter, language } = validation.data;
    const baseLang = language?.split('-')[0] || 'en';
    const targetLangName = languageNames[baseLang] || 'English';

    if (process.env.SKIP_AI === 'true') {
        return res.json({ success: true, questions: "Mocked Study Question" });
    }

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
router.post('/translate', authenticate, aiLimiter, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    const validation = translateSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: 'Invalid input' });
    
    const { text, targetLanguage, messageId, groupId, updateType, force } = validation.data;

    if (process.env.SKIP_AI === 'true') {
        return res.json({ success: true, translatedText: text });
    }

    try {
        const typeStr = updateType || 'normal';
        const cacheKey = crypto.createHash('md5').update(`${text}_${targetLanguage}_${typeStr}`).digest('hex');
        let translatedText: string | null = null;
        
        // Only use cache if DB is available and not in a hanging state (simple check)
        const canUseCache = db && (process.env.NODE_ENV !== 'test' || process.env.FIRESTORE_EMULATOR_HOST);

        const cacheRef = db ? db.collection('translation_cache').doc(cacheKey) : null;
        if (canUseCache && !force && cacheRef) {
            try {
                const cacheDoc = await withTimeout(cacheRef.get(), 5000, 'Firestore timeout');
                if (cacheDoc && 'exists' in cacheDoc && cacheDoc.exists) {
                    translatedText = cacheDoc.data()?.translatedText;
                }
            } catch (cacheErr) {
                console.warn('[AI Cache] Bypassing cache due to error or timeout:', (cacheErr as Error).message);
            }
        }

        if (!translatedText) {
            const targetLangName = languageNames[targetLanguage] || targetLanguage;
            
            let prompt = `Task: Translate the following study note into ${targetLangName}. 
            【STRICT RULES】:
            1. If the text is a structured note with labels like **Category:**, **Chapter:** and **Comment:** (or their equivalents), you MUST preserve this exact markdown structure.
            2. Translate EVERYTHING, including the values for 'Category', 'Chapter', 'Title', and 'Talk' fields.
               - For scripture references, translate the book names to ${targetLangName} (e.g., '1 Nefi' -> '1 Nephi', 'マタイ' -> 'Matthew') but keep the chapter/verse numbers as-is.
               - If the value is a URL, keep it exactly as-is.
            3. For the labels themselves, use these standard labels in ${targetLangName}:
               - English: **Category:**, **Chapter:**, **Comment:**, **Title:**, **Talk:**, **Speech:**
               - Japanese: **カテゴリ:**, **章:**, **コメント:**, **タイトル:**, **お話:**, **スピーチ:**
            4. Each label and its value MUST be on its own line. NEVER merge them into a single line.
            5. ALWAYS use bold markdown for labels: **Label:**
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

            // If it's a group name or description, we use a plain translation prompt to avoid unwanted formatting
            if (updateType === 'group_name' || updateType === 'group_description') {
                const itemType = updateType === 'group_name' ? 'name' : 'description';
                prompt = `Task: Translate the following group ${itemType} into ${targetLangName}.
                【STRICT RULES】:
                1. Output ONLY the translated plain text.
                2. DO NOT add any labels, bold markers, or decorative symbols.
                3. If the name is a proper noun that is commonly used in its original form in ${targetLangName}, you may keep it or provide the standard localized version.
                
                Text to translate:
                """
                ${text}
                """`;
            }
            
            const resultText = await callGemini(prompt);
            translatedText = resultText.replace(/<translation>|<\/translation>/gi, '').replace(/^.*?translation.*?:/i, '').replace(/^["'](.*)["']$/g, '$1').trim();
            
            if (!translatedText) throw new Error('AI blocked response');
            
            // Persist to cache if DB is healthy
            if (canUseCache && cacheRef) {
                const savePromise = cacheRef.set({ originalText: text, translatedText, targetLanguage, createdAt: admin.firestore.FieldValue.serverTimestamp() }).catch(e => {
                    console.warn('[AI Cache] Failed to save to cache:', e.message);
                });
                if (process.env.NODE_ENV === 'test') {
                    await savePromise;
                }
            }
        }

        // If messageId and groupId are provided, persist the translation to the message document
        if (messageId && groupId && translatedText) {
            try {
                const messageRef = db.collection('groups').doc(groupId).collection('messages').doc(messageId);
                await messageRef.update({
                    [`translations.${targetLanguage}`]: translatedText
                });
            } catch (updateErr: unknown) {
                const error = updateErr as Error;
                console.error('[AI Error] Failed to update message with translation:', error.message);

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
            } catch (groupUpdateErr: unknown) {
                const error = groupUpdateErr as Error;
                console.error(`[AI Error] Failed to update group metadata (${updateType}):`, error.message);

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
router.post('/translate-batch', authenticate, aiLimiter, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    const validation = translateBatchSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: 'Invalid input', details: validation.error.format() });
    
    const { messages, targetLanguage, groupId, force } = validation.data;
    const finalResults: Record<string, string> = {};
    const toTranslate: Array<{ id: string; text: string }> = [];

    if (process.env.SKIP_AI === 'true') {
        messages.forEach(m => { finalResults[m.id] = m.text; });
        return res.json({ success: true, translations: finalResults });
    }


    // 1. Check cache for each message in parallel (Skip if force=true)
    if (!force && db && (process.env.NODE_ENV !== 'test' || process.env.FIRESTORE_EMULATOR_HOST)) {
        try {
            const cachePromises = messages.map(async (msg) => {
                const cacheKey = crypto.createHash('md5').update(`${msg.text}_${targetLanguage}_normal`).digest('hex');
                const cacheRef = db.collection('translation_cache').doc(cacheKey);
                try {
                    const cacheDoc = await withTimeout(cacheRef.get(), 2000, 'timeout');
                    if (cacheDoc && cacheDoc.exists) {
                        return { msg, translatedText: cacheDoc.data()?.translatedText };
                    }
                } catch {
                    // Ignore individual cache errors
                }
                return { msg, translatedText: null };
            });
            
            const cacheResults = await Promise.all(cachePromises);
            for (const result of cacheResults) {
                if (result.translatedText) {
                    finalResults[result.msg.id] = result.translatedText;
                } else {
                    toTranslate.push(result.msg);
                }
            }
        } catch {
            toTranslate.push(...messages);
        }
    } else {
        toTranslate.push(...messages);
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

        // 4. Update results, cache, and Firestore (Best effort)
        if (db) {
            const batch = db.batch();
            for (const msg of toTranslate) {
                const translated = batchTranslations[msg.id];
                if (translated) {
                    finalResults[msg.id] = translated;
                    
                    // Cache
                    const cacheKey = crypto.createHash('md5').update(`${msg.text}_${targetLanguage}_normal`).digest('hex');
                    const cacheRef = db.collection('translation_cache').doc(cacheKey);
                    batch.set(cacheRef, { originalText: msg.text, translatedText: translated, targetLanguage, createdAt: admin.firestore.FieldValue.serverTimestamp() });
                    
                    // Message Persistence
                    const messageRef = db.collection('groups').doc(groupId).collection('messages').doc(msg.id);
                    batch.set(messageRef, { 
                        translations: { [targetLanguage]: translated } 
                    }, { merge: true });
                }
            }
            await withTimeout(batch.commit(), 5000, 'Persistence timeout')
                .catch(e => console.warn('[AI Batch] Persistence failed:', e.message));
        } else {
            // If no DB, just populate finalResults from batchTranslations
            for (const msg of toTranslate) {
                if (batchTranslations[msg.id]) finalResults[msg.id] = batchTranslations[msg.id];
            }
        }

        res.json({ success: true, translations: finalResults });
    } catch (err) {
        handleAiError(res, err, 'batch translation');
    }
});


/**
 * AI Discussion Starter
 */
router.post('/generate-discussion-topic', authenticate, aiLimiter, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    const { language, groupId } = req.body;
    const baseLanguage = language?.split('-')[0] || 'en';
    const targetLangName = languageNames[baseLanguage] || 'English';

    if (process.env.SKIP_AI === 'true') {
        return res.json({ success: true, topic: "Mocked Discussion Topic" });
    }

    try {
        let context = '';
        if (groupId) {
            const recentNotesSnap = await db.collection('groups').doc(groupId).collection('messages')
                .where('isNote', '==', true)
                .orderBy('createdAt', 'desc')
                .limit(3)
                .get();
            
            const noteTexts = recentNotesSnap.docs.map(d => d.data().text).filter(Boolean);
            if (noteTexts.length > 0) {
                context = `Recent study context: ${noteTexts.join('\n')}`;
            }
        }

        const prompt = `You are a facilitator for a scripture study group. 
            Suggest 1 discussion starter question that encourages members to share their experiences and testimonies. 
            ${context ? `Base it loosely on this recent study: ${context}` : ''}
            
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
router.post('/generate-personal-weekly-recap', authenticate, aiLimiter, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    const validation = personalRecapSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: 'Invalid input' });

    const { uid, language } = validation.data;
    const baseLang = language?.split('-')[0] || 'en';
    const targetLangName = languageNames[baseLang] || 'English';

    if (process.env.SKIP_AI === 'true') {
        return res.json({ success: true, recap: "Mocked Personal Recap" });
    }

    try {
        if (req.user?.uid !== uid) return res.status(403).send('Forbidden');

        const userRef = db.collection('users').doc(uid);
        const uSnap = await userRef.get();
        if (!uSnap.exists) return res.status(404).send('User not found');
        const uData = uSnap.data() || {};

        // Prevent duplicate generations (6-day cooldown).
        // If a recap was already generated recently, we return the cached recent recap
        // instead of throwing a 429 error, which allows the user to recover in case of
        // network timeouts or accidental closures.
        if (uData.lastRecapGeneratedAt) {
            const lastDate = (uData.lastRecapGeneratedAt as admin.firestore.Timestamp).toDate();
            const sixDaysAgo = new Date();
            sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
            if (lastDate > sixDaysAgo) {
                try {
                    const recentRecapSnap = await userRef.collection('recaps')
                        .orderBy('createdAt', 'desc')
                        .limit(1)
                        .get();
                    if (!recentRecapSnap.empty) {
                        const recentRecapData = recentRecapSnap.docs[0].data();
                        const recapDate = (recentRecapData.createdAt as admin.firestore.Timestamp).toDate();
                        if (recapDate > sixDaysAgo && recentRecapData.text) {
                            return res.json({
                                success: true,
                                recap: recentRecapData.text,
                                message: 'Returned cached recent recap.',
                                fromCache: true
                            });
                        }
                    }
                } catch (cacheErr) {
                    console.warn('[AI Personal Recap] Failed to retrieve cached recap:', cacheErr);
                }
                return res.status(429).json({ error: 'Personal recap already generated recently. Please wait a week.' });
            }
        }

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const notesQuery = userRef.collection('notes')
            .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(sevenDaysAgo))
            .orderBy('createdAt', 'asc')
            .limit(100)
            .get();
        const snapshot = await withTimeout(notesQuery, 8000, 'Firestore timeout');

        if (!snapshot) throw new Error('Failed to fetch personal notes');

        const notes: string[] = [];
        (snapshot as admin.firestore.QuerySnapshot).forEach(d => { 
            const data = d.data();
            const content = data.comment || data.text;
            if (content) {
                // Truncate individual notes to prevent prompt overflow
                const truncated = content.length > 1000 ? content.substring(0, 1000) + '...' : content;
                notes.push(truncated); 
            }
        });

        if (notes.length === 0) return res.json({ message: 'No personal notes found for this week.' });

        const prompt = `Task: Write a warm personal letter summarizing these study notes and encouraging the user. 
            Start with "Dear Friend" (or the equivalent in the output language).
            Notes: ${notes.join('\n\n')}
            
            【STRICT RULES】:
            1. You MUST respond ONLY in ${targetLangName}.`;

        const generatedText = await callGemini(prompt);

        // Best effort persistence
        try {
            const persistTask = (async () => {
                const recapRef = db.collection('users').doc(uid).collection('recaps').doc();
                await recapRef.set({
                    text: generatedText,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    type: 'weekly_encouragement'
                });
                await db.collection('users').doc(uid).update({
                    lastRecapGeneratedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            })();
            await withTimeout(persistTask, 8000, 'Persistence timeout');
        } catch (e) {
            console.warn('[AI Personal Recap] Failed to persist:', (e as Error).message);
        }

        res.json({ success: true, recap: generatedText });
    } catch (err) {
        handleAiError(res, err, 'personal recap');
    }
});

export default router;
