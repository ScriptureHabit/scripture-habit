import { parseStructuredNoteText } from './note-parser-utils';
import { LANGUAGES } from '../config/languages';

export const LANGUAGE_PARAMS: Record<string, string> = Object.fromEntries(
    LANGUAGES.filter(l => l.code !== 'en').map(l => [l.code, `?lang=${l.ldsCode}`])
);

export const SLUG_TO_VOLUME: Record<string, string> = {
    // Old Testament
    'gen': 'ot', 'ex': 'ot', 'lev': 'ot', 'num': 'ot', 'deut': 'ot', 'josh': 'ot', 'judg': 'ot', 'ruth': 'ot',
    '1-sam': 'ot', '2-sam': 'ot', '1-kgs': 'ot', '2-kgs': 'ot', '1-chr': 'ot', '2-chr': 'ot', 'ezra': 'ot',
    'neh': 'ot', 'esth': 'ot', 'job': 'ot', 'ps': 'ot', 'prov': 'ot', 'eccl': 'ot', 'song': 'ot', 'isa': 'ot',
    'jer': 'ot', 'lam': 'ot', 'ezek': 'ot', 'dan': 'ot', 'hosea': 'ot', 'joel': 'ot', 'amos': 'ot', 'obad': 'ot',
    'jonah': 'ot', 'micah': 'ot', 'nahum': 'ot', 'hab': 'ot', 'zeph': 'ot', 'hag': 'ot', 'zech': 'ot', 'mal': 'ot',
    // New Testament
    'matt': 'nt', 'mark': 'nt', 'luke': 'nt', 'john': 'nt', 'acts': 'nt', 'rom': 'nt', '1-cor': 'nt', '2-cor': 'nt',
    'gal': 'nt', 'eph': 'nt', 'philip': 'nt', 'col': 'nt', '1-thes': 'nt', '2-thes': 'nt', '1-tim': 'nt', '2-tim': 'nt',
    'titus': 'nt', 'philem': 'nt', 'heb': 'nt', 'jas': 'nt', '1-pet': 'nt', '2-pet': 'nt', '1-jn': 'nt', '2-jn': 'nt',
    '3-jn': 'nt', 'jude': 'nt', 'rev': 'nt',
    // Book of Mormon
    '1-ne': 'bofm', '2-ne': 'bofm', 'jacob': 'bofm', 'enos': 'bofm', 'jarom': 'bofm', 'omni': 'bofm', 'w-of-m': 'bofm',
    'mosiah': 'bofm', 'alma': 'bofm', 'hel': 'bofm', '3-ne': 'bofm', '4-ne': 'bofm', 'morm': 'bofm', 'eth': 'bofm',
    'moro': 'bofm',
    // Pearl of Great Price & D&C
    'moses': 'pgp', 'abr': 'pgp', 'js-m': 'pgp', 'js-h': 'pgp', 'a-of-f': 'pgp',
    'dc': 'dc-testament', 'od': 'dc-testament'
};

