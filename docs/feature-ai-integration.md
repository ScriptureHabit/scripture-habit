# AI Integration

The **scripture-habit** AI subsystem acts as a virtual facilitator, helping bridge language gaps and summarizing study progress.

---

## The Persona: "Encouraging Facilitator"

Rather than a generic LLM, our prompts are engineered to use a specific persona:
- **Tone**: Warm, encouraging, and simple. 
- **Rule**: Avoid complex theological terms. Output should be accessible to anyone.
- **Goal**: Personal application. The AI focuses on how the scripture applies to daily life today.

---

## API Optimization: Gemini 3.1 Flash-Lite

We use **Gemini 3.1 Flash-Lite Preview** globally. To ensure a fast experience, we apply a minimal thinking configuration:
```json
thinkingConfig: {
    thinkingLevel: "minimal"
}
```
This forces the model to prioritize speed and directness for simple tasks like translation and question generation.

---

## Translation Cache Strategy

We use a persistent cache for all translations to reduce API costs and latency.

### 1. The Hash Key
Each translation request is hashed using **MD5** based on the text, language, and context category (UpdateType):
`key = md5(OriginalText + TargetLanguage + UpdateType)`

### 2. Cache Lookup
- Before calling Gemini, the server checks the `translation_cache` collection for this key.
- If it exists, the cached result is returned instantly (< 50ms).
- If it doesn't exist, Gemini is called, and the result is stored with a `createdAt` timestamp.

### 3. Testing and Syncing
To optimize production performance, cache writes (`cacheRef.set()`) run in the background. The API does not block the user response while waiting for the Firestore write to commit.

However, during integration testing (e.g. `ai.integration.test.ts`), this non-blocking async write can cause race conditions where test assertions run before the database write completes.

To prevent failing tests, the backend checks the execution environment:
```typescript
if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
    await savePromise;
}
```
If a test environment is detected, the server awaits the cache write before returning the HTTP response, guaranteeing stable integration tests.

---

## Batch Translation Optimization

When a user loads a chat with messages in multiple languages, individual translation requests can slow down the UI and consume extra bandwidth. To optimize this, the backend exposes `/api/ai/translate-batch`, which uses a **3-stage batching process**:

### 1. Parallel Cache Search
The server hashes each message and queries the `translation_cache` collection in parallel using `Promise.all()`:
```typescript
const cachePromises = messages.map(async (msg) => {
    const cacheKey = crypto.createHash('md5').update(`${msg.text}_${targetLanguage}_normal`).digest('hex');
    // ... async fetch
});
const cacheResults = await Promise.all(cachePromises);
```
- Active or common phrases are resolved in under 50ms directly from the cache.
- Only messages that missed the cache are added to the `toTranslate` array for Gemini.
- If everything is cached, the API returns early without calling the LLM.

### 2. Single Structured LLM Request
All cache-missed messages are bundled into a single JSON array and sent to Gemini in one API call:
```typescript
const prompt = `Task: Translate these message items into ${targetLangName}.
    【STRICT RULES】:
    1. Preserve the exact markdown structure, especially bold labels like **Category:** or **Comment:**.
    2. Translate the labels themselves into ${targetLangName}.
    3. Output ONLY a valid JSON object mapping IDs to their translations. NO markdown backticks or extra text.
    
    Format: {"msg_id": "translated_text", ...}
    
    Messages:
    ${JSON.stringify(toTranslate.map(m => ({ id: m.id, text: m.text })))}`;
```
- **Token Savings**: Instructions and rules are sent once instead of multiple times, lowering input token costs.
- **Latency Reduction**: Latency is compressed to a single prompt-response cycle of approximately 1.8 seconds.

### 3. Batch Commits (`db.batch`)
Once the JSON response is parsed, the server writes the translations to Firestore.
Instead of triggering separate network writes, it builds a single **Firestore Batch Commit**:
```typescript
const batch = db.batch();
for (const msg of toTranslate) {
    const translated = batchTranslations[msg.id];
    
    // 1. Set global translation cache
    batch.set(cacheRef, { ... });
    
    // 2. Persist directly inside the active message document (Denormalization)
    batch.set(messageRef, { translations: { [targetLanguage]: translated } }, { merge: true });
}
await batch.commit();
```
- Writing the translation directly inside the message document ensures future client loads fetch the translation within the message.
- Committing in a single batch ensures consistency and reduces database write roundtrips.

---

## Reflection Letters (LetterBox), Cooldowns, & Smart Cache Recovery

Reflection letters are spiritually uplifting, personalized messages created by analyzing user study notes. To prevent system overload, enrich user experience, and ensure lightweight storage:

### 1. Spiritual Storytelling 3-Paragraph Prompt
The reflection letter is constructed with a warm 3-paragraph narrative:
1. **Empathy & Affirmation**: Validating the user's specific thoughts, insights, and study efforts.
2. **Scripture Figure / General Conference Narrative**: Drawing parallels to relevant figures in the Standard Works (Nephi, Ruth, Joseph, Paul, etc.) or General Conference speakers for deeper spiritual reflection.
3. **Blessing & Encouragement**: Concluding with a gentle prayer and encouraging blessing.

### 2. Language-Agnostic JSON Schema Output
The prompt requires Gemini to output structured JSON:
```json
{
  "title": "A short inspiring title",
  "letter": "The full letter body..."
}
```
This guarantees consistent parsing across all 11 supported languages without relying on locale-specific regexes.

### 3. The 6-Day Cooldown & Anti-Timeout Smart Cache Recovery
- When a letter is generated, `lastRecapGeneratedAt` is updated on `users/{uid}`.
- If a user triggers generation within 6 days (or reloads during a network interruption), the server checks:
  1. **Level 1 (`recaps` subcollection)**: Queries latest record (limit 1) within 6 days.
  2. **Level 2 (`letters` subcollection)**: Queries latest records (limit 5) for `type === 'weekly_recap'`.
- If found, it returns the cached letter with `fromCache: true`, preventing lost credits on network drops.

### 4. Firestore Native TTL (30-Day Auto-Cleanup) & Welcome Letter
- Reflection letters in `users/{uid}/letters` and `users/{uid}/recaps` are stamped with `expiresAt: now + 30 days` and deleted automatically by Firestore's TTL engine.
- Developer welcome letters created on profile initialization are stored without `expiresAt`, preserving them permanently.

---

## JSON Sanitization & Parsing

Gemini outputs a JSON object for batch translations and reflection letters. 
Our backend sanitizes the output by isolating the outermost `{` and `}` delimiters before calling `JSON.parse()`, preventing markdown formatting errors.


---

## Security & AI Middleware
- **Rate Limiting**: `aiLimiter` restricts the number of AI requests any user can trigger per hour.
- **AppCheck**: Required for all AI routes to prevent external scripts from abusing the endpoints.
