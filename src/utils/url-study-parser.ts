import { LOCALES_BY_CODE } from '../locales/scripture-metadata';
import { ScriptureValue } from '../data/data';

export interface ParsedStudyUrl {
    type: 'scripture' | 'general-conference' | 'byu' | 'other';
    category: ScriptureValue;
    categoryLabel: string;
    bookName?: string;
    chapter?: string;
    verses?: string;
    sessionLabel?: string;
    speaker?: string;
    title?: string;
    normalizedUrl: string;
}

const VOLUME_SLUG_TO_CATEGORY: Record<string, ScriptureValue> = {
    'ot': 'Old Testament',
    'nt': 'New Testament',
    'bofm': 'Book of Mormon',
    'dc-testament': 'Doctrine and Covenants',
    'pgp': 'Pearl of Great Price',
    'ordinances-and-proclamations': 'Ordinances and Proclamations'
};

const CATEGORY_TO_LOCALES_KEY: Record<ScriptureValue, string> = {
    'Old Testament': 'oldTestament',
    'New Testament': 'newTestament',
    'Book of Mormon': 'bookOfMormon',
    'Doctrine and Covenants': 'doctrineAndCovenants',
    'Pearl of Great Price': 'pearlOfGreatPrice',
    'Ordinances and Proclamations': 'ordinancesAndProclamations',
    'General Conference': 'generalConference',
    'BYU Speeches': 'byuSpeeches',
    'Other': 'other'
};

const SLUG_TO_CANONICAL_BOOK: Record<string, string> = {
    // Old Testament
    'gen': 'Genesis', 'ex': 'Exodus', 'lev': 'Leviticus', 'num': 'Numbers', 'deut': 'Deuteronomy',
    'josh': 'Joshua', 'judg': 'Judges', 'ruth': 'Ruth', '1-sam': '1 Samuel', '2-sam': '2 Samuel',
    '1-kgs': '1 Kings', '2-kgs': '2 Kings', '1-chr': '1 Chronicles', '2-chr': '2 Chronicles',
    'ezra': 'Ezra', 'neh': 'Nehemiah', 'esth': 'Esther', 'job': 'Job', 'ps': 'Psalms',
    'prov': 'Proverbs', 'eccl': 'Ecclesiastes', 'song': 'Song of Solomon', 'isa': 'Isaiah',
    'jer': 'Jeremiah', 'lam': 'Lamentations', 'ezek': 'Ezekiel', 'dan': 'Daniel',
    'hosea': 'Hosea', 'joel': 'Joel', 'amos': 'Amos', 'obad': 'Obadiah', 'jonah': 'Jonah',
    'micah': 'Micah', 'nahum': 'Nahum', 'hab': 'Habakkuk', 'zeph': 'Zephaniah',
    'hag': 'Haggai', 'zech': 'Zechariah', 'mal': 'Malachi',
    // New Testament
    'matt': 'Matthew', 'mark': 'Mark', 'luke': 'Luke', 'john': 'John', 'acts': 'Acts',
    'rom': 'Romans', '1-cor': '1 Corinthians', '2-cor': '2 Corinthians', 'gal': 'Galatians',
    'eph': 'Ephesians', 'philip': 'Philippians', 'col': 'Colossians', '1-thes': '1 Thessalonians',
    '2-thes': '2 Thessalonians', '1-tim': '1 Timothy', '2-tim': '2 Timothy', 'titus': 'Titus',
    'philem': 'Philemon', 'heb': 'Hebrews', 'jas': 'James', '1-pet': '1 Peter', '2-pet': '2 Peter',
    '1-jn': '1 John', '2-jn': '2 John', '3-jn': '3 John', 'jude': 'Jude', 'rev': 'Revelation',
    // Book of Mormon
    '1-ne': '1 Nephi', '2-ne': '2 Nephi', 'jacob': 'Jacob', 'enos': 'Enos', 'jarom': 'Jarom',
    'omni': 'Omni', 'w-of-m': 'Words of Mormon', 'mosiah': 'Mosiah', 'alma': 'Alma',
    'hel': 'Helaman', '3-ne': '3 Nephi', '4-ne': '4 Nephi', 'morm': 'Mormon', 'eth': 'Ether',
    'moro': 'Moroni',
    // Doctrine and Covenants & Pearl of Great Price
    'dc': 'Doctrine and Covenants', 'od': 'Official Declaration',
    'moses': 'Moses', 'abr': 'Abraham', 'js-m': 'Joseph Smith-Matthew', 'js-h': 'Joseph Smith-History',
    'a-of-f': 'Articles of Faith',
    // Ordinances and Proclamations
    'sacrament': 'Sacrament Prayers',
    'baptism': 'Baptism Ordinance',
    'the-family-a-proclamation-to-the-world': 'The Family: A Proclamation to the World',
    'the-living-christ-the-testimony-of-the-apostles': 'The Living Christ',
    'the-restoration-of-the-fulness-of-the-gospel-of-jesus-christ': 'Restoration Proclamation'
};

