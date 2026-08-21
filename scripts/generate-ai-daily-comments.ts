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
    return `You are a warm, spiritually insightful, and inspiring scripture study partner for the Scripture Habit app.
Your task is to generate daily study comments for the following scriptures from Come, Follow Me.

【SCRIPTURE ITEMS TO PROCESS】:
${JSON.stringify(items, null, 2)}

【COMMENT REQUIREMENTS】:
For each item, write a unique 2-line comment structured as follows:
- Line 1 (Specific Insight & Spiritual Takeaway):
  Write a deep, specific reflection on the exact chapter/verses (characters, specific events, doctrines, Christ's grace, or lessons). DO NOT use generic book-level templates or repeating slogans. Mention the specific context of this reading (e.g. for Job 1: Job's faithful response when losing everything; for Job 38: God answering out of the whirlwind).
- Line 2 (Reflective Prompt & Question for Study Notes):
  Provide a warm, gentle, and practical question or thought-provoking prompt to help the user write in their personal study notebook today (e.g. "What words in today's reading brought peace to your heart?", "How can you apply this principle in your daily life?"). End with 1-2 uplifting emojis (e.g., 🌾✨, 📖✨, 💡✨, ⚓✨, 🌿✨, 🔥✨, 🕊️✨).

【LANGUAGES REQUIRED】:
Provide the 2-line comment (separated by \\n) in all 10 languages:
- "ja": Japanese (natural, warm, polite 「です・ます」 tone)
- "en": English (warm, uplifting, inspiring)
- "ko": Korean (natural, polite 해요/하십시오 tone)
- "zho": Traditional Chinese (繁體中文, uplifting and natural)
- "es": Spanish (warm and encouraging)
- "pt": Portuguese (warm and encouraging)
- "vi": Vietnamese (warm and encouraging)
- "tl": Tagalog (warm and encouraging)
- "th": Thai (warm and encouraging)
- "sw": Swahili (warm and encouraging)

【OUTPUT FORMAT】:
Output MUST be a valid JSON array of objects with the following schema:
[
  {
    "date": "YYYY-MM-DD",
    "comments": {
      "ja": "Line 1 insight in Japanese.\\nLine 2 question/prompt in Japanese. 🌾✨",
      "en": "Line 1 insight in English.\\nLine 2 question/prompt in English. 🌾✨",
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
            comment: "毎日少しずつ聖典を学び進めましょう！継続することが大きな力になります。📖✨"
        },
        en: {
            scripture: "Scripture Study",
            chapter: "Today's Scripture",
            comment: "Let's continue studying scriptures step by step today! Consistency brings great blessings. 📖✨"
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
