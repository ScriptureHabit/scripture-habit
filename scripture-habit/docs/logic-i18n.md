# I18n & Localization: Global Reach

**scripture-habit** is designed for a global audience, supporting multiple languages (English, Japanese, Spanish, Portuguese, Chinese, etc.) across both the user interface and system-generated content.

---

## 🎨 Frontend Localization

The frontend Uses a React Context-based system (**`LanguageContext`**) to manage the current UI language.

### Key Logic
- **`useLanguage` Hook**: Provides the `t()` function to components for immediate translation.
- **Dynamic Book Mapping**: The `bookTranslations` map ensures that scripture books (e.g., "Mormon 1") are always displayed in the user's preferred language, even if the underlying data is stored in English.
- **Date/Time Localization**: Uses standard JavaScript `Intl` APIs combined with the user's selected language to format dates according to local conventions.

---

## ⚙️ Backend Localization

The backend API handles localized content for system messages, automated posts, and push notifications.

### `api_internal/lib/i18n.ts`
This library acts as the central hub for server-side translations:
- **`translations` Bundle**: A static store of all translated strings (locales) for backend triggers.
- **`t(lang, key, replacements)`**:
  - Fetches the correct string based on the user's documented language preference.
  - Supports string interpolation (e.g., `"{nickname} started a streak!"`).
  - **Auto-fallback**: If a key is missing in the target language, it automatically falls back to English to prevent empty UI elements.

---

## 🤖 AI-Driven Content Localization

Traditional i18n handles static strings, but **scripture-habit** also localizes user-generated content using AI.

### Automated Translation
When a user views a note in a group with members speaking mixed languages:
1.  The app detects if the note's language differs from the viewer's language.
2.  It invokes the AI Translation subsystem (`/api/translate`).
3.  The result is cached and persisted, allowing for a localized chat experience without manual translation.

### Localized Recaps & Questions
The AI is instructed to generate **Weekly Recaps** and **Ponder Questions** directly in the specific dialect of the user. For example, a group of Japanese speakers will receive an AI-generated summary entirely in Japanese, even if the system-level prompts were managed in a mix of languages.

---

## 🌎 Supported Languages

We currently support and maintain locale files for:
- English (`en`)
- Japanese (`ja`)
- Spanish (`es`)
- Portuguese (`pt`)
- Chinese (`zh`/`zho`)
- Vietnamese (`vi`)
- Thai (`th`)
- Korean (`ko`)
- Tagalog (`tl`)
- Swahili (`sw`)