/**
 * Resolve localized category label.
 */
export function getLocalizedCategoryLabel(category: ScriptureValue, language: string = 'ja'): string {
    const locale = LOCALES_BY_CODE[language] || LOCALES_BY_CODE['ja'] || LOCALES_BY_CODE['en'];
    const key = CATEGORY_TO_LOCALES_KEY[category];
    return locale?.scriptures?.[key] || category;
}

/**
 * Resolve localized book name from canonical English name.
 */
export function getLocalizedBookName(canonicalBook: string, language: string = 'ja'): string {
    const locale = LOCALES_BY_CODE[language] || LOCALES_BY_CODE['ja'] || LOCALES_BY_CODE['en'];
    return locale?.books?.[canonicalBook] || canonicalBook;
}

/**
 * Parse verse numbers from query param (id=p1-p5 or id=p7) or hash (#p1, #p1-p5).
 */
function parseVerses(urlObj: URL): string | undefined {
    const idParam = urlObj.searchParams.get('id') || '';
    const hash = urlObj.hash || '';

    const target = idParam || hash.replace(/^#/, '');
    if (!target) return undefined;

    // Pattern like p1-p5 or 1-5 or p7 or 7
    const rangeMatch = target.match(/p?(\d+)\s*[-–—]\s*p?(\d+)/i);
    if (rangeMatch) {
        return `${rangeMatch[1]}-${rangeMatch[2]}`;
    }

    const singleMatch = target.match(/p?(\d+)/i);
    if (singleMatch) {
        return singleMatch[1];
    }

    return undefined;
}

/**
 * Parse an incoming URL to detect its type, category, book, chapter, and session metadata.
 */
export function parseStudyUrl(rawUrl: string, language: string = 'ja'): ParsedStudyUrl {
    const trimmed = rawUrl.trim();
    let urlObj: URL;

    try {
        urlObj = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    } catch {
        // Fallback for non-parseable URLs
        const cat: ScriptureValue = 'Other';
        return {
            type: 'other',
            category: cat,
            categoryLabel: getLocalizedCategoryLabel(cat, language),
            normalizedUrl: trimmed
        };
    }

    const host = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname.replace(/\/+$/, ''); // Remove trailing slash
    const isChurchDomain = host === 'churchofjesuschrist.org' || host === 'www.churchofjesuschrist.org' || host.endsWith('.churchofjesuschrist.org');
    const isByuDomain = host === 'speeches.byu.edu' || host.endsWith('.byu.edu');

    // 1. Gospel Library Scriptures
    // Pattern: /study/scriptures/:volume/:book/:chapter?
    // Or ordinances: /study/scriptures/ordinances-and-proclamations/:slug
    if (isChurchDomain && pathname.includes('/study/scriptures/')) {
        const parts = pathname.split('/').filter(Boolean);
        // parts example: ['study', 'scriptures', 'ot', 'prov', '22']
        const scripturesIdx = parts.indexOf('scriptures');
        if (scripturesIdx !== -1 && parts.length > scripturesIdx + 1) {
            const volumeSlug = parts[scripturesIdx + 1];
            const bookSlug = parts[scripturesIdx + 2];
            const chapterPart = parts[scripturesIdx + 3];

            const category = VOLUME_SLUG_TO_CATEGORY[volumeSlug] || 'Other';
            const canonicalBook = bookSlug ? (SLUG_TO_CANONICAL_BOOK[bookSlug] || bookSlug) : undefined;
            const bookName = canonicalBook ? getLocalizedBookName(canonicalBook, language) : undefined;
            const verses = parseVerses(urlObj);

            return {
                type: 'scripture',
                category,
                categoryLabel: getLocalizedCategoryLabel(category, language),
                bookName,
                chapter: chapterPart,
                verses,
                normalizedUrl: urlObj.toString()
            };
        }
    }

    // 2. General Conference
    // Pattern: /study/general-conference/:year/:month(/:slug)?
    if (isChurchDomain && pathname.includes('/study/general-conference/')) {
        const parts = pathname.split('/').filter(Boolean);
        const gcIdx = parts.indexOf('general-conference');
        if (gcIdx !== -1 && parts.length >= gcIdx + 3) {
            const year = parts[gcIdx + 1];
            const month = parts[gcIdx + 2];

            let sessionLabel: string;
            if (/^\d{4}$/.test(year) && /^\d{2}$/.test(month)) {
                if (language === 'ja') {
                    sessionLabel = `${year}年${parseInt(month, 10)}月総大会`;
                } else {
                    const monthName = parseInt(month, 10) === 4 ? 'April' : parseInt(month, 10) === 10 ? 'October' : month;
                    sessionLabel = `${monthName} ${year} General Conference`;
                }
            } else {
                sessionLabel = language === 'ja' ? '総大会' : 'General Conference';
            }

            const category: ScriptureValue = 'General Conference';
            return {
                type: 'general-conference',
                category,
                categoryLabel: getLocalizedCategoryLabel(category, language),
                sessionLabel,
                normalizedUrl: urlObj.toString()
            };
        }
    }

    // 3. BYU Speeches
    if (isByuDomain || (isChurchDomain && pathname.includes('/speeches/'))) {
        const category: ScriptureValue = 'BYU Speeches';
        return {
            type: 'byu',
            category,
            categoryLabel: getLocalizedCategoryLabel(category, language),
            normalizedUrl: urlObj.toString()
        };
    }

    // 4. Other Church content or external URLs
    const category: ScriptureValue = 'Other';
    return {
        type: 'other',
        category,
        categoryLabel: getLocalizedCategoryLabel(category, language),
        normalizedUrl: urlObj.toString()
    };
}

export interface GenerateCommentParams {
    type: 'scripture' | 'general-conference' | 'byu' | 'other';
    categoryLabel: string;
    category?: ScriptureValue;
    bookName?: string;
    chapter?: string;
    verses?: string;
    sessionLabel?: string;
    speaker?: string;
    title?: string;
    language?: string;
}

const DEFAULT_SESSION_NAMES: Record<string, string> = {
    ja: '総大会',
    en: 'General Conference',
    es: 'Conferencia General',
    pt: 'Conferência Geral',
    it: 'Conferenza Generale',
    ko: '연차대회',
    zho: '總會大會',
    vi: 'Đại Hội Trung Ương',
    tl: 'Pangkalahatang Kumperensya',
    th: 'การประชุมใหญ่สามัญ',
    sw: 'Mkutano Mkuu'
};

/**
 * Generate a naturally formatted note comment based on parsed URL metadata.
 */
export function generateUrlStudyComment(params: GenerateCommentParams): string {
    const {
        type,
        categoryLabel,
        category,
        bookName,
        chapter,
        verses,
        sessionLabel,
        speaker,
        title,
        language = 'ja'
    } = params;

    const lang = language.toLowerCase();

    if (type === 'scripture') {
        if (lang === 'ja') {
            // Check for D&C (Sections instead of Chapters)
            let chapterUnit = '章';
            if (category === 'Doctrine and Covenants' || bookName?.includes('教義と聖約')) {
                chapterUnit = '編';
            }

            let passageText = '';
            if (bookName && chapter) {
                // If book name is already identical to category (e.g. 教義と聖約), avoid repeating it awkwardly
                if (category === 'Doctrine and Covenants' && (bookName === '教義と聖約' || bookName === 'Doctrine and Covenants')) {
                    passageText = `${chapter}${chapterUnit}`;
                } else {
                    passageText = `${bookName}${chapter}${chapterUnit}`;
                }
            } else if (bookName) {
                passageText = bookName;
            } else if (title) {
                passageText = title;
            }

            if (verses && passageText) {
                passageText += `${verses}節`;
            }

            if (passageText) {
                return `今日は${categoryLabel}の${passageText}について学びを深めました。`;
            }
            return `今日は${categoryLabel}について学びを深めました。`;
        }

        if (lang === 'zho') {
            const unit = (category === 'Doctrine and Covenants' || bookName?.includes('教義和聖約') || bookName?.includes('教义和圣约')) ? '篇' : '章';
            let passageText = '';
            if (bookName && chapter) {
                passageText = `${bookName}第${chapter}${unit}`;
            } else if (bookName) {
                passageText = bookName;
            } else if (title) {
                passageText = title;
            }

            if (verses && passageText) {
                passageText += `第${verses}節`;
            }

            if (passageText) {
                return `今天我深入研讀了《${categoryLabel}》中的${passageText}。`;
            }
            return `今天我深入研讀了《${categoryLabel}》。`;
        }

        if (lang === 'ko') {
            const unit = (category === 'Doctrine and Covenants' || bookName?.includes('교리와 성약')) ? '편' : '장';
            let passageText = '';
            if (bookName && chapter) {
                passageText = `${bookName} ${chapter}${unit}`;
            } else if (bookName) {
                passageText = bookName;
            } else if (title) {
                passageText = title;
            }

            if (verses && passageText) {
                passageText += ` ${verses}절`;
            }

            if (passageText) {
                return `오늘은 ${categoryLabel}의 ${passageText}에 대해 깊이 있게 공부했습니다.`;
            }
            return `오늘은 ${categoryLabel}에 대해 깊이 있게 공부했습니다.`;
        }

        // Alphabetical / other languages (es, pt, it, vi, tl, th, sw, en)
        const verseSuffix = verses ? `:${verses}` : '';
        const chapterText = chapter ? ` ${chapter}${verseSuffix}` : '';
        const ref = bookName ? `${bookName}${chapterText}` : title || categoryLabel;

        switch (lang) {
            case 'es':
                return `Hoy profundicé mi aprendizaje sobre ${ref} de ${categoryLabel}.`;
            case 'pt':
                return `Hoje aprofundei meu aprendizado sobre ${ref} de ${categoryLabel}.`;
            case 'it':
                return `Oggi ho approfondito il mio studio su ${ref} di ${categoryLabel}.`;
            case 'vi':
                return `Hôm nay tôi đã đào sâu học hỏi về ${ref} từ ${categoryLabel}.`;
            case 'tl':
                return `Ngayong araw ay pinalalim ko ang aking pag-aaral tungkol sa ${ref} mula sa ${categoryLabel}.`;
            case 'th':
                return `วันนี้ฉันได้ศึกษาเรียนรู้อย่างลึกซึ้งเกี่ยวกับ ${ref} จาก ${categoryLabel}`;
            case 'sw':
                return `Leo nimejifunza zaidi kuhusu ${ref} kutoka ${categoryLabel}.`;
            case 'en':
            default:
                return `Today I deepened my learning on ${ref} from the ${categoryLabel}.`;
        }
    }

    if (type === 'general-conference') {
        const session = sessionLabel || DEFAULT_SESSION_NAMES[lang] || 'General Conference';
        const cleanSpeaker = speaker?.trim().replace(/^(By|Par|De|Por)\s+/i, '') || '';
        const cleanTitle = title?.trim() || '';

        switch (lang) {
            case 'ja':
                if (cleanSpeaker && cleanTitle) {
                    return `今日は${session}の${cleanSpeaker}の説教「${cleanTitle}」について学びを深めました。`;
                }
                if (cleanTitle) {
                    return `今日は${session}の説教「${cleanTitle}」について学びを深めました。`;
                }
                if (cleanSpeaker) {
                    return `今日は${session}の${cleanSpeaker}のお話について学びを深めました。`;
                }
                return `今日は${session}について学びを深めました。`;

            case 'zho':
                if (cleanSpeaker && cleanTitle) {
                    return `今天我深入研讀了${session}中${cleanSpeaker}的講話「${cleanTitle}」。`;
                }
                if (cleanTitle) {
                    return `今天我深入研讀了${session}的講話「${cleanTitle}」。`;
                }
                if (cleanSpeaker) {
                    return `今天我深入研讀了${session}中${cleanSpeaker}的講話。`;
                }
                return `今天我深入研讀了${session}。`;

            case 'ko':
                if (cleanSpeaker && cleanTitle) {
                    return `오늘은 ${session}에서 ${cleanSpeaker}의 말씀 "${cleanTitle}"에 대해 깊이 있게 공부했습니다.`;
                }
                if (cleanTitle) {
                    return `오늘은 ${session}의 말씀 "${cleanTitle}"에 대해 깊이 있게 공부했습니다.`;
                }
                if (cleanSpeaker) {
                    return `오늘은 ${session}에서 ${cleanSpeaker}의 말씀에 대해 깊이 있게 공부했습니다.`;
                }
                return `오늘은 ${session}에 대해 깊이 있게 공부했습니다.`;

            case 'es':
                if (cleanSpeaker && cleanTitle) {
                    return `Hoy profundicé mi aprendizaje en el discurso "${cleanTitle}" de ${cleanSpeaker} de la ${session}.`;
                }
                if (cleanTitle) {
                    return `Hoy profundicé mi aprendizaje en el discurso "${cleanTitle}" de la ${session}.`;
                }
                if (cleanSpeaker) {
                    return `Hoy profundicé mi aprendizaje en el mensaje de ${cleanSpeaker} de la ${session}.`;
                }
                return `Hoy profundicé mi aprendizaje en la ${session}.`;

            case 'pt':
                if (cleanSpeaker && cleanTitle) {
                    return `Hoje aprofundei meu aprendizado no discurso "${cleanTitle}" de ${cleanSpeaker} da ${session}.`;
                }
                if (cleanTitle) {
                    return `Hoje aprofundei meu aprendizado no discurso "${cleanTitle}" da ${session}.`;
                }
                if (cleanSpeaker) {
                    return `Hoje aprofundei meu aprendizado na mensagem de ${cleanSpeaker} da ${session}.`;
                }
                return `Hoje aprofundei meu aprendizado na ${session}.`;

            case 'it':
                if (cleanSpeaker && cleanTitle) {
                    return `Oggi ho approfondito il mio studio sul discorso "${cleanTitle}" di ${cleanSpeaker} della ${session}.`;
                }
                if (cleanTitle) {
                    return `Oggi ho approfondito il mio studio sul discorso "${cleanTitle}" della ${session}.`;
                }
                if (cleanSpeaker) {
                    return `Oggi ho approfondito il mio studio sul messaggio di ${cleanSpeaker} della ${session}.`;
                }
                return `Oggi ho approfondito il mio studio sulla ${session}.`;

            case 'vi':
                if (cleanSpeaker && cleanTitle) {
                    return `Hôm nay tôi đã đào sâu học hỏi bài phát biểu "${cleanTitle}" của ${cleanSpeaker} từ ${session}.`;
                }
                if (cleanTitle) {
                    return `Hôm nay tôi đã đào sâu học hỏi bài phát biểu "${cleanTitle}" từ ${session}.`;
                }
                if (cleanSpeaker) {
                    return `Hôm nay tôi đã đào sâu học hỏi thông điệp của ${cleanSpeaker} từ ${session}.`;
                }
                return `Hôm nay tôi đã đào sâu học hỏi về ${session}.`;

            case 'tl':
                if (cleanSpeaker && cleanTitle) {
                    return `Ngayong araw ay pinalalim ko ang aking pag-aaral tungkol sa mensaheng "${cleanTitle}" ni ${cleanSpeaker} mula sa ${session}.`;
                }
                if (cleanTitle) {
                    return `Ngayong araw ay pinalalim ko ang aking pag-aaral tungkol sa mensaheng "${cleanTitle}" mula sa ${session}.`;
                }
                if (cleanSpeaker) {
                    return `Ngayong araw ay pinalalim ko ang aking pag-aaral tungkol sa mensahe ni ${cleanSpeaker} mula sa ${session}.`;
                }
                return `Ngayong araw ay pinalalim ko ang aking pag-aaral tungkol sa ${session}.`;

            case 'th':
                if (cleanSpeaker && cleanTitle) {
                    return `วันนี้ฉันได้ศึกษาเรียนรู้อย่างลึกซึ้งเกี่ยวกับคำปราศรัยของ ${cleanSpeaker} เรื่อง "${cleanTitle}" จาก ${session}`;
                }
                if (cleanTitle) {
                    return `วันนี้ฉันได้ศึกษาเรียนรู้อย่างลึกซึ้งเกี่ยวกับคำปราศรัยเรื่อง "${cleanTitle}" จาก ${session}`;
                }
                if (cleanSpeaker) {
                    return `วันนี้ฉันได้ศึกษาเรียนรู้อย่างลึกซึ้งเกี่ยวกับข้อความของ ${cleanSpeaker} จาก ${session}`;
                }
                return `วันนี้ฉันได้ศึกษาเรียนรู้อย่างลึกซึ้งเกี่ยวกับ ${session}`;

            case 'sw':
                if (cleanSpeaker && cleanTitle) {
                    return `Leo nimejifunza zaidi kuhusu hotuba ya ${cleanSpeaker} "${cleanTitle}" kutoka ${session}.`;
                }
                if (cleanTitle) {
                    return `Leo nimejifunza zaidi kuhusu hotuba "${cleanTitle}" kutoka ${session}.`;
                }
                if (cleanSpeaker) {
                    return `Leo nimejifunza zaidi kuhusu ujumbe wa ${cleanSpeaker} kutoka ${session}.`;
                }
                return `Leo nimejifunza zaidi kuhusu ${session}.`;

            case 'en':
            default:
                if (cleanSpeaker && cleanTitle) {
                    return `Today I deepened my learning on ${cleanSpeaker}'s talk "${cleanTitle}" from the ${session}.`;
                }
                if (cleanTitle) {
                    return `Today I deepened my learning on the talk "${cleanTitle}" from the ${session}.`;
                }
                if (cleanSpeaker) {
                    return `Today I deepened my learning on ${cleanSpeaker}'s message from the ${session}.`;
                }
                return `Today I deepened my learning on the ${session}.`;
        }
    }

    // Other / BYU
    const targetTitle = title?.trim();
    switch (lang) {
        case 'ja':
            return targetTitle
                ? `今日は「${targetTitle}」について学びを深めました。`
                : `今日は資料を読み、学びを深めました。`;
        case 'zho':
            return targetTitle
                ? `今天我深入研讀了「${targetTitle}」。`
                : `今天我研讀了學習資料並深入學習。`;
        case 'ko':
            return targetTitle
                ? `오늘은 "${targetTitle}"에 대해 깊이 있게 공부했습니다.`
                : `오늘은 학습 자료를 읽고 깊이 있게 공부했습니다.`;
        case 'es':
            return targetTitle
                ? `Hoy profundicé mi aprendizaje sobre "${targetTitle}".`
                : `Hoy leí el material de estudio y profundicé mi aprendizaje.`;
        case 'pt':
            return targetTitle
                ? `Hoje aprofundei meu aprendizado sobre "${targetTitle}".`
                : `Hoje li o material de estudo e aprofundei meu aprendizado.`;
        case 'it':
            return targetTitle
                ? `Oggi ho approfondito il mio studio su "${targetTitle}".`
                : `Oggi ho letto il materiale di studio e approfondito il mio studio.`;
        case 'vi':
            return targetTitle
                ? `Hôm nay tôi đã đào sâu học hỏi về "${targetTitle}".`
                : `Hôm nay tôi đã đọc tài liệu học tập và đào sâu học hỏi.`;
        case 'tl':
            return targetTitle
                ? `Ngayong araw ay pinalalim ko ang aking pag-aaral tungkol sa "${targetTitle}".`
                : `Ngayong araw ay nagbasa ako ng materyal sa pag-aaral at pinalalim ang aking kaalaman.`;
        case 'th':
            return targetTitle
                ? `วันนี้ฉันได้ศึกษาเรียนรู้อย่างลึกซึ้งเกี่ยวกับ "${targetTitle}"`
                : `วันนี้ฉันได้อ่านเนื้อหาการเรียนรู้และศึกษาอย่างลึกซึ้ง`;
        case 'sw':
            return targetTitle
                ? `Leo nimejifunza zaidi kuhusu "${targetTitle}".`
                : `Leo nimesoma nyenzo za somo na kujifunza zaidi.`;
        case 'en':
        default:
            return targetTitle
                ? `Today I deepened my learning on "${targetTitle}".`
                : `Today I deepened my learning on today's study material.`;
    }
}
