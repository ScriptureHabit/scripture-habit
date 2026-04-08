# AI Integration: Intelligence Layer

The **scripture-habit** application leverages Google's Gemini AI to provide intelligent study assistance, automated translations, and periodic progress reflections.

---

## 🤖 Core Engine: Gemini 3.1

The application uses the **Gemini 3.1 Flash-Lite Preview** model for all AI operations. This model is chosen for its:
- **High Speed**: Minimal latency for translation and question generation.
- **Low Cost**: Optimized for volume (batch translations, multiple user recaps).
- **Thinking Configuration**: The API calls are configured with `thinkingLevel: "minimal"` to maximize response speed.

### API Entry Point
The backend routes for AI are centralized in `api_internal/routes/ai.ts`. All requests are authenticated and protected by **Firebase AppCheck**.

---

## ✨ Core Features

### 1. Ponder Questions (`/api/generate-ponder-questions`)
Generates a reflective question based on a specific scripture reference.
- **Context**: Uses the scripture name and chapter/verse.
- **Localization**: Prompts are dynamically adjusted to respond in the user's current language (`targetLangName`).
- **Style**: Guided by a "warm, encouraging facilitator" persona to avoid overly academic or theological jargon.

### 2. Intelligent Translation (`/api/translate` & `/api/translate-batch`)
Translates user notes while preserving their semantic structure.
- **Markdown Preservation**: The AI is strictly instructed to keep the `**Category:**`, `**Chapter:**`, and `**Comment:**` labels intact during translation.
- **Scripture Awareness**: It maps scripture book names between languages (e.g., mapping "1 Nephi" to its Japanese equivalent).
- **Caching (`translation_cache` collection)**: To save costs and reduce latency, translations are cached using an MD5 hash of `text + targetLanguage`.

### 3. Weekly Recaps (`/api/generate-weekly-recap`)
Aggregates a week's worth of group activity into an uplifting summary.
- **Data Filtering**: Collects up to 100 messages from the last 7 days.
- **Safeguards**: Implements a **6-day cooldown** at the database level to prevent redundant generation and excessive API costs.
- **Output**: Automatically posted as a `systemMessage` (type `weeklyRecap`) for all group members to see.

---

## 🛡️ Technical Safeguards

### Performance & Cost
- **AI Rate Limiter**: A specific middleware (`aiLimiter`) prevents spamming the AI endpoints.
- **Batch Processing**: When a user joins a group with multiple unread messages, the app uses the `translate-batch` endpoint to process multiple messages in a single AI prompt.

### Reliability
- **AppCheck Verification**: Ensures that only requests from the official app (web or mobile) can trigger AI calls, protecting against direct API abuse.
- **JSON Sanitization**: For batch requests, the backend implements robust "JSON Cleaning" logic to handle cases where the AI might wrap its response in markdown code blocks.

---

## 📅 Usage Lifecycle

1.  **Direct User Action**: User clicks "Ask AI Question" in the `NewNote` modal or "Translate" on a message.
2.  **Context Injection**: The backend prepares a specialized prompt including the `targetLangName` and study context.
3.  **Persistence**: The result is often saved directly to the database (e.g., `translations` map on the message document) so it's instantly available for other users in the same group.
