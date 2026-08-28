# Gospel Library URL Mapper

The `Gospel Library Mapper` (`src/utils/gospel-library-mapper.ts`) translates user inputs, scripture citations, volumes, and topics into official study URLs on the Church of Jesus Christ of Latter-day Saints website.

It cleans and parses strings, resolves verse selections, and creates deep-links with highlight parameters for multiple languages.

---

## Technical Pipeline & Data Flow

The mapper processes inputs through a 5-step pipeline to create a deep-linked URL:

```mermaid
flowchart TD
    classDef input fill:#1e1b4b,stroke:#a855f7,stroke-width:2px,color:#f8fafc;
    classDef step fill:#1e293b,stroke:#64748b,stroke-width:1.5px,color:#f8fafc;
    classDef output fill:#064e3b,stroke:#10b981,stroke-width:2px,color:#f0fdf4;

    A["Raw Input: Book, Volume, Chapter, Verse"]:::input --> B["Step 1: Volume Detection & Language Resolution"]:::step
    B --> C["Step 2: String Cleansing & Normalization"]:::step
    C --> D["Step 3: Regex Book / Chapter / Verse Parsing"]:::step
    D --> E["Step 4: Book Slug Mapping"]:::step
    E --> F["Step 5: Route Customization & Deep Link Hash Generation"]:::step
    F --> G["🌟 Output: Deep-Linked Gospel Library URL"]:::output
```

---

## Core Functions

The module exports three main functions:

### 1. `getGospelLibraryUrl(...)`
The main function. Given a volume, chapter/scripture text, and a language, it builds the correct URL.
```typescript
getGospelLibraryUrl(
  volume: string | null | undefined,
  chapterInput: string | null | undefined,
  language: string = 'en'
): string | null
```

### 2. `getCategoryFromScripture(...)`
Finds the scripture category (e.g., "Book of Mormon", "General Conference") from a raw string.
```typescript
getCategoryFromScripture(scriptureText: string | null | undefined): string
```

### 3. `getScriptureInfoFromText(...)`
Reads markdown-like notes for structural lines (`**Chapter:**` or `**Scripture:**`) and creates the correct study URL.
```typescript
getScriptureInfoFromText(text: string | null | undefined): string | null
```

---

## Step-by-Step Implementation

### Step 1: Volume Detection & Language Mapping
- **Multi-Lingual Matching**: Detects the volume from user inputs (such as "Old Testament", "モルモン書", "Velho Testamento") in English, Japanese, Portuguese, Chinese, Spanish, Vietnamese, Thai, Korean, Tagalog, and Swahili.
- **Language Code Conversion**: Converts application language codes to the Church's official three-letter query parameters:
  - `'en'` $\rightarrow$ `?lang=eng`
  - `'ja'` $\rightarrow$ `?lang=jpn`
  - `'pt'` $\rightarrow$ `?lang=por`
  - `'zho'` $\rightarrow$ `?lang=zho`
  - `'es'` $\rightarrow$ `?lang=spa`
  - `'vi'` $\rightarrow$ `?lang=vie`
  - `'th'` $\rightarrow$ `?lang=tha`
  - `'ko'` $\rightarrow$ `?lang=kor`
  - `'tl'` $\rightarrow$ `?lang=tgl`
  - `'sw'` $\rightarrow$ `?lang=swa`
  
> [!NOTE]
> **Vietnamese Fallback**: For Old Testament (`ot`) and New Testament (`nt`) volumes, Vietnamese parameters fall back to English (`?lang=eng`) because Vietnamese translations are not available on the official website for these volumes.

---

### Step 2: Normalization & Sanitization
To handle different keyboards and copy-paste inputs, the mapper cleans strings before parsing:
- **Full-Width to Half-Width**: Converts full-width numbers (`０-９`) to standard numbers (`0-9`).
- **Punctuation Alignment**:
  - Colons: `：` $\rightarrow$ `:`
  - Commas: `，` or `、` $\rightarrow$ `,`
  - Spaces: `\u3000` $\rightarrow$ ` ` (Standard Space)
  - Dashes: `－`, `—`, or `―` $\rightarrow$ `-`
- **Suffix Removal**: Converts localized suffixes like Japanese `"章"` (Chapter) to standard colon notation, and deletes standalone `"章"` and `"節"` (Verse) characters.