const CANONICAL_BOOK_TO_SLUG: Record<string, string> = {
    // Book of Mormon
    "1 Nephi": "1-ne", "2 Nephi": "2-ne", "Jacob": "jacob", "Enos": "enos", "Jarom": "jarom", "Omni": "omni",
    "Words of Mormon": "w-of-m", "Mosiah": "mosiah", "Alma": "alma", "Helaman": "hel", "3 Nephi": "3-ne",
    "4 Nephi": "4-ne", "Mormon": "morm", "Ether": "eth", "Moroni": "moro",
    // Old Testament
    "Genesis": "gen", "Exodus": "ex", "Levicitus": "lev", "Numbers": "num", "Deuteronomy": "deut",
    "Joshua": "josh", "Judges": "judg", "Ruth": "ruth", "1 Samuel": "1-sam", "2 Samuel": "2-sam",
    "1 Kings": "1-kgs", "2 Kings": "2-kgs", "1 Chronicles": "1-chr", "2 Chronicles": "2-chr",
    "Ezra": "ezra", "Nehemiah": "neh", "Esther": "esth", "Job": "job", "Psalms": "ps", "Psalm": "ps",
    "Proverbs": "prov", "Ecclesiastes": "eccl", "Song of Solomon": "song", "Isaiah": "isa",
    "Jeremiah": "jer", "Lamentations": "lam", "Ezekiel": "ezek", "Daniel": "dan", "Hosea": "hosea",
    "Joel": "joel", "Amos": "amos", "Obadiah": "obad", "Jonah": "jonah", "Micah": "micah",
    "Nahum": "nahum", "Habakkuk": "hab", "Zephaniah": "zeph", "Haggai": "hag", "Zechariah": "zech",
    "Malachi": "mal",
    // New Testament
    "Matthew": "matt", "Mark": "mark", "Luke": "luke", "John": "john", "Acts": "acts", "Romans": "rom",
    "1 Corinthians": "1-cor", "2 Corinthians": "2-cor", "Galatians": "gal", "Ephesians": "eph",
    "Philippians": "philip", "Colossians": "col", "1 Thessalonians": "1-thes", "2 Thessalonians": "2-thes",
    "1 Timothy": "1-tim", "2 Timothy": "2-tim", "Titus": "titus", "Philemon": "philem", "Hebrews": "heb",
    "James": "jas", "1 Peter": "1-pet", "2 Peter": "2-pet", "1 John": "1-jn", "2 John": "2-jn",
    "3 John": "3-jn", "Jude": "jude", "Revelation": "rev",
    // Doctrine and Covenants & Pearl of Great Price
    "Doctrine and Covenants": "dc", "D&C": "dc", "Official Declaration": "od", "Official Declarations": "od",
    "Moses": "moses", "Abraham": "abr", "Joseph Smith-Matthew": "js-m", "Joseph Smith-History": "js-h",
    "Articles of Faith": "a-of-f"
};

const VOLUME_ALIASES: Record<string, string[]> = {
    ot: ["old testament", "ot", "old", "旧約聖書", "旧約", "velho testamento", "antigo testamento", "antiguo testamento", "cựu ước", "พันธสัญญาเดิม", "구약성경", "구약", "matandang tipan", "agano la kale", "旧约", "舊約"],
    nt: ["new testament", "nt", "new", "新約聖書", "新約", "novo testamento", "nuevo testamento", "tân ước", "พันธสัญญาใหม่", "신약성경", "신약", "bagong tipan", "agano jipya", "新约", "新約"],
    bofm: ["book of mormon", "bofm", "bom", "mormon", "モルモン書", "モルモン", "livro de mórmon", "libro de mormón", "sách mặc môn", "พระคัมภีร์มอรมอน", "몰몬경", "aklat ni mormon", "kitabu cha mormoni", "摩爾門經", "摩尔门经"],
    "dc-testament": ["dc", "d&c", "d.&c.", "d. & c.", "dc-testament", "doctrine and covenants", "教義と聖約", "doutrina e convênios", "教義和聖約", "doctrina y convenios", "giáo lý và giao ước", "หลักคำสอนและพันธสัญญา", "교리와 성약", "doktrina at mga tipan", "mafundisho na maagano", "教义和圣约"],
    pgp: ["pgp", "pearl of great price", "高価な真珠", "pérola de grande valor", "無價珍珠", "perla de gran precio", "trân châu vô giá", "ไข่มุกอันล้ำค่า", "값진 진주", "perlas na may dakilang halaga", "lulu ya thamani kuu", "无价珍珠"],
    "general-conference": ["general conference", "gc", "総大会", "conferência geral", "đại hội trung ương", "การประชุมใหญ่สามัญ", "연차대회", "pangkalahatang kumperensya", "mkutano mkuu", "总大会", "總大會"],
    "byu-speeches": ["byu-speeches", "byu speeches", "byu"],
    "ordinances-and-proclamations": ["ordinances and proclamations", "proclamations", "priesthood ordinances and proclamations", "儀式と宣言", "ordenanças e declarações", "聖職教儀和文告", "ordenanzas del sacerdocio y proclamaciones", "教仪和宣告", "mga ordinansa at mga pagpapahayag"]
};

