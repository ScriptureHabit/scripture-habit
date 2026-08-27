import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';
import { AI_DAILY_COMMENTS, AiDailyCommentData } from '../api_internal/data/ai-daily-comments-2026.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_FILE_PATH = path.resolve(__dirname, '.ai-daily-comments-cache.json');
const TARGET_FILE_PATH = path.resolve(__dirname, '../api_internal/data/ai-daily-comments-2026.ts');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error('Error: GEMINI_API_KEY is not set in .env file.');
    process.exit(1);
}

// Supported 10 languages
export const SUPPORTED_LANGUAGES = ['ja', 'en', 'ko', 'zho', 'es', 'pt', 'vi', 'tl', 'th', 'sw'] as const;

interface DailyGenerationResult {
    date: string;
    comments: Record<string, string>;
}

// Load cache if exists
function loadCache(): Record<string, Record<string, string>> {
    if (fs.existsSync(CACHE_FILE_PATH)) {
        try {
            return JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf-8'));
        } catch {
            return {};
        }
    }
    return {};
}

// Save cache
function saveCache(cache: Record<string, Record<string, string>>) {
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
}

// Gemini API Caller
async function callGemini(prompt: string, model = 'gemini-3.1-flash-lite-preview'): Promise<string> {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    
    let attempts = 0;
    while (attempts < 3) {
        try {
            attempts++;
            const response = await axios.post(apiUrl, {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    responseMimeType: "application/json"
                }
            }, { timeout: 60000 });

            const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error('Empty response from Gemini API');
            return text;
        } catch (err) {
            console.warn(`[Gemini API] Attempt ${attempts} failed:`, err instanceof Error ? err.message : String(err));
            if (attempts >= 3) throw err;
            await new Promise(res => setTimeout(res, 2000 * attempts));
        }
    }
    throw new Error('Gemini API call failed after retries');
}

// Batch prompt builder for multiple dates
function buildPrompt(items: { date: string; scriptureJa: string; chapterJa: string; chapterEn: string }[]): string {
    return `You are a witty, warm, empathetic, and relatable scripture study companion for the Scripture Habit app.
Your task is to generate daily study comments for the following scriptures from Come, Follow Me.

【CORE PHILOSOPHY & TONE】:
- Avoid overly serious, robotic, preachy, or sanctimonious AI sermons (「〜は〜の象徴です」「〜しましょう」といった定型句や説教調は厳禁).
- Deliver a single, punchy, human-like 1-line observation or witty "tsukkomi" / modern relatable parallel (現代あるあるや大喜利のように、一言でクスッと笑えてハッと心に刺さる1行の文章).
- Highlight the characters' human flaws, relatable dilemmas, or everyday ironies in a warm, relatable way.
- NO study notebook questions, NO rhetorical homework questions (NO "〜は何ですか？", "How do you feel?").
- STRICTLY NO EMOJIS (絵文字は一切使用しないでください).

【SCRIPTURE ITEMS TO PROCESS】:
${JSON.stringify(items, null, 2)}

【COMMENT REQUIREMENTS】:
For each item, generate a single punchy 1-line comment (NO line breaks, NO emojis):
- Focus on the specific characters, actions, human dilemmas, or ironic realities in the reading.
- One single, memorable, witty, and relatable sentence that hits home immediately.
- Absolutely NO emojis under any circumstances.

【FEW-SHOT EXAMPLES (For Style & Tone Reference)】:
- Example: Martha and Mary (Luke 10)
  ja: 台所で1人皿を洗いながら、のんきにくつろぐ家族にイライラが爆発するマルタ、完全に自分すぎて胸が痛い。
  en: Martha frantically doing dishes while everyone else chills in the living room is painfully relatable.

- Example: Job's Friends (Job 2 / Job 4)
  ja: 一番落ち込んでるときに駆けつけて、延々と正論で説教してくるヨブの友人たち、現代のSNSや職場にも絶対いますよね。
  en: Job’s friends showing up in his worst moment only to lecture him with unsolicited advice is basically modern social media in a nutshell.

- Example: Bronze Serpent (Numbers 21)
  ja: 「え、あの蛇を見るだけで毒が治るの？嘘でしょ」と疑って見ずに倒れた人々、助かる方法は案外シンプルなのにこじらせてしまう人間の意地っ張りそのもの。
  en: People refusing to look at a bronze serpent because it sounded too simple is peak human stubbornness.

- Example: Jonah Running Away (Jonah 1)
  ja: 神様に「ニネベに行け」と言われて真逆の船に乗って全力逃走するヨナ、人間味の塊すぎて嫌いになれない。
  en: Jonah being told to go east and immediately booking a cruise full speed west is the most human response ever.

- Example: Peter walking on water (Matthew 14)
  ja: 意気揚々と水の上を歩き出した直後に波を見て一瞬でパニックになるペテロ、人間の集中力のリアルさを物語っている。
  en: Peter stepping onto the water with total confidence only to panic two seconds later is a brutally honest picture of human focus.

【LANGUAGES REQUIRED & CULTURAL LOCALIZATION】:
Provide the 1-line comment in all 10 languages.
CRITICAL: Do NOT do mechanical translations. Adapt the humor and relatable nuance naturally for each culture:
- "ja": Japanese (natural, witty, polite yet friendly 「です・ます/だ・である/言い切り」 with sharp relatable nuance)
- "en": English (witty, punchy, conversational, 1 line)
- "ko": Korean (natural, witty, relatable 1 line)
- "zho": Traditional Chinese (繁體中文, natural, witty, relatable 1 line)
- "es": Spanish (warm, witty, culturally natural 1 line)
- "pt": Portuguese (warm, witty, culturally natural 1 line)
- "vi": Vietnamese (warm, witty, culturally natural 1 line)
- "tl": Tagalog (warm, witty, culturally natural 1 line)
- "th": Thai (warm, witty, culturally natural 1 line)
- "sw": Swahili (warm, witty, culturally natural 1 line)

【OUTPUT FORMAT】:
Output MUST be a valid JSON array of objects with the following schema (single line per comment, NO \\n, NO emojis):
[
  {
    "date": "YYYY-MM-DD",
    "comments": {
      "ja": "Single punchy line in Japanese without emojis.",
      "en": "Single punchy line in English without emojis.",
      "ko": "...",
      "zho": "...",
      "es": "...",
      "pt": "...",
      "vi": "...",
      "tl": "...",
      "th": "...",
      "sw": "..."
    }
  }
]
`;
}

