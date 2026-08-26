import express, { Response } from 'express';
import { admin, db } from '../lib/firebase-admin.js';
import { aiLimiter, verifyAppCheck, authenticate, AuthenticatedRequest } from '../lib/middleware.js';
import { ponderQuestionsSchema, translateSchema, translateBatchSchema, personalRecapSchema, languageNames } from '../lib/schemas.js';
import { AppError, ValidationError, ForbiddenError, NotFoundError, sendErrorResponse } from '../lib/errors.js';
import { t } from '../lib/i18n.js';
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
    console.error('[AI Error]', contextMessage, ':', errorBody);
    
    const status = axiosErr.response?.status || 500;

    // Capture specific AI error details in Sentry
    if (process.env.SENTRY_DISABLED !== 'true' && process.env.NODE_ENV !== 'test') {
        Sentry.captureException(err, {
            tags: { context: contextMessage, ai_status: status },
            extra: { errorBody }
        });
    }

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
    try {
        const validation = ponderQuestionsSchema.safeParse(req.body);
        if (!validation.success) throw new ValidationError('Invalid input');
        
        const { scripture, chapter, language } = validation.data;
        const baseLang = language?.split('-')[0] || 'en';
        const targetLangName = languageNames[baseLang] || 'English';

        if (process.env.SKIP_AI === 'true') {
            return res.json({ success: true, questions: "Mocked Study Question" });
        }

        const prompt = `You are a warm, encouraging scripture study facilitator who loves to help people apply the gospel to their daily lives.
            Based on the scripture: ${scripture} ${chapter}, provide ONE simple, clear, and easy-to-understand question.
            
            【STRICT RULES】:
            1. You MUST respond ONLY in ${targetLangName}.
            2. The question should be easy for everyone (including children and new students) to think about. NO academic or difficult theological terms.
            3. Keep the tone warm, welcoming, and uplifting.
            4. Format as a single paragraph. Output ONLY the question itself.`;

        const questions = await withTimeout(callGemini(prompt), 15000, 'Generation timed out');
        res.json({ success: true, questions });
    } catch (err) {
        if (err instanceof ValidationError) {
            sendErrorResponse(res, err);
            return;
        }
        handleAiError(res, err, 'ponder questions');
    }
});

/**
 * AI Single Message/Metadata Translation
 */