const NON_SCRIPTURE_FALLBACKS = [
    {
        key: "ordinances-and-proclamations",
        keywords: [
            "proclamation", "proclamations", "ordinances and proclamations", "priesthood ordinances and proclamations", "family", "living christ", "restoration", "sacrament", "baptism",
            "儀式と宣言", "家族", "生けるキリスト", "回復", "聖餐", "バプテスマ",
            "proclama", "declaracion", "familia", "cristo viviente", "restauración", "bautismo", "ordenanzas del sacerdocio y proclamaciones",
            "declaração", "família", "cristo vivo", "restauração", "sacramento", "batismo", "ordenanças e declarações",
            "家庭", "活著的基督", "復興", "洗禮", "聖職教儀和文告", "教仪和宣告", "mga ordinansa at mga pagpapahayag",
            "선언문", "살あ 계신 그리스도", "살아 계신 그리스도", "회복", "침례", "tangazo", "kristo aliye hai", "urejesho", "sakramenti", "ubatizo"
        ]
    },
    {
        key: "general-conference",
        keywords: [
            "general conference", "gc", "conference", "churchofjesuschrist.org", "総大会", "大会", "conferência geral", "conferência",
            "conferencia general", "conferencia", "đại hội trung ương", "đại hội", "การประชุมใหญ่สามัญ", "การประชุมใหญ่",
            "연차대회", "대회", "pangkalahatang kumperensya", "kumperensya", "mkutano mkuu", "mkutano", "总大会", "總大會", "大會"
        ]
    },
    {
        key: "byu-speeches",
        keywords: ["byu-speeches", "byu speeches", "byu", "speeches.byu.edu"]
    }
];

const COMMON_BOOK_ALIASES: Record<string, string> = {
    // English & generic shorthands
    "1ne": "1-ne", "2ne": "2-ne", "3ne": "3-ne", "4ne": "4-ne",
    "1-ne": "1-ne", "2-ne": "2-ne", "3-ne": "3-ne", "4-ne": "4-ne",
    "bom": "bofm", "dc": "dc", "d&c": "dc", "od": "od",
    "d and c": "dc", "doctrine and covenants": "dc",
    // Japanese numeric & colloquial variants
    "1ニーファイ": "1-ne", "第1ニーファイ": "1-ne", "第１ニーファイ": "1-ne", "第一ニーファイ": "1-ne", "ニーファイ第一書": "1-ne", "ニーファイ第一の書": "1-ne",
    "2ニーファイ": "2-ne", "第2ニーファイ": "2-ne", "第２ニーファイ": "2-ne", "第二ニーファイ": "2-ne", "ニーファイ第二書": "2-ne", "ニーファイ第二の書": "2-ne",
    "3ニーファイ": "3-ne", "第3ニーファイ": "3-ne", "第３ニーファイ": "3-ne", "第三ニーファイ": "3-ne", "ニーファイ第三書": "3-ne", "ニーファイ第三の書": "3-ne",
    "4ニーファイ": "4-ne", "第4ニーファイ": "4-ne", "第４ニーファイ": "4-ne", "第四ニーファイ": "4-ne", "ニーファイ第四書": "4-ne", "ニーファイ第四の書": "4-ne",
    "モルモンの言葉": "w-of-m", "モルモン書": "morm", "信仰箇条": "a-of-f",
    // Chinese numeric variants
    "尼腓一書": "1-ne", "尼腓二書": "2-ne", "尼腓三書": "3-ne", "尼腓四書": "4-ne",
    // Korean numeric variants
    "니파이전서": "1-ne", "니파이후서": "2-ne", "제3니파이": "3-ne", "제4니파이": "4-ne",
    // Thai numeric variants
    "1 นีไฟ": "1-ne", "2 นีไฟ": "2-ne", "3 นีไฟ": "3-ne", "4 นีไฟ": "4-ne"
};

const BOOK_MAPPINGS: Record<string, string> = { ...COMMON_BOOK_ALIASES };

// Dynamically populate book name mappings from all book locale files
const bookFiles = import.meta.glob<Record<string, string>>('../locales/books/*.ts', { eager: true, import: 'default' });

for (const bundle of Object.values(bookFiles)) {
    if (!bundle || typeof bundle !== 'object') continue;
    for (const [englishBook, localizedBook] of Object.entries(bundle)) {
        if (typeof localizedBook !== 'string') continue;
        const slug = CANONICAL_BOOK_TO_SLUG[englishBook];
        if (!slug) continue;

        const normalizedLoc = localizedBook.toLowerCase().trim();
        const normalizedEng = englishBook.toLowerCase().trim();

        BOOK_MAPPINGS[normalizedLoc] = slug;
        BOOK_MAPPINGS[normalizedEng] = slug;

        // Strip punctuation, spaces, and suffixes
        BOOK_MAPPINGS[normalizedLoc.replace(/\s+/g, '')] = slug;
        BOOK_MAPPINGS[normalizedLoc.replace(/[.]/g, '')] = slug;
        BOOK_MAPPINGS[normalizedLoc.replace(/^第(?=\d)/, '')] = slug;
        BOOK_MAPPINGS[normalizedLoc.replace(/書$/, '')] = slug;
        BOOK_MAPPINGS[normalizedLoc.replace(/による福音書$/, '')] = slug;
    }
}

