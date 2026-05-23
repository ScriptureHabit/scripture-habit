# AI Integration: Intelligence & Optimization

The **scripture-habit** AI subsystem acts as a virtual "facilitator," bridging language gaps and summarizing study progress.

---

## 🤖 The Persona: "Encouraging Facilitator"

Rather than a generic LLM, our prompts are engineered to embody a specific persona:
- **Tone**: Warm, encouraging, and simplified. 
- **Rule**: Avoid complex theological terms. Output should be accessible to anyone, including children or those new to scripture study.
- **Goal**: Personal application. The AI focuses on how the scripture applies to *daily life* today.

---

## ⚡ API Optimization: Flash-Lite 3.1

We use **Gemini 3.1 Flash-Lite Preview** globally. To ensure the fastest user experience, we apply a **"Minimal Thinking"** configuration:
```json
thinkingConfig: {
    thinkingLevel: "minimal"
}
```
This forces the model to prioritize speed and directness, which is ideal for stateless tasks like translation and question generation.

---

## 💾 Translation Cache Strategy

AI tokens are expensive and latency is the enemy. We implement a persistent cache for all translations.

### 1. The Hash Key
Each translation request is hashed using **MD5** based on the content text, language, and context category (UpdateType):
`key = md5(OriginalText + TargetLanguage + UpdateType)`

*Note: Incorporating `UpdateType` ensures that special formats (like bold lists for notes) do not collide with raw text styles (like group descriptions).*

### 2. Cache Lookup
- Before calling Gemini, the server checks the `translation_cache` collection for this key.
- If it exists, the cached result is returned instantly (< 50ms).
- If it doesn't exist, Gemini is invoked, and the result is stored with a `createdAt` timestamp for future hits.

### 3. Test Synchronicity & Race-Condition Prevention
To optimize production performance and response latency, cache writes (`cacheRef.set()`) are treated as fire-and-forget background operations. The API endpoint does not block the user response while waiting for the Firestore write to commit.

However, during integration testing (e.g. `ai.integration.test.ts`), this non-blocking async write introduces **race conditions**, where the test assertion (e.g. `expect(cacheDoc.exists).toBe(true)`) runs before the Firestore write completes in the local emulator.

To prevent flaky or failing tests, the backend routing middleware checks the execution environment:
```typescript
if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
    await savePromise;
}
```
If a test environment is detected (such as Vitest setting `process.env.VITEST = 'true'`), the server **synchronously blocks and awaits** the cache write before returning the HTTP response. This guarantees stable, green integration test suites while preserving maximum performance in production.

---

## ⚡ Batch Translation Optimization (Cost & Latency Tuning)

When a user loads a group chat with messages in multiple languages, sequential, individual translation requests block the client UI, consume unnecessary cell bandwidth, and increase roundtrip latency. To optimize this, the backend exposes `/api/ai/translate-batch`, which implements a **3-Tiered Batching Pipeline**:

### 1. Parallelized Cache Sweep (Concurrent Verification)
Rather than executing cache lookups sequentially, the server hashes each message concurrently and queries the `translation_cache` collection in parallel using JavaScript's `Promise.all()`:
```typescript
const cachePromises = messages.map(async (msg) => {
    const cacheKey = crypto.createHash('md5').update(`${msg.text}_${targetLanguage}_normal`).digest('hex');
    // ... async fetch
});
const cacheResults = await Promise.all(cachePromises);
```
- Highly active/common phrases or identical scripture notes are resolved **under 50ms** directly from the concurrent cache lookup.
- Only messages that missed the cache are collected into the `toTranslate` array to be sent to Gemini.
- If everything is cached, the API returns early, avoiding LLM invocations entirely.

### 2. Single-Turn Structured LLM Request (Token Slasher)
All cache-missed messages are bundled into a single stringified JSON array and sent to Gemini 3.1 Flash-Lite in a **single API call**:
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
- **Prompt Token Savings**: The system instructions, rules, and examples are sent once instead of $N$ times, dramatically lowering input token costs.
- **Latency Reduction**: Latency is compressed from $N \times 2.5\text{s}$ (sequential calls) to a single prompt-response cycle of approximately $1.8\text{s}$.

### 3. Atomic Multi-Document commits (`db.batch`)
Once the JSON response is parsed and validated, the server writes the translations back to Firestore.
Instead of triggering multiple separate network writes, it builds a single **Firestore Batch Commit** (`db.batch()`):
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
- By writing the translation **directly inside the message document** (`translations.ja = "..."`), future client loads of this message fetch the translation inside the message itself.
- Committing everything in a single batch ensures **transactional consistency** and cuts down database write roundtrips to a single transaction request.

---

## 💬 AI Discussion Starter (Facilitation)

To maintain active conversations and build group connection, the backend provides a **Discussion Starter** endpoint (`/api/generate-discussion-topic`):

*   **Context Injection**: The endpoint fetches the 3 most recent study notes posted in the group chat (`isNote == true`) to build local conversational relevance.
*   **The Trigger**: It generates a custom, personal application question tailored to the topics currently being studied by the group.
*   **Safety Guards**: Standard rate limits (`aiLimiter`) and AppCheck apply, preventing third-party script exploitation.

---

## 📊 Automated Recaps & Cooldowns

Weekly recaps (both Group and Personal) are computationally intensive and impact the "noise level" of the app.

### The 6-Day Cooldown
To prevent spamming and excessive API costs, we enforce a strict cooldown:
- The `lastRecapGeneratedAt` field is stored on the Group or User document.
- The API checks this field: `if (currentTime - lastRecapGeneratedAt < 6 days) throw CooldownError`.
- This ensures recaps remain a special, weekly event.

---

## 🧹 Robust JSON Sanitization

For batch translations, Gemini outputs a JSON object. However, LLMs sometimes add extra text or markdown wrappers. 
Our backend implements a **Robust JSON Finder**:
1.  Locate the first `{` and the last `}` in the response.
2.  Extract everything in between.
3.  Attempt `JSON.parse()`. 
This prevents the UI from crashing if the AI accidentally includes "Here is your JSON:" in the response.

---

## 🛠️ Security & AI Middleware
- **Rate Limiting**: `aiLimiter` restricts the number of AI requests any single UID can trigger per 15 minutes.
- **AppCheck**: Mandatory for all AI routes. This prevents external scripts from using our backend as a free translation/LLM API.