router.post('/translate', authenticate, aiLimiter, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const validation = translateSchema.safeParse(req.body);
        if (!validation.success) throw new ValidationError('Invalid input');
        
        const { text, targetLanguage, messageId, groupId, updateType, force } = validation.data;

        if (process.env.SKIP_AI === 'true') {
            return res.json({ success: true, translatedText: text });
        }

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

            // User profile nickname or bio translation prompt
            if (updateType === 'user_nickname' || updateType === 'user_bio' || updateType === 'user_stake' || updateType === 'user_ward') {
                let itemType = 'text';
                if (updateType === 'user_nickname') itemType = 'user nickname';
                else if (updateType === 'user_bio') itemType = 'user biography (bio)';
                else if (updateType === 'user_stake') itemType = 'church stake name';
                else if (updateType === 'user_ward') itemType = 'church ward name';

                prompt = `Task: Translate the following ${itemType} into ${targetLangName}.
                【STRICT RULES】:
                1. Output ONLY the translated plain text.
                2. DO NOT add any labels, bold markers, or decorative symbols.
                3. If it is a user nickname or church stake/ward name (proper noun), provide a translation or phonetic transliteration (e.g. katakana for Japanese, English/transliterated form for others) that sounds natural in ${targetLangName}, or keep it as-is if that is more common.
                4. Maintain the tone and line breaks of the original text.
                
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
                if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
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
                console.error('[AI Error] Failed to update group metadata for type:', updateType, error.message);

            }
        }

        res.json({ success: true, translatedText });
    } catch (err) {
        if (err instanceof ValidationError) {
            sendErrorResponse(res, err);
            return;
        }
        handleAiError(res, err, 'translation');
    }
});

/**
 * AI Batch Translation
 */
router.post('/translate-batch', authenticate, aiLimiter, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const validation = translateBatchSchema.safeParse(req.body);
        if (!validation.success) throw new ValidationError('Invalid input');
        
        const { messages, targetLanguage, groupId, force } = validation.data;
        const finalResults: Record<string, string> = {};
        const toTranslate: Array<{ id: string; text: string }> = [];

        if (process.env.SKIP_AI === 'true') {
            messages.forEach(m => { finalResults[m.id] = m.text; });
            return res.json({ success: true, translations: finalResults });
        }


    // 1. Check cache for each message in batch (Skip if force=true)
    if (!force && db && (process.env.NODE_ENV !== 'test' || process.env.FIRESTORE_EMULATOR_HOST)) {
        try {
            const cacheRefs = messages.map(msg => {
                const cacheKey = crypto.createHash('md5').update(`${msg.text}_${targetLanguage}_normal`).digest('hex');
                return db.collection('translation_cache').doc(cacheKey);
            });

            // Use high-performance db.getAll with timeout wrapper to fetch all cache entries in one request
            const cacheDocs = await withTimeout(db.getAll(...cacheRefs), 4000, 'Cache fetch timeout');

            cacheDocs.forEach((doc, index) => {
                const msg = messages[index];
                if (doc && 'exists' in doc && doc.exists) {
                    finalResults[msg.id] = doc.data()?.translatedText;
                } else {
                    toTranslate.push(msg);
                }
            });
        } catch (err) {
            console.warn('[AI Batch Cache] Bypassing batch cache due to error or timeout:', (err as Error).message);
            toTranslate.push(...messages);
        }
    } else {
        toTranslate.push(...messages);
    }

    // 2. If everything was cached, return early
    if (toTranslate.length === 0) return res.json({ success: true, translations: finalResults });

    // 3. Batch translate the rest
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
    if (err instanceof ValidationError) {
        sendErrorResponse(res, err);
        return;
    }
    handleAiError(res, err, 'batch translation');
}
});

/**
 * AI Personal Weekly Recap
 */
router.post('/generate-personal-weekly-recap', authenticate, aiLimiter, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const validation = personalRecapSchema.safeParse(req.body);
        if (!validation.success) throw new ValidationError('Invalid input');

        const { uid, language } = validation.data;
        const baseLang = language?.split('-')[0] || 'en';
        const targetLangName = languageNames[baseLang] || 'English';

        if (process.env.SKIP_AI === 'true') {
            return res.json({ success: true, recap: "Mocked Personal Recap" });
        }

        if (req.user?.uid !== uid) throw new ForbiddenError('Forbidden');

        const userRef = db.collection('users').doc(uid);
        const uSnap = await userRef.get();
        if (!uSnap.exists) throw new NotFoundError('User not found');
        const uData = uSnap.data() || {};

        // Check if user has generated a letter previously
        const lastGenAt = uData.lastLetterGeneratedAt || uData.lastRecapGeneratedAt;

        if (lastGenAt) {
            // Check how many notes were posted after the last letter generation
            const newNotesQuery = userRef.collection('notes')
                .where('createdAt', '>', lastGenAt)
                .orderBy('createdAt', 'desc')
                .limit(2)
                .get();
            const newNotesSnap = await withTimeout(newNotesQuery, 8000, 'Firestore timeout');

            // If fewer than 2 new notes posted since last generation, return cached recent recap
            if (!newNotesSnap || newNotesSnap.docs.length < 2) {
                let cachedRecapText: string | null = null;
                let cachedTitle: string | null = null;
                try {
                    // 1. Try 'letters' subcollection first
                    const recentLettersSnap = await userRef.collection('letters')
                        .orderBy('createdAt', 'desc')
                        .limit(5)
                        .get();
                    const recentLetterDoc = recentLettersSnap.docs.find(d => d.data().type === 'weekly_recap' || d.data().type === 'study_letter');
                    if (recentLetterDoc) {
                        const letterData = recentLetterDoc.data();
                        if (letterData.content) {
                            cachedRecapText = letterData.content;
                            cachedTitle = letterData.title || null;
                        }
                    }

                    // 2. Fallback to 'recaps' subcollection
                    if (!cachedRecapText) {
                        const recentRecapSnap = await userRef.collection('recaps')
                            .orderBy('createdAt', 'desc')
                            .limit(1)
                            .get();
                        if (!recentRecapSnap.empty) {
                            const recentRecapData = recentRecapSnap.docs[0].data();
                            if (recentRecapData.text) {
                                cachedRecapText = recentRecapData.text;
                                cachedTitle = recentRecapData.title || null;
                            }
                        }
                    }

                    const defaultTitle = t(baseLang, 'letterBox.defaultTitle');

                    if (cachedRecapText) {
                        return res.json({
                            success: true,
                            title: cachedTitle || defaultTitle,
                            recap: cachedRecapText,
                            message: 'Returned cached recent recap.',
                            fromCache: true
                        });
                    }
                } catch (cacheErr) {
                    console.warn('[AI Personal Letter] Failed to retrieve cached recap:', cacheErr);
                }
                throw new AppError('Please post at least 2 notes to generate a new letter.', 400);
            }
        }

        // Fetch the latest 2 notes for the user
        const notesQuery = userRef.collection('notes')
            .orderBy('createdAt', 'desc')
            .limit(2)
            .get();
        const snapshot = await withTimeout(notesQuery, 8000, 'Firestore timeout');

        if (!snapshot) throw new Error('Failed to fetch personal notes');

        const notes: string[] = [];
        (snapshot as admin.firestore.QuerySnapshot).docs.reverse().forEach(d => { 
            const data = d.data();
            const content = data.comment || data.text;
            if (content) {
                let noteHeader = '';
                if (data.scripture || data.chapter || data.title || data.speaker) {
                    const parts = [data.scripture, data.chapter, data.title, data.speaker].filter(Boolean);
                    noteHeader = `[${parts.join(' - ')}]\n`;
                }
                const fullText = noteHeader + content;
                // Truncate individual notes to prevent prompt overflow
                const truncated = fullText.length > 1000 ? fullText.substring(0, 1000) + '...' : fullText;
                notes.push(truncated); 
            }
        });

        if (notes.length === 0) return res.json({ message: 'No personal notes found.' });
        if (notes.length < 2) return res.json({ message: 'Please post at least 2 notes to generate a letter.' });

        const userName = uData.nickname || uData.displayName || (baseLang === 'ja' ? 'あなた' : 'Friend');

        const prompt = `Task: Write a warm, spiritually uplifting personal reflection letter to ${userName} based on their recent study notes, and create a concise, heartwarming 1-sentence title capturing the core spiritual theme.

The letter should be structured in 3 natural, heartfelt paragraphs:
1. Warm Reflection & Empathy: Lovingly acknowledge ${userName}'s efforts, study, and the insights they felt in their notes.
2. Story & Fresh Spiritual Perspective: Connect the user's theme to a specific, inspiring story or insight from standard scriptures (Bible, Book of Mormon, Doctrine and Covenants, Pearl of Great Price) or a General Conference address/speaker. Offer a fresh, comforting, or thought-provoking angle that expands on what the user pondered, showing how a person of faith experienced or taught this truth.
3. Gentle Encouragement & Blessing: Conclude with a warm, encouraging blessing for their daily walk of faith.

Notes studied by ${userName}:
${notes.join('\n\n')}

Output MUST be a valid JSON object with the following schema:
{
  "title": "<A single concise 1-sentence title in ${targetLangName} summarizing the core spiritual theme>",
  "letter": "<Warm salutation addressing ${userName} in ${targetLangName} (e.g. cultural equivalent of 'Dear ${userName}')>\\n\\n<3-paragraph letter body in ${targetLangName} following the structure above>"
}

【STRICT RULES】:
1. You MUST respond ONLY in valid JSON.
2. The language of the title and letter MUST be in ${targetLangName}.
3. Address the user directly by name (${userName}).
4. Ensure the tone is gentle, uplifting, and Christ-centered, providing genuine spiritual companionship without being overly preachy.`;

        const generatedText = await callGemini(prompt);

        // Helper to parse title and letter body (Language-agnostic JSON-first parser)
        let title = '';
        let letter = generatedText;
        try {
            const cleanJson = generatedText.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1').trim();
            const parsed = JSON.parse(cleanJson);
            if (parsed.title) title = String(parsed.title).trim();
            if (parsed.letter) letter = String(parsed.letter).trim();
        } catch {
            // Fallback for non-JSON formatted text (language-agnostic)
            const colonMatch = generatedText.match(/^[^\n\r:：]+[:：]\s*(.+?)(?:\r?\n|$)/);
            if (colonMatch && colonMatch[1].length < 100) {
                title = colonMatch[1].replace(/\*\*/g, '').trim();
                const remaining = generatedText.substring(colonMatch[0].length).trim();
                letter = remaining.replace(/^[^\n\r:：]+[:：]\s*/, '').trim();
            } else {
                const lines = generatedText.split('\n').map(l => l.trim()).filter(Boolean);
                if (lines.length > 1 && lines[0].length < 80) {
                    title = lines[0].replace(/^#+\s*|\*\*/g, '').trim();
                    letter = lines.slice(1).join('\n\n').trim();
                }
            }
        }
        if (!title) {
            title = t(baseLang, 'letterBox.defaultTitle');
        }

        const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000);

        // Best effort persistence
        try {
            const persistTask = (async () => {
                const batch = db.batch();

                // 1. Save to recaps subcollection
                const recapRef = db.collection('users').doc(uid).collection('recaps').doc();
                batch.set(recapRef, {
                    title,
                    text: letter,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    expiresAt,
                    type: 'study_letter'
                });

                // 2. Save directly to letters subcollection (Letterbox)
                const letterRef = db.collection('users').doc(uid).collection('letters').doc();
                batch.set(letterRef, {
                    title,
                    content: letter,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    expiresAt,
                    type: 'study_letter'
                });

                // 3. Update user last generation timestamp
                const userDocRef = db.collection('users').doc(uid);
                batch.update(userDocRef, {
                    lastLetterGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastRecapGeneratedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                await batch.commit();
            })();
            await withTimeout(persistTask, 8000, 'Persistence timeout');
        } catch (e) {
            console.warn('[AI Personal Recap] Failed to persist:', (e as Error).message);
        }

        res.json({ success: true, title, recap: letter });
    } catch (err) {
        if (err instanceof AppError) {
            sendErrorResponse(res, err);
            return;
        }
        handleAiError(res, err, 'personal recap');
    }
});

export default router;
