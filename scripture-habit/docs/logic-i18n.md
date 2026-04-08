# I18n & Localization: Global Foundation

**scripture-habit** is a global-first application. Our localization strategy ensures that every user, regardless of their language (English, Japanese, Spanish, Tagalog, etc.), feels at home with both the interface and the content.

---

## 🎨 Frontend Architecture: `LanguageContext`

The heart of frontend localization is the `LanguageContext.tsx`.

### 1. The `t()` Hook
We use a streamlined translation hook that provides:
- **String Interpolation**: Supports dynamic values (e.g., `"{name} added a note"`).
- **Graceful Fallback**: If a key is missing in the current language, it automatically returns the English (`en`) equivalent to avoid blank UI elements.

### 2. Scripture Book Normalization
Handling scripture titles across languages is difficult. We solve this with a **Mapping Strategy**:
- All scripture data is stored internally with a standardized key.
- The `UI` Layer uses a mapping function (e.g., `getBookTitle(standardKey, userLang)`) to display "Book of Mormon" as "モルモン書" or "Libro de Mormón" instantly.

---

## ⚙️ Backend Logic: Template System

The backend (`api_internal/lib/i18n.ts`) handles strings for system messages, push notifications, and AI prompts.

### Locale Bundles
Translations are stored in modular `.ts` files under `api_internal/locales/`. 
- **Type Safety**: The `SupportedLanguage` type ensures we only attempt to load valid bundles.
- **Replacements**: A robust substitution engine handles placeholders like `{nickname}` or `{streak}` within notification templates.

---

## 🤖 AI Localization: Content Translation

Unlike static UI strings, user-generated study notes are localized dynamically.

### 1. Auto-Detection
The app detects if a note's language differs from the viewer's preferred language.

### 2. AI Translation (`/api/translate`)
- The backend identifies the `targetLanguage`.
- A specialized AI prompt ensures that the markdown structure is preserved while the religious terminology is translated accurately.
- **Result Persistence**: The translation is saved to the message document, ensuring it only needs to be translated *once* per language.

---

## 🌍 Supported Language Matrix

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

1.  **Backend**: Add a new file in `api_internal/locales/` (e.g., `fr.ts`) and register it in `i18n.ts`.
2.  **Frontend**: Update `LanguageContext.tsx` with the new translation bundle and flag icon.
3.  **AI**: Add the language name to `languageNames` in `lib/schemas.ts` so the AI knows the target destination.