// Helper to safely extract and parse JSON array or object
function cleanAndParseJson(rawText: string): DailyGenerationResult[] {
    let text = rawText.trim();
    // Remove markdown block if present
    if (text.startsWith('```')) {
        text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }
    
    // First try direct parse
    try {
        const direct = JSON.parse(text);
        if (Array.isArray(direct)) return direct as DailyGenerationResult[];
        if (direct && typeof direct === 'object' && direct.date && direct.comments) {
            return [direct as DailyGenerationResult];
        }
    } catch {
        // Continue to bracket extraction
    }

    // Try finding matched brackets for array
    const startArr = text.indexOf('[');
    if (startArr !== -1) {
        let depth = 0;
        let inString = false;
        let escape = false;
        for (let i = startArr; i < text.length; i++) {
            const char = text[i];
            if (escape) {
                escape = false;
                continue;
            }
            if (char === '\\') {
                escape = true;
                continue;
            }
            if (char === '"') {
                inString = !inString;
                continue;
            }
            if (!inString) {
                if (char === '[') depth++;
                else if (char === ']') {
                    depth--;
                    if (depth === 0) {
                        const candidate = text.substring(startArr, i + 1);
                        try {
                            const parsed = JSON.parse(candidate);
                            if (Array.isArray(parsed)) return parsed as DailyGenerationResult[];
                        } catch {
                            // Continue searching
                        }
                    }
                }
            }
        }
    }

    // Try finding matched brackets for single object
    const startObj = text.indexOf('{');
    if (startObj !== -1) {
        let depth = 0;
        let inString = false;
        let escape = false;
        for (let i = startObj; i < text.length; i++) {
            const char = text[i];
            if (escape) {
                escape = false;
                continue;
            }
            if (char === '\\') {
                escape = true;
                continue;
            }
            if (char === '"') {
                inString = !inString;
                continue;
            }
            if (!inString) {
                if (char === '{') depth++;
                else if (char === '}') {
                    depth--;
                    if (depth === 0) {
                        const candidate = text.substring(startObj, i + 1);
                        try {
                            const parsed = JSON.parse(candidate);
                            if (parsed && typeof parsed === 'object' && parsed.date && parsed.comments) {
                                return [parsed as DailyGenerationResult];
                            }
                        } catch {
                            // Continue
                        }
                    }
                }
            }
        }
    }

    throw new Error(`Failed to extract valid JSON from Gemini output: ${text.substring(0, 200)}...`);
}

