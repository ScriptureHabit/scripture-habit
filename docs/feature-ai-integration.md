# AI Integration

The **scripture-habit** AI subsystem acts as a virtual facilitator, helping bridge language gaps and summarizing study progress.

---

## 🤖 The Persona: "Encouraging Facilitator"

Rather than a generic LLM, our prompts are engineered to use a specific persona:
- **Tone**: Warm, encouraging, and simple. 
- **Rule**: Avoid complex theological terms. Output should be accessible to anyone.
- **Goal**: Personal application. The AI focuses on how the scripture applies to daily life today.

---

## ⚡ API Optimization: Gemini 3.1 Flash-Lite

We use **Gemini 3.1 Flash-Lite Preview** globally. To ensure a fast experience, we apply a minimal thinking configuration:
```json
thinkingConfig: {
    thinkingLevel: "minimal"
}
```
This forces the model to prioritize speed and directness for simple tasks like translation and question generation.

---

## 💾 Translation Cache Strategy

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

## ⚡ Batch Translation Optimization

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

## 💬 AI Discussion Starter

To encourage active conversations, the backend provides a discussion starter endpoint (`/api/generate-discussion-topic`):

*   **Context**: The endpoint fetches the 3 most recent study notes in the chat (`isNote == true`) to build relevant discussion topics.
*   **The Trigger**: It generates a personal application question tailored to the topics currently studied by the group.
*   **Safety Guards**: Standard rate limits (`aiLimiter`) and AppCheck are applied to protect the route.

---

## 📊 Weekly Recaps, Cooldowns, & Smart Cache Recovery

Weekly recaps are resource-heavy AI operations. To prevent system overload and control API costs, the system applies a strict **6-day cooldown** while offering a smart recovery mechanism:

### 1. The Cooldown and Cooldown Logic
- When a personal recap is generated, the `lastRecapGeneratedAt` field (Firestore Timestamp) is set on the user's public profile document (`users/{uid}`).
- When a new request arrives, the server checks if the elapsed time since `lastRecapGeneratedAt` is less than 6 days.

### 2. Smart Cache & Fallback Recovery (Anti-Timeout)
Instead of simply rejecting the request with a hard `429` error (which would cause a bad user experience in case of network timeouts or accidental screen closures), the API attempts to retrieve the recently generated recap from two fallback levels:

1. **Level 1 Cache (`recaps` Subcollection)**:
   - Queries `users/{uid}/recaps` sorted by `createdAt` in descending order (limit 1).
   - If a document exists, is newer than 6 days, and contains `text`, the server returns it instantly with `fromCache: true`.
2. **Level 2 Cache (`letters` Subcollection)**:
   - If the `recaps` query misses, the server queries the 5 most recent documents in the `letters` subcollection sorted by `createdAt` in descending order.
   - It programmatically filters for a document where `type === 'weekly_recap'` (avoiding the need for a strict composite index in Firestore).
   - If found, is newer than 6 days, and contains `content`, it returns it as a fallback.

### 3. Hard Cooldown Rejection
- If both cache lookups fail to find the recently generated recap text, the API returns a `429` error: `Personal recap already generated recently. Please wait a week.`
- This dual-tier caching guarantees that users can retrieve their weekly encouragement letter even if the client app state is lost or interrupted.

---

## 🧹 JSON Sanitization

Gemini outputs a JSON object for batch translations. However, LLMs sometimes include extra markdown or text wrappers. 
Our backend cleans this output:
1.  Locate the first `{` and the last `}` in the response.
2.  Extract everything in between.
3.  Run `JSON.parse()`. 
This prevents errors if the AI includes extra introductory text.

---

## 🛠️ Security & AI Middleware
- **Rate Limiting**: `aiLimiter` restricts the number of AI requests any user can trigger per hour.
- **AppCheck**: Required for all AI routes to prevent external scripts from abusing the endpoints.
