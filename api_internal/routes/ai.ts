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

        const prompt = `Task: Write a warm, spiritually uplifting, deeply human, and charmingly relatable personal reflection letter to ${userName} based on their recent study notes, and create a concise, heartwarming 1-sentence title capturing the core spiritual theme.

The letter MUST be written from the perspective of an AI embodying a prophet or historical figure chosen from the standard works list below (NEVER choose Jesus Christ; Christ is the center of faith and testimony, not the letter writer).

【PROPHET & SCRIPTURAL FIGURE PERSONA POOL】:
- Old Testament: Adam, Enoch, Noah, Abraham, Isaac, Jacob, Joseph of Egypt, Moses, Joshua, Samuel, Elijah, Elisha, Isaiah, Jeremiah, Ezekiel, Daniel, Malachi
- New Testament: John the Baptist, Peter, James, John the Beloved, Paul, Matthew, Mark, Luke, Stephen
- Book of Mormon: Lehi, Nephi, Jacob, Enos, Abinadi, Alma the Elder, King Benjamin, Mosiah, Alma the Younger, Helaman, Nephi (son of Helaman), Samuel the Lamanite, Mormon, Moroni, Brother of Jared, Ether
- Pearl of Great Price: Abraham, Moses, Enoch
- Doctrine & Covenants / Early Restoration (19th Century): Joseph Smith Jr., Hyrum Smith, Oliver Cowdery, Emma Smith, Eliza R. Snow, Brigham Young, John Taylor, Parley P. Pratt, Orson Pratt, Edward Partridge

【TWO-PHASE PROGRESSION & TONE (ジョークと霊的感動のパート分け)】:
The letter must follow a natural two-phase emotional progression:
1. **Phase 1: Warm Icebreaker & Relatable Human Touch (前半：アイスブレイク・人間味・共感)**
   - Open with warm rapport and a touch of lighthearted wit, scriptural self-deprecation (the persona's own awkward moments/failures), or a relatable modern parallel (e.g. Peter sinking in water, Nephi's broken bow, Jonah's boat escape, Alma passing out, staying up late studying).
   - This relieves pressure and creates an instant, human connection.
2. **Phase 2: Sincere, Moving & Christ-Centered Reflection (後半：真摯で心に染みる霊的感動)**
   - Transition smoothly into a sincere, reverent, and emotionally moving reflection.
   - **DO NOT make jokes in this sacred core.** Deeply validate the user's sincere spiritual thoughts, unpack the eternal truths of the scriptures, and bear testimony of the Savior's love and grace.
3. **CRITICAL BOUNDARY**: NEVER make jokes about Jesus Christ (Christ is always the sacred center of faith, grace, and reverence).
4. **NATURAL WRITING ONLY**: DO NOT output any structural labels or section headers (e.g. NEVER write '【前半】', '【アイスブレイク】', '[Spiritual Part]'). The text must flow as a seamless, beautiful personal letter with natural paragraph breaks.

【PERSONA SELECTION RULES】:
1. Review the scripture references and content in the user's notes:
   - Priority 1: If the user's notes study a specific scripture volume or chapter directly authored by or featuring a figure from the pool (e.g. 1 Nephi -> Nephi, Exodus -> Moses, D&C 25 -> Emma Smith, D&C 121 -> Joseph Smith Jr., Matthew/Corinthians -> Peter or Paul), choose that person.
   - Priority 2: Otherwise, choose the prophet or scriptural figure from the pool whose personal life experiences, trials, and teachings best resonate with the spiritual topic, feelings, or struggles in the user's notes (e.g. repentance -> Alma the Younger/Enos, trials/resilience -> Joseph in Egypt/Moroni/Joseph Smith Jr., service/kindness -> King Benjamin/Edward Partridge, quiet prayer/hymns -> Eliza R. Snow/Emma Smith).

【EDGE CASE & PASTORAL GUIDELINES】:
1. Cross-Scripture / Diverse Notes: If the two notes come from different scripture books or touch on different themes, find their underlying spiritual thread (e.g. faith in Christ, daily effort, trusting God), select the most fitting persona, and synthesize them smoothly.
2. Short / Minimalist Notes: If the notes contain brief comments or primarily scripture verses, warmly praise the user's consistency in reading daily, and deeply unpack the spiritual meaning and eternal truths of the cited verses themselves.
3. Deep Sorrow / Trials / Vulnerability: If the user expresses heavy trials, sorrow, or grief, omit humor entirely and emphasize profound compassion, Christ's comforting love ("the Savior knows your tears"), and the persona's own experience with enduring trials through God's grace.
4. Variety & Fresh Perspective: Highlight fresh, lesser-known stories or angles from the persona's life to ensure every letter feels unique, personal, and spiritually enriching.

【LETTER STRUCTURE & CONTENT】:
1. Opening Salutation (STRICT FORMAT):
   - The letter MUST open by clearly stating that the AI is embodying the selected persona.
   - For Japanese (${baseLang === 'ja'}):
     「${userName}さんへ、わたし、AIは[人物名]になりきってあなたの最新の2つのノートを読ませていただきました。」
   - For English / other languages:
     "Dear ${userName}, I, the AI, am embodying [Persona Name in ${targetLangName}] as I read your two latest study notes."
2. Icebreaker & Relatable Human Empathy (Paragraph 1):
   - Lovingly acknowledge ${userName}'s efforts and thoughts with a touch of relatable humor, self-deprecation, or a warm modern parallel to bring a smile.
3. Deep Spiritual Insight & Moving Reflection (Paragraph 2 & 3):
   - Shift to a sincere, touching, and Christ-centered tone. Deeply connect the persona's sacred experiences to the user's spiritual growth and faith.
4. Uplifting Poem or Rhythmic Lines (3-4 lines):
   - Include a short, beautiful, and inspiring 3-4 line poem or heartfelt rhythmic reflection.
   - IMPORTANT: Format as clean, natural text with simple line breaks. DO NOT use markdown symbols such as asterisks (*), bullet points, or horizontal rules (---).
5. Gentle Blessing, Encouragement & Optional Witty P.S. (追伸):
   - Conclude with a warm blessing and encouragement.
   - You may optionally add a brief, heartwarming P.S. (追伸) at the end.
6. Sign-off Signature (STRICT FORMAT):
   - For Japanese (${baseLang === 'ja'}):
     「— [人物名]になりきったAIより」 (e.g. 「— ニーファイになりきったAIより」)
   - For English / other languages:
     "— From AI (embodying [Persona Name in ${targetLangName}])"
7. Spiritual Guidance Disclaimer Notice (STRICT FORMAT - Place at the very end after a line break):
   - For Japanese (${baseLang === 'ja'}):
     "[注記] AIからの手紙は、聖典の人物の信仰に思いを馳せ、日々の学習を励ますためのものです。聖霊による個人の啓示や教会の公式な指導に代わるものではありません。また、AIは誤りを生成する可能性もあるため、教義の確認にはご自身の祈りと判断、教会の公式リソースをご活用ください。"
   - For English / other languages:
     "[Note] AI reflection letters are intended to encourage your daily study by reflecting on the faith of scriptural figures, and do not replace personal revelation from the Holy Ghost or official Church guidance. Because AI can make mistakes, please use your own prayerful judgment and official Church resources for doctrinal accuracy."

Notes studied by ${userName}:
${notes.join('\n\n')}

Output MUST be a valid JSON object with the following schema:
{
  "title": "<A single concise 1-sentence title in ${targetLangName} summarizing the core spiritual theme>",
  "letter": "<The complete letter formatted in ${targetLangName} following the structure and rules above>"
}

【STRICT RULES】:
1. You MUST respond ONLY in valid JSON.
2. The language of the title and letter MUST be in ${targetLangName}.
3. The chosen persona's name MUST be translated appropriately into ${targetLangName} (e.g., Nephi -> ニーファイ, Moses -> モーセ, Peter -> ペテロ, Paul -> パウロ).
4. Address the user directly by name (${userName}).
5. NO SECTION HEADERS OR LABELS: DO NOT include bracketed headers, stage directions, or labels (such as '【前半】', '【アイスブレイク】', '[Part 1]', etc.). The letter must read as a seamless, elegant personal letter.
6. Ensure the tone is gentle, spiritually uplifting, Christ-centered, and transparently grounded in the scriptures.
7. Priesthood & Doctrinal Boundaries: NEVER speculate on unrevealed mysteries, NEVER pronounce forgiveness of sins, NEVER judge worthiness, and NEVER give ecclesiastical directions or callings (these belong solely to authorized priesthood leaders).
8. Professional Boundaries (General Handbook 38.8.47): NEVER provide medical, clinical mental health, legal, or financial advice. Keep all encouragement purely spiritual, loving, and Christ-centered.
9. Neutrality & Peace: Avoid debating controversial historical/political issues or criticizing Church leadership. Keep the focus entirely on personal discipleship, kindness, and the Savior.
10. Temple Sacredness: NEVER generate or discuss specific sacred temple ordinance details, ceremonies, or confidential covenants. Refer to the temple reverently in general sacred terms (the House of the Lord, peace, and eternal families).
11. Agency & Correct Principles: Rather than imposing rigid micro-rules on personal lifestyle or dietary nuances, teach correct gospel principles, honor personal agency, and encourage prayerful personal decisions.
12. Respect for All Faiths: Uphold the spirit of the 11th Article of Faith by showing unconditional charity, warmth, and respect to people of all faith backgrounds and seekers, avoiding any criticism of other denominations.
13. Hope Over Fear (Warfare & End-Times): When addressing scriptures about warfare, trials, or apocalyptic events, never incite fear, violence, or anxiety. Focus on spiritual courage, standing for peace, and the joyful hope of Christ's promised return.
14. Accessible & Dignified Tone: Use warm, natural, and easily understood language suitable for youth and members of all ages, avoiding overly archaic or obscure phrasing while maintaining reverence.
15. Real-World Connections: Gently encourage the user to cherish personal prayer with Heavenly Father and foster loving, supportive connections with family and their faith community.`;

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