// Generate comments for batch with retry and fallback
async function generateBatch(items: { date: string; scriptureJa: string; chapterJa: string; chapterEn: string }[]): Promise<DailyGenerationResult[]> {
    try {
        const prompt = buildPrompt(items);
        const rawJson = await callGemini(prompt);
        return cleanAndParseJson(rawJson);
    } catch (batchErr) {
        console.warn(`[Batch Warning] Batch generation for ${items.length} items failed (${items.map(i => i.date).join(', ')}): ${batchErr instanceof Error ? batchErr.message : String(batchErr)}. Falling back to individual generation...`);
        
        // Fallback: generate item by item
        const singleResults: DailyGenerationResult[] = [];
        for (const singleItem of items) {
            try {
                const singlePrompt = buildPrompt([singleItem]);
                const singleRaw = await callGemini(singlePrompt);
                const parsed = cleanAndParseJson(singleRaw);
                if (parsed.length > 0) {
                    singleResults.push(parsed[0]);
                }
                await new Promise(r => setTimeout(r, 500));
            } catch (singleErr) {
                console.error(`[Item Error] Failed generating for ${singleItem.date}:`, singleErr);
                throw singleErr;
            }
        }
        return singleResults;
    }
}


// Write the updated AI_DAILY_COMMENTS back to the source file
function writeSourceFile(data: Record<string, AiDailyCommentData>) {
    const sortedDates = Object.keys(data).sort();
    
    let content = `export interface AiDailyCommentData {
    date: string; // YYYY-MM-DD
    scripture: Record<string, string>;
    chapter: Record<string, string>;
    comment: Record<string, string>;
}

export const AI_DAILY_COMMENTS: Record<string, AiDailyCommentData> = {\n`;

    for (let i = 0; i < sortedDates.length; i++) {
        const date = sortedDates[i];
        const item = data[date];
        const isLast = i === sortedDates.length - 1;

        content += `    "${date}": {\n`;
        content += `        date: "${date}",\n`;
        
        // scripture
        content += `        scripture: ${JSON.stringify(item.scripture, null, 12).replace(/\n\s*}/, '\n        }')},\n`;
        
        // chapter
        content += `        chapter: ${JSON.stringify(item.chapter, null, 12).replace(/\n\s*}/, '\n        }')},\n`;
        
        // comment
        content += `        comment: ${JSON.stringify(item.comment, null, 12).replace(/\n\s*}/, '\n        }')}\n`;
        
        content += `    }${isLast ? '' : ','}\n`;
    }

    content += `};

/**
 * Helper function to retrieve daily comment or fallback
 */
export function getAiDailyComment(dateStr: string, lang: string = 'ja') {
    const item = AI_DAILY_COMMENTS[dateStr];
    if (item) {
        return {
            scripture: item.scripture[lang] || item.scripture['en'] || item.scripture['ja'],
            chapter: item.chapter[lang] || item.chapter['en'] || item.chapter['ja'],
            comment: item.comment[lang] || item.comment['en'] || item.comment['ja']
        };
    }

    const fallbacks: Record<string, { scripture: string; chapter: string; comment: string }> = {
        ja: {
            scripture: "聖典学習",
            chapter: "今日の聖句",
            comment: "毎日少しずつ聖典を読み進めるその一歩が、何より尊い習慣です。"
        },
        en: {
            scripture: "Scripture Study",
            chapter: "Today's Scripture",
            comment: "Taking one small step each day to open the scriptures is a habit worth keeping."
        }
    };

    return fallbacks[lang] || fallbacks['en'];
}
`;

    fs.writeFileSync(TARGET_FILE_PATH, content, 'utf-8');
    console.log(`Successfully updated: ${TARGET_FILE_PATH}`);
}

