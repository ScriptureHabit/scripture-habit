---
name: Add a New Language
about: Propose or volunteer to translate Scripture Habit into a new language.
title: "[Translation]: Add [Language Name] support"
labels: ["i18n", "help wanted", "good first issue"]
assignees: ''

---

## Language Information

- **Language Name (English)**: (e.g. Italian, French, German, Indonesian)
- **Native Name**: (e.g. Italiano, Français, Deutsch, Bahasa Indonesia)
- **2 or 3-letter Language Code**: (e.g. `it` or `ita`, `fr` or `fra`, `de` or `deu`)
- **Country Flag ISO Code**: (e.g. `IT`, `FR`, `DE`)
- **LDS Gospel Library 3-letter Code** (if known): (e.g. `ita`, `fra`, `deu`, `ind`)

---

## Volunteering

- [ ] I would like to translate the strings myself.
- [ ] I can help review and verify natural phrasing for this language.
- [ ] I am requesting this language so other community members/translators can work on it.

---

## Translation Guide & Steps

1. Copy `src/locales/en.ts` to `src/locales/<code_or_name>.ts`
2. Update the `_meta` configuration header at the top of the file.
3. Translate the strings from English.
4. Run `npm run check:i18n` to ensure all keys match 100%.
5. Open a Pull Request.

---

## Additional Notes / Context
*Any special notes regarding gospel terminology, scriptures, or font rendering:*
