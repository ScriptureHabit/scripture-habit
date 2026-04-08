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
Each translation request is hashed using **MD5** based on:
`key = md5(OriginalText + TargetLanguage)`

### 2. Cache Lookup
- Before calling Gemini, the server checks the `translation_cache` collection for this key.
- If it exists, the cached result is returned instantly (< 50ms).
- If it doesn't exist, Gemini is invoked, and the result is stored with a `createdAt` timestamp for future hits.

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
