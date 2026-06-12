# I18n & Localization

Scripture Habit is designed for global users. The localization system ensures that all users can use the app in their preferred language (English, Japanese, Spanish, Tagalog, etc.).

---

## 🎨 Frontend Architecture: Language Context & Provider

Frontend localization is split into two files:
- **`src/context/language-context.ts`**: Declares types and the context instance.
- **`src/context/language-provider.tsx`**: Manages state, translation files, and browser caching.

### 1. The `t()` Translation Helper
A custom hook that provides:
- **Variable Insertion**: Supports dynamic text like `"{name} added a note"`.
- **English Fallback**: If a translation key is missing in the current language, it displays the English (`en`) translation instead of leaving the UI blank.

### 2. Scripture Book Translations
To display scripture book names correctly in multiple languages, we use a mapping function:
- Book names are stored using a standard key.
- The UI uses `translateBookName(bookName)` to show "Book of Mormon" as "モルモン書" or "Libro de Mórmon" based on the user's language setting.

---

## ⚙️ Backend Localization: Template System

The backend (`api_internal/lib/i18n.ts`) manages translations for system messages, push notifications, and AI instructions.

### Translation Bundles
Translations are stored in TypeScript files under `api_internal/locales/`.
- **Type Safety**: The `SupportedLanguage` type ensures only valid language codes are used.
- **Dynamic Text**: Replaces placeholders like `{nickname}` or `{streak}` inside notification templates.

---

## 🤖 AI Localization: Content Translation

User-generated study notes are translated dynamically by AI rather than using static files.

### 1. Language Detection
The app detects if a note's language is different from the viewer's preferred language.

### 2. AI Translation Endpoint (`/api/translate`)
- The backend identifies the target language (`targetLanguage`).
- A specialized AI prompt translates religious terms accurately while keeping the markdown format intact.
- **Caching**: The translation is saved directly to the message document, so it is only translated once per language.

---

## 🌍 Supported Languages

| Code | Language | Region |
| :--- | :--- | :--- |
| `en` | English | Global |
| `ja` | Japanese | Japan |
| `es` | Spanish | Latin America / Spain |
| `pt` | Portuguese | Brazil / Portugal |
| `zh` | Chinese | Simpl. / Trad. |
| `vi` | Vietnamese | Vietnam |
| `th` | Thai | Thailand |
| `ko` | Korean | South Korea |
| `tl` | Tagalog | Philippines |
| `sw` | Swahili | East Africa |

---

## 🚀 Adding a New Language

1.  **Backend**: Create a translation file in `api_internal/locales/` (e.g., `fr.ts`) and register it in `i18n.ts`.
2.  **Frontend**: Update `src/context/language-provider.tsx` with the new translation bundle and flag icon.
3.  **AI**: Add the language name to the supported list in `lib/schemas.ts` so the AI can translate to it.