// 全角文字や記号の正規化
const normalizeChapterInput = (input: string): string => {
    return input
        .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
        .replace(/：/g, ':')
        .replace(/[，、]/g, ',')
        .replace(/\u3000/g, ' ')
        .replace(/[－—―]/g, '-')
        .replace(/章\s*(?=\d)/g, ':')
        .replace(/章/g, '')
        .replace(/節/g, '');
};

// Helper to detect volume from input
const detectVolume = (volume: string | null | undefined, chapterInput: string | null | undefined): string => {
    const targetVolume = volume ? volume.trim().toLowerCase() : "";

    // 1. Check direct matches in volume aliases
    for (const [key, aliases] of Object.entries(VOLUME_ALIASES)) {
        if (aliases.includes(targetVolume) || (key === 'dc-testament' && targetVolume.includes('doctrine and'))) {
            return key;
        }
    }

    if (!chapterInput) return "";

    const lowerChap = chapterInput.toLowerCase().trim();

    // 2. Check non-scripture volumes (General Conference, BYU Speeches, Proclamations)
    for (const item of NON_SCRIPTURE_FALLBACKS) {
        if (item.keywords.some(kw => lowerChap.includes(kw))) {
            return item.key;
        }
    }

    // 3. Try to parse book from chapter input and get volume directly from book
    const cleanChapterInput = normalizeChapterInput(chapterInput);
    const match = cleanChapterInput.match(/(.*?)\s*(\d+)(?::([\d\s,-]+))?\s*$/);
    if (match) {
        const rawBookName = match[1].trim().toLowerCase().replace(/[.]/g, '');
        const bookName = rawBookName.replace(/^第(?=\d)/, '');
        const slug = BOOK_MAPPINGS[bookName] || BOOK_MAPPINGS[rawBookName];
        if (slug && SLUG_TO_VOLUME[slug]) {
            return SLUG_TO_VOLUME[slug];
        }
    }

    // 4. Fallback check for volume aliases inside chapter text
    for (const [key, aliases] of Object.entries(VOLUME_ALIASES)) {
        if (aliases.some(alias => lowerChap.includes(alias))) {
            return key;
        }
    }

    return "";
};

const ORDINANCE_SLUGS = [
    {
        slug: "sacrament",
        keywords: ["sacrament", "聖餐", "sacramental", "tiệc thánh"]
    },
    {
        slug: "baptism",
        keywords: ["baptism", "バプテスマ", "batismo", "bautismo", "báp têm"]
    },
    {
        slug: "the-family-a-proclamation-to-the-world",
        keywords: ["family", "家族", "família", "proclamación sobre la family"]
    },
    {
        slug: "the-living-christ-the-testimony-of-the-apostles",
        keywords: ["living christ", "生けるキリスト", "cristo vivo", "cristo viviente"]
    },
    {
        slug: "the-restoration-of-the-fulness-of-the-gospel-of-jesus-christ",
        keywords: ["restoration", "回復", "restauração", "restauración"]
    }
];

// 節のパラメータ (&id=p1#p1) を構築
const buildVerseSuffix = (verses: string | undefined, langParam: string): string => {
    if (!verses) return langParam;
    const idValue = verses.replace(/\d+/g, m => `p${m}`);
    const firstVerse = verses.match(/\d+/)?.[0];
    return idValue ? `${langParam}&id=${idValue}${firstVerse ? `#p${firstVerse}` : ""}` : langParam;
};