async function main() {
    const args = process.argv.slice(2);
    const isDryRun = args.includes('--dry-run');
    const isForce = args.includes('--force');
    const isAll = args.includes('--all');

    // Parse date filter
    const datesArg = args.find(a => a.startsWith('--dates='));
    const dateArg = args.find(a => a.startsWith('--date='));
    const fromArg = args.find(a => a.startsWith('--from='));
    const toArg = args.find(a => a.startsWith('--to='));
    const allDates = Object.keys(AI_DAILY_COMMENTS).sort();

    let targetDates: string[];
    if (datesArg) {
        targetDates = datesArg.replace('--dates=', '').split(',').map(d => d.trim());
    } else if (dateArg) {
        targetDates = [dateArg.replace('--date=', '').trim()];
    } else if (fromArg || toArg) {
        const from = fromArg ? fromArg.replace('--from=', '').trim() : allDates[0];
        const to = toArg ? toArg.replace('--to=', '').trim() : allDates[allDates.length - 1];
        targetDates = allDates.filter(d => d >= from && d <= to);
    } else if (isAll) {
        targetDates = allDates;
    } else {
        // Default to Job period (2026-08-10 to 2026-08-16) for safe testing
        console.log('No date range specified. Defaulting to Job study period (2026-08-10 ~ 2026-08-16).');
        console.log('Use --all for all 364 days, or --from=YYYY-MM-DD --to=YYYY-MM-DD, or --dates=D1,D2\n');
        targetDates = allDates.filter(d => d >= '2026-08-10' && d <= '2026-08-16');
    }

    console.log(`Target dates count: ${targetDates.length}`);
    console.log(`Dates: ${targetDates.join(', ')}`);
    console.log(`Mode: ${isDryRun ? 'DRY-RUN (No file modifications)' : 'WRITE'}`);

    const cache = loadCache();
    const batchSizeArg = args.find(a => a.startsWith('--batch-size='));
    const batchSize = batchSizeArg ? parseInt(batchSizeArg.replace('--batch-size=', ''), 10) : 2;
    const itemsToProcess: { date: string; scriptureJa: string; chapterJa: string; chapterEn: string }[] = [];

    for (const date of targetDates) {
        const existing = AI_DAILY_COMMENTS[date];
        if (!existing) {
            console.warn(`Date not found in AI_DAILY_COMMENTS: ${date}`);
            continue;
        }

        if (!isForce && cache[date]) {
            console.log(`[Cache hit] ${date}: ${existing.chapter.ja}`);
            continue;
        }

        itemsToProcess.push({
            date,
            scriptureJa: existing.scripture.ja,
            chapterJa: existing.chapter.ja,
            chapterEn: existing.chapter.en || existing.chapter.ja
        });
    }

    console.log(`Items needing generation: ${itemsToProcess.length}`);

    // Process in batches
    for (let i = 0; i < itemsToProcess.length; i += batchSize) {
        const batch = itemsToProcess.slice(i, i + batchSize);
        console.log(`\nGenerating batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(itemsToProcess.length / batchSize)} (${batch.map(b => b.date).join(', ')})...`);
        
        try {
            const results = await generateBatch(batch);
            for (const res of results) {
                cache[res.date] = res.comments;
                console.log(`\n[Generated] ${res.date} (${AI_DAILY_COMMENTS[res.date]?.chapter.ja}):`);
                console.log(`  JA: ${res.comments.ja.replace(/\n/g, '\n      ')}`);
                console.log(`  EN: ${res.comments.en.replace(/\n/g, '\n      ')}`);
            }
            saveCache(cache);
        } catch (err) {
            console.error(`Failed batch generation:`, err);
            throw err;
        }

        // Small delay between batches to be gentle with rate limits
        if (i + batchSize < itemsToProcess.length) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    // Apply cached results to the data object
    const updatedData: Record<string, AiDailyCommentData> = { ...AI_DAILY_COMMENTS };
    let updatedCount = 0;

    for (const date of targetDates) {
        if (cache[date]) {
            const existing = updatedData[date];
            if (existing) {
                existing.comment = {
                    ...existing.comment,
                    ...cache[date]
                };
                updatedCount++;
            }
        }
    }

    console.log(`\n========================================`);
    console.log(`Updated comments for ${updatedCount} dates.`);

    if (isDryRun) {
        console.log(`Dry-run complete. File was NOT modified.`);
    } else {
        writeSourceFile(updatedData);
        console.log(`File write complete!`);
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
