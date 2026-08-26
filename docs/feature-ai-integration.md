# AI Integration (Gemini)

This document details how the Gemini AI subsystem handles dynamic message translations, question prompts, and weekly reflection letters.

---

## 1. Role & Persona Design

AI functions as an encouraging facilitator that bridges language gaps and validates personal study efforts:
- **Tone**: Warm, supportive, plainspoken, and concise.
- **Focus**: Emphasizes daily personal application rather than complex theological debate.

---

## 2. Model Configuration

- **Model**: **Gemini 3.1 Flash-Lite**
- **Optimization**: Configured with minimal thinking levels (`thinkingLevel: "minimal"`) to maximize response speed for translations and question generation.

---

## 3. Translation Caching & Batching

To minimize API costs and optimize response times, the app employs two optimization strategies:

### ① MD5 Persistent Cache
Hashes request parameters (`OriginalText + TargetLanguage`) to check the `translation_cache` collection. Cached translations resolve in under 50ms.

### ② Batch Translation (`/api/ai/translate-batch`)
When loading chat streams with multiple foreign messages:
1. **Parallel Cache Lookup**: Queries all message hashes concurrently via `Promise.all()`.
2. **Single Structured Request**: Bundles only cache-missed messages into a single JSON payload for Gemini, reducing network latency to a single round-trip.
3. **Atomic Persistence**: Commits translations directly to the respective message documents via a Firestore batch.

---

## 4. Weekly Reflection Letters (LetterBox)

Analyzes the user's weekly study notes to generate a supportive, personal reflection letter:

```mermaid
flowchart TD
    Request[Generate Letter Request] --> CheckCooldown{Generated within last 6 days?}
    CheckCooldown -- Yes (On Cooldown) --> ReturnCache[Return Existing Letter from Cache]
    CheckCooldown -- No (Eligible) --> CallGemini[Call Gemini 3.1 Flash-Lite]
    CallGemini --> SaveDB[Save to LetterBox (users/{uid}/letters)<br/>TTL: 30 Days]
    SaveDB --> Deliver[Display Letter]
```

1. **Three-Paragraph Structure**:
   - **Empathy & Validation**: Acknowledges the user's personal reflections and consistency.
   - **Scriptural Context**: Connects thoughts with relevant scriptural figures or teachings.
   - **Encouragement**: Concludes with a forward-looking blessing.
2. **6-Day Cooldown**:
   Prevents unnecessary API costs and preserves the unique weekly rhythm of the feature.
3. **Firestore TTL Auto-Cleanup**:
   Letters in `users/{uid}/letters` are assigned an `expiresAt: now + 30 days` timestamp, automatically cleaned up by Firestore's TTL engine (the initial welcome letter is stored permanently).

---

## 5. Security & Rate Limiting

- **App Check Enforced**: Guarantees requests originate from verified app clients.
- **Rate Limiting (`aiLimiter`)**: Caps the number of AI requests allowed per user per hour.

---

## 6. Related Documentation

- [AI Reflection Letters & Retention Psychology](./ux-ai-reflection-letters.md)
- [Internationalization (i18n)](./logic-i18n.md)
- [Note Creation (NewNote) Guide](./newnote-construction-guide.md)