export const getGospelLibraryUrl = (volume: string | null | undefined, chapterInput: string | null | undefined, language: string = 'en'): string | null => {
    if (!chapterInput) return null;

    const baseUrl = "https://www.churchofjesuschrist.org/study/scriptures";
    let langParam = LANGUAGE_PARAMS[language] || "?lang=eng";

    let volumeUrlPart = detectVolume(volume, chapterInput);
    if ((volumeUrlPart === 'ot' || volumeUrlPart === 'nt') && language === 'vi') {
        langParam = "?lang=eng";
    }

    // 1. 総大会 (General Conference)
    if (volumeUrlPart === "general-conference") {
        if (chapterInput.includes("churchofjesuschrist.org")) {
            try {
                let urlStr = chapterInput.trim();
                if (!urlStr.startsWith('http')) urlStr = 'https://' + urlStr;
                const url = new URL(urlStr);
                url.searchParams.set('lang', langParam.split('=')[1]);
                return url.toString();
            } catch {
                return chapterInput;
            }
        }
        if (/^\d{4}\/\d{2}/.test(chapterInput)) {
            return `https://www.churchofjesuschrist.org/study/general-conference/${chapterInput}${langParam}`;
        }
    }

    // 2. BYU Speeches
    if (volumeUrlPart === "byu-speeches") return chapterInput;

    // 3. 宣言と儀式 (Ordinances and Proclamations)
    if (volumeUrlPart === "ordinances-and-proclamations") {
        const lowerChap = chapterInput.toLowerCase();
        for (const item of ORDINANCE_SLUGS) {
            if (item.keywords.some(kw => lowerChap.includes(kw))) {
                return `${baseUrl}/${item.slug}${langParam}`;
            }
        }
        return `${baseUrl}/ordinances-and-proclamations${langParam}`;
    }

    // 4. 通常の聖典書籍の解析
    const cleanChapterInput = normalizeChapterInput(chapterInput);
    const match = cleanChapterInput.match(/(.*?)\s*(\d+)(?::([\d\s,-]+))?\s*$/);
    if (!match) return null;

    const rawBookName = match[1].trim().toLowerCase().replace(/[.]/g, '');
    const bookName = rawBookName.replace(/^第(?=\d)/, '');
    const chapterNum = match[2];
    const verses = match[3];

    let bookUrlPart = BOOK_MAPPINGS[bookName] || BOOK_MAPPINGS[rawBookName];
    if (!bookUrlPart && volumeUrlPart === "dc-testament" && !bookName) {
        bookUrlPart = "dc";
    }
    if (!bookUrlPart) return null;

    if (!volumeUrlPart) {
        volumeUrlPart = SLUG_TO_VOLUME[bookUrlPart] || "";
    }
    if (!volumeUrlPart) return null;

    const urlSuffix = buildVerseSuffix(verses, langParam);

    if (volumeUrlPart === "dc-testament" && bookUrlPart === "dc") {
        return `${baseUrl}/dc-testament/dc/${chapterNum}${urlSuffix}`;
    }
    return `${baseUrl}/${volumeUrlPart}/${bookUrlPart}/${chapterNum}${urlSuffix}`;
};

export const getCategoryFromScripture = (scriptureText: string | null | undefined): string => {
    const url = getGospelLibraryUrl(null, scriptureText);
    let volumeUrlPart = "";
    if (url) {
        const scriptMatch = url.match(/\/scriptures\/([^/?#]+)/);
        if (scriptMatch) volumeUrlPart = scriptMatch[1];
        else if (url.includes('/general-conference/')) volumeUrlPart = 'general-conference';
        else if (url.includes('speeches.byu.edu')) volumeUrlPart = 'byu-speeches';
    }
    if (!volumeUrlPart) volumeUrlPart = detectVolume(null, scriptureText);

    const mapping: Record<string, string> = {
        'ot': 'Old Testament', 'nt': 'New Testament', 'bofm': 'Book of Mormon', 'dc-testament': 'Doctrine and Covenants', 'pgp': 'Pearl of Great Price',
        'ordinances-and-proclamations': 'Ordinances and Proclamations', 'sacrament': 'Ordinances and Proclamations', 'baptism': 'Ordinances and Proclamations',
        'the-family-a-proclamation-to-the-world': 'Ordinances and Proclamations', 'the-living-christ-the-testimony-of-the-apostles': 'Ordinances and Proclamations',
        'the-restoration-of-the-fulness-of-the-gospel-of-jesus-christ': 'Ordinances and Proclamations', 'general-conference': 'General Conference', 'byu-speeches': 'BYU Speeches'
    };
    return mapping[volumeUrlPart] || 'Other';
};

export const getScriptureInfoFromText = (text: string | null | undefined): string | null => {
    if (!text) return null;
    const parsed = parseStructuredNoteText(text);
    if (parsed.scriptureValue && parsed.chapterValue) {
        return getGospelLibraryUrl(parsed.scriptureValue, parsed.chapterValue);
    }
    return null;
};