---

### Step 3: Regex Parsing
A regular expression extracts book names, chapter numbers, and verse boundaries:
```typescript
const match = cleanChapterInput.match(/(.*?)\s*(\d+)(?::([\d\s,-]+))?\s*$/);
```

#### Extracted Components:
- **Book Name** (`match[1]`): Cleaned of dots, converted to lowercase, and strips the Japanese prefix `"第"` if followed by a number.
- **Chapter Number** (`match[2]`): Formatted to a standard string.
- **Verses** (`match[3]`): Captures ranges (e.g. `3-5`), single verses, or comma-separated lists.

---

### Step 4: Multi-Language Dictionary Mapping
The mapper contains a dictionary with over **150+ mappings** representing scripture books across **10 different languages**.

#### Example Book Mappings:
- **1 Nephi**: `"1 nephi"`, `"1 néfi"`, `"1ニーファイ"`, `"第1ニーファイ"`, `"尼腓一書"`, `"1 นีไฟ"`, `"니파이전서"`.
- **Doctrine and Covenants**: `"doctrine and covenants"`, `"教義と聖約"`, `"doutrina e convênios"`, `"doctrina y convenios"`, `"giáo lý và giao ước"`, `"d&c"`, `"dc"`.

#### Volume Fallback:
If a user inputs a book citation without specifying the volume, the mapper uses a `slugToVolume` map (e.g. mapping `gen` $\rightarrow$ `ot`, `1-ne` $\rightarrow$ `bofm`, `dc` $\rightarrow$ `dc-testament`) to find the volume automatically.

---

### Step 5: Routing Rules & Deep-Linking

The URL is compiled according to the resolved category:

#### 1. Standard Scriptures
`https://www.churchofjesuschrist.org/study/scriptures/{volumeUrlPart}/{bookUrlPart}/{chapterNum}{urlSuffix}`

#### 2. Doctrine & Covenants (Nested Path)
`https://www.churchofjesuschrist.org/study/scriptures/dc-testament/dc/{chapterNum}{urlSuffix}`

#### 3. General Conference Links
- **Full URLs**: If the input is already a full `churchofjesuschrist.org` URL, it updates the language parameter (`?lang=...`) to match the user's current session.
- **Shortcodes**: Supports formats like `YYYY/MM/DD` or `YYYY/MM` and compiles them into:
  `https://www.churchofjesuschrist.org/study/general-conference/{chapterInput}{langParam}`

#### 4. Ordinances & Proclamations
Maps specific terms to dedicated URLs:
- **Sacrament** $\rightarrow$ `/study/scriptures/sacrament`
- **Baptism** $\rightarrow$ `/study/scriptures/baptism`
- **The Family Proclamation** $\rightarrow$ `/study/scriptures/the-family-a-proclamation-to-the-world`
- **The Living Christ** $\rightarrow$ `/study/scriptures/the-living-christ-the-testimony-of-the-apostles`
- **The Restoration Proclamation** $\rightarrow$ `/study/scriptures/the-restoration-of-the-fulness-of-the-gospel-of-jesus-christ`
- **Default Category Landing** $\rightarrow$ `/study/scriptures/ordinances-and-proclamations`

#### 5. BYU Speeches Passthrough
Treats BYU Speeches input as an external reference and returns the `chapterInput` directly without changes.

---

## Deep-Link Verse Highlighting & Scrolling

To provide deep-links, the mapper parses the verses captured in **Step 3** to build HTML hash attributes:

1.  **Selection Highlight (`id` Parameter)**:
    Converts digits in the verse string into `p`-prefixed parameters for the Church website.
    -   *Input*: `"3-5"` $\rightarrow$ `&id=p3-p5`
    -   *Result*: Highlights verses 3 to 5 on the webpage.
2.  **Auto-Scroll Anchor (`#` Hash)**:
    Extracts the first verse number and appends it as an anchor hash.
    -   *Input*: `"3-5"` $\rightarrow$ `#p3`
    -   *Result*: Scrolls the browser down to the starting verse.

### Example Generation:
*   **Input**: `getGospelLibraryUrl("Book of Mormon", "Alma 32:21", "es")`
*   **Output**: `https://www.churchofjesuschrist.org/study/scriptures/bofm/alma/32?lang=spa&id=p21#p21`
