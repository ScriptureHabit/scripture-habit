// Helper to detect volume from input
const detectVolume = (volume: string | null | undefined, chapterInput: string | null | undefined): string => {
    let volumeUrlPart = "";
    const lowerVolume = volume ? volume.toLowerCase() : "";

    if (lowerVolume === "old testament" || volume === "旧約聖書" || volume === "Velho Testamento" || volume === "舊約" || volume === "Antiguo Testamento" || volume === "Cựu Ước" || volume === "พันธสัญญาเดิม" || volume === "구약전서" || volume === "Lumang Tipan" || volume === "Agano la Kale" || lowerVolume === "ot") {
        volumeUrlPart = "ot";
    } else if (lowerVolume === "new testament" || volume === "新約聖書" || volume === "Novo Testamento" || volume === "新約" || volume === "Nuevo Testamento" || volume === "Tân Ước" || volume === "พันธสัญญาใหม่" || volume === "신약전서" || volume === "Bagong Tipan" || volume === "Agano Jipya" || lowerVolume === "nt") {
        volumeUrlPart = "nt";
    } else if (lowerVolume === "book of mormon" || volume === "モルモン書" || volume === "O Livro de Mórmon" || volume === "摩爾門經" || volume === "El Libro de Mormón" || volume === "Sách Mặc Môn" || volume === "พระคัมภีร์มอรมอน" || volume === "몰몬경" || volume === "Aklat ni Mormon" || volume === "Kitabu cha Mormoni" || lowerVolume === "bofm") {
        volumeUrlPart = "bofm";
    } else if (lowerVolume.includes("doctrine and") || volume === "教義と聖約" || volume === "Doutrina e Convênios" || volume === "教義和聖約" || volume === "Doctrina y Convenios" || volume === "Giáo Lý và Giao Ước" || volume === "หลักคำสอน和พันธสัญญา" || volume === "교리와 성약" || volume === "Doktrina at mga Tipan" || volume === "Mafundisho na Maagano" || lowerVolume === "dc-testament" || lowerVolume === "dc") {
        volumeUrlPart = "dc-testament";
    } else if (lowerVolume === "pearl of great price" || volume === "高価な真珠" || volume === "Pérola de Grande Valor" || volume === "無價珍珠" || volume === "La Perla de Gran Precio" || volume === "Trân Châu Vô Giá" || volume === "ไข่มุกอันล้ำค่า" || volume === "값진 진주" || volume === "Mahalagang Perlas" || volume === "Lulu ya Thamani Kuu" || lowerVolume === "pgp") {
        volumeUrlPart = "pgp";
    } else if (lowerVolume === "general conference" || volume === "総大会" || volume === "Conferência Geral" || volume === "總會大會" || volume === "Conferencia General" || volume === "Đại Hội Trung Ương" || volume === "การประชุมใหญ่สามัญ" || volume === "연차 대회" || volume === "Pangkalahatang Kumperensya" || volume === "Mkutano Mkuu" || lowerVolume === "gc") {
        volumeUrlPart = "general-conference";
    } else if (lowerVolume === "byu speeches" || volume === "BYU Speeches") {
        volumeUrlPart = "byu-speeches";
    } else if (lowerVolume === "ordinances and proclamations" || volume === "儀式と宣言" || volume === "神権の儀式と宣言" || volume === "Ordenanças e Declarações" || volume === "聖職教儀和文告" || volume === "Ordenanzas del sacerdocio y proclamaciones" || lowerVolume === "proclamations") {
        volumeUrlPart = "ordinances-and-proclamations";
    }

    if (!volumeUrlPart && chapterInput) {
        const lowerChap = chapterInput.toLowerCase();
        if (lowerChap.includes("family") || lowerChap.includes("家族") || lowerChap.includes("família") || lowerChap.includes("proclamación sobre la familia") ||
            lowerChap.includes("living christ") || lowerChap.includes("生けるキリスト") || lowerChap.includes("cristo vivo") || lowerChap.includes("cristo viviente") ||
            lowerChap.includes("restoration") || lowerChap.includes("回復") || lowerChap.includes("restauração") || lowerChap.includes("restauración") ||
            lowerChap.includes("sacrament") || lowerChap.includes("聖餐") || lowerChap.includes("sacramental") || lowerChap.includes("tiệc thánh") ||
            lowerChap.includes("baptism") || lowerChap.includes("バプテスマ") || lowerChap.includes("batismo") || lowerChap.includes("bautismo") || lowerChap.includes("báp têm")) {
            volumeUrlPart = "ordinances-and-proclamations";
        } else if (lowerChap.includes("doctrine and covenants") || lowerChap.includes("d&c") || lowerChap.includes("教義と聖約") || lowerChap.includes("official declarations")) {
            volumeUrlPart = "dc-testament";
        } else if (lowerChap.includes("joseph smith—history") || lowerChap.includes("joseph smith-history") || lowerChap.includes("faith") || lowerChap.includes("信條") || lowerChap.includes("moses") || lowerChap.includes("abr") || lowerChap.includes("信仰")) {
            volumeUrlPart = "pgp";
        }
    }
    return volumeUrlPart;
};

export const getGospelLibraryUrl = (volume: string | null | undefined, chapterInput: string | null | undefined, language: string = 'en'): string | null => {
    if (!chapterInput) return null;

    const baseUrl = "https://www.churchofjesuschrist.org/study/scriptures";
    // Determine language parameter
    // For Vietnamese, OT and NT default to English (?lang=eng), others use ?lang=vie
    let langParam = "?lang=eng";
    if (language === 'ja') langParam = "?lang=jpn";
    else if (language === 'pt') langParam = "?lang=por";
    else if (language === 'zho') langParam = "?lang=zho";
    else if (language === 'es') langParam = "?lang=spa";
    else if (language === 'vi') langParam = "?lang=vie";
    else if (language === 'th') langParam = "?lang=tha";
    else if (language === 'ko') langParam = "?lang=kor";
    else if (language === 'tl') langParam = "?lang=tgl";
    else if (language === 'sw') langParam = "?lang=swa";

    let volumeUrlPart = detectVolume(volume, chapterInput);
    if (volumeUrlPart === 'ot' && language === 'vi') langParam = "?lang=eng";
    if (volumeUrlPart === 'nt' && language === 'vi') langParam = "?lang=eng";

    // Special handling for General Conference
    if (volumeUrlPart === "general-conference") {
        // If the user pasted a full URL, return it directly
        if (chapterInput.includes("churchofjesuschrist.org")) {
            try {
                let urlStr = chapterInput.trim();
                // Ensure protocol
                if (!urlStr.startsWith('http')) {
                    urlStr = 'https://' + urlStr;
                }
                const url = new URL(urlStr);
                const targetLang = langParam.split('=')[1]; // Extract 'jpn', 'eng', etc.
                url.searchParams.set('lang', targetLang);
                return url.toString();
            } catch {
                return chapterInput;
            }
        }

        // Handle "YYYY/MM/slug" format (e.g., "2025/10/15eyre")
        if (/^\d{4}\/\d{2}\/.+/.test(chapterInput)) {
            const gcBaseUrl = "https://www.churchofjesuschrist.org/study/general-conference";
            return `${gcBaseUrl}/${chapterInput}${langParam}`;
        }

        // Handle "YYYY/MM" format (e.g., "2023/10")
        if (/^\d{4}\/\d{2}$/.test(chapterInput)) {
            const gcBaseUrl = "https://www.churchofjesuschrist.org/study/general-conference";
            return `${gcBaseUrl}/${chapterInput}${langParam}`;
        }
    }

    // Special handling for BYU Speeches
    if (volumeUrlPart === "byu-speeches") {
        // Return URL directly
        return chapterInput;
    }

    // Special handling for Ordinances and Proclamations
    if (volumeUrlPart === "ordinances-and-proclamations") {
        const lowerChap = chapterInput.toLowerCase();

        // Sacrament Prayers
        if (lowerChap.includes("sacrament") || lowerChap.includes("聖餐") || lowerChap.includes("sacramental") || lowerChap.includes("tiệc thánh")) {
            return `${baseUrl}/sacrament${langParam}`;
        }
        // Baptism Ordinance
        if (lowerChap.includes("baptism") || lowerChap.includes("バプテスマ") || lowerChap.includes("batismo") || lowerChap.includes("bautismo") || lowerChap.includes("báp têm")) {
            return `${baseUrl}/baptism${langParam}`;
        }
        // Family Proclamation
        if (lowerChap.includes("family") || lowerChap.includes("家族") || lowerChap.includes("família") || lowerChap.includes("proclamación sobre la familia")) {
            return `${baseUrl}/the-family-a-proclamation-to-the-world${langParam}`;
        }
        // Living Christ
        if (lowerChap.includes("living christ") || lowerChap.includes("生けるキリスト") || lowerChap.includes("cristo vivo") || lowerChap.includes("cristo viviente")) {
            return `${baseUrl}/the-living-christ-the-testimony-of-the-apostles${langParam}`;
        }
        // Restoration
        if (lowerChap.includes("restoration") || lowerChap.includes("回復") || lowerChap.includes("restauração") || lowerChap.includes("restauración")) {
            return `${baseUrl}/the-restoration-of-the-fulness-of-the-gospel-of-jesus-christ${langParam}`;
        }

        // Fallback to index
        return `${baseUrl}/ordinances-and-proclamations${langParam}`;
    }

    // Parse chapterInput to separate Book and Chapter
    let cleanChapterInput = chapterInput;

    // Normalize Full-width characters to Half-width (Numbers, Colon, Comma, Space, Hyphen)
    cleanChapterInput = cleanChapterInput.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    cleanChapterInput = cleanChapterInput.replace(/：/g, ':')
                                         .replace(/[，、]/g, ',')
                                         .replace(/　/g, ' ')
                                         .replace(/[－—―]/g, '-');

    // Handle "章" (Chapter) separator
    // If "章" is followed by a digit (verse), treat it as a colon separator (e.g. "18章11" -> "18:11")
    cleanChapterInput = cleanChapterInput.replace(/章\s*(?=\d)/g, ':');
    // Otherwise remove "章" (e.g. "18章" -> "18")
    cleanChapterInput = cleanChapterInput.replace(/章/g, '');

    // Remove "節" (Verse)
    cleanChapterInput = cleanChapterInput.replace(/節/g, '');

    // Regex to find the last number in the string, possibly followed by verses
    // Matches: "Alma 7", "Alma 7:11", "Alma 7:11-13", "138", "ニーファイ第一書 3", "Matt 18:11,14"
    // Group 1: Book name
    // Group 2: Chapter number
    // Group 3: Verses (optional, allows digits, hyphens, commas)
    const match = cleanChapterInput.match(/(.*?)\s*(\d+)(?::([\d\s,-]+))?\s*$/);

    if (!match) return null; // Could not find a chapter number

    const bookName = match[1].trim().toLowerCase().replace(/[.]/g, ''); // Remove dots, lowercase
    const chapterNum = match[2];
    const verses = match[3]; // This will be "11", "11-13", "11,14" etc.

    let urlSuffix = langParam;
    if (verses) {
        // If verses are present, add id and p parameters
        // Extract the very first number for the anchor (ignoring - or ,)
        const firstVerse = verses.split(/[-\s,]/).filter(Boolean)[0];
        urlSuffix += `&id=${verses}#p${firstVerse}`;
    }

    // Special handling for Doctrine and Covenants
    if (volumeUrlPart === "dc-testament") {
        // D&C usually just has section number, or "D&C [num]", "Section [num]"
        // The URL is always .../dc-testament/dc/[num]
        return `${baseUrl}/dc-testament/dc/${chapterNum}${urlSuffix}`;
    }

    // Mapping for other volumes
     
    const bookMappings: Record<string, string> = {
        // Book of Mormon
        "1 nephi": "1-ne", "1 ne": "1-ne",
        "2 nephi": "2-ne", "2 ne": "2-ne",
        "jacob": "jacob",
        "enos": "enos",
        "jarom": "jarom",
        "omni": "omni",
        "words of mormon": "w-of-m", "w of m": "w-of-m",
        "mosiah": "mosiah",
        "alma": "alma",
        "helaman": "hel", "hel": "hel",
        "3 nephi": "3-ne", "3 ne": "3-ne",
        "4 nephi": "4-ne", "4 ne": "4-ne",
        "mormon": "morm", "morm": "morm",
        "ether": "eth", "eth": "eth",
        "moroni": "moro", "moro": "moro",

        // Japanese Book of Mormon
        "ニーファイ第一書": "1-ne", "第一ニーファイ": "1-ne", "第1ニーファイ": "1-ne", "第１ニーファイ": "1-ne", "1ニーファイ": "1-ne",
        "ニーファイ第二書": "2-ne", "第二ニーファイ": "2-ne", "第2ニーファイ": "2-ne", "第２ニーファイ": "2-ne", "2ニーファイ": "2-ne",
        "ヤコブ書": "jacob", "ヤコブ": "jacob",
        "エノス書": "enos", "エノス": "enos",
        "ジェロム書": "jarom", "ジェロム": "jarom",
        "オムナイ書": "omni", "オムナイ": "omni",
        "モルモンの言葉": "w-of-m",
        "モーサヤ書": "mosiah", "モーサヤ": "mosiah",
        "アルマ書": "alma", "アルマ": "alma",
        "ヒラマン書": "hel", "ヒラマン": "hel",
        "第3ニーファイ": "3-ne", "第３ニーファイ": "3-ne", "第三ニーファイ": "3-ne", "3ニーファイ": "3-ne",
        "第4ニーファイ": "4-ne", "第４ニーファイ": "4-ne", "第四ニーファイ": "4-ne", "4ニーファイ": "4-ne",
        "モルモン書": "morm", "モルモン": "morm",
        "エテル書": "eth", "エテル": "eth",
        "モロナイ書": "moro", "モロナイ": "moro",

        // Portuguese Book of Mormon
        "1 néfi": "1-ne", "1 nefi": "1-ne",
        "jacó": "jacob", "jaco": "jacob",
        "ômni": "omni",
        "palavras de mórmon": "w-of-m", "palavras de mormon": "w-of-m",
        "mosias": "mosiah",
        "helamã": "hel", "helama": "hel",
        "3 néfi": "3-ne", "3 nefi": "3-ne",
        "4 néfi": "4-ne", "4 nefi": "4-ne",
        "mórmon": "morm",
        "éter": "eth", "eter": "eth",
        "morôni": "moro",

        // Traditional Chinese Book of Mormon
        "尼腓一書": "1-ne", "1尼腓": "1-ne",
        "尼腓二書": "2-ne", "2尼腓": "2-ne",
        "雅各書": "jacob",
        "以挪士書": "enos",
        "雅龍書": "jarom",
        "奧姆奈書": "omni",
        "摩爾門語": "w-of-m",
        "摩賽亞書": "mosiah",
        "阿爾瑪書": "alma",
        "希拉曼書": "hel",
        "尼腓三書": "3-ne", "3尼腓": "3-ne",
        "尼腓四書": "4-ne", "4尼腓": "4-ne",
        "摩爾門書": "morm",
        "以帖書": "eth",
        "摩羅乃書": "moro",

        // Spanish Book of Mormon

        "2 nefi": "2-ne",

        // Vietnamese Book of Mormon
        "1 nê phi": "1-ne", "1 ne phi": "1-ne",
        "2 nê phi": "2-ne", "2 ne phi": "2-ne",
        "gia cốp": "jacob", "gia cop": "jacob",
        "ê nốt": "enos", "e not": "enos",
        "gia rôm": "jarom", "gia rom": "jarom",
        "ôm ni": "omni", "om ni": "omni",
        "lời mặc môn": "w-of-m", "loi mac mon": "w-of-m",
        "mô si a": "mosiah", "mo si a": "mosiah",
        "an ma": "alma",
        "hê la man": "hel", "he la man": "hel",
        "3 nê phi": "3-ne", "3 ne phi": "3-ne",
        "4 nê phi": "4-ne", "4 ne phi": "4-ne",
        "mặc môn": "morm", "mac mon": "morm",
        "ê the": "eth", "e the": "eth",
        "mô rô ni": "moro", "mo ro ni": "moro",

        // Old Testament (Common ones)
        "genesis": "gen", "gen": "gen",
        "exodus": "ex", "ex": "ex",
        "leviticus": "lev", "lev": "lev",
        "numbers": "num", "num": "num",
        "deuteronomy": "deut", "deut": "deut",
        "joshua": "josh", "josh": "josh",
        "judges": "judg", "judg": "judg",
        "ruth": "ruth",
        "1 samuel": "1-sam", "1 sam": "1-sam",
        "2 samuel": "2-sam", "2 sam": "2-sam",
        "1 kings": "1-kgs", "1 kgs": "1-kgs",
        "2 kings": "2-kgs", "2 kgs": "2-kgs",
        "1 chronicles": "1-chr", "1 chr": "1-chr",
        "2 chronicles": "2-chr", "2 chr": "2-chr",
        "ezra": "ezra",
        "nehemiah": "neh", "neh": "neh",
        "esther": "esth", "esth": "esth",
        "job": "job",
        "psalms": "ps", "psalm": "ps", "ps": "ps",
        "proverbs": "prov", "prov": "prov",
        "ecclesiastes": "eccl", "eccl": "eccl",
        "song of solomon": "song", "song of songs": "song",
        "isaiah": "isa", "isa": "isa",
        "jeremiah": "jer", "jer": "jer",
        "lamentations": "lam", "lam": "lam",
        "ezekiel": "ezek", "ezek": "ezek",
        "daniel": "dan", "dan": "dan",
        "hosea": "hosea", "hos": "hos",
        "joel": "joel",
        "amos": "amos",
        "obadiah": "obad", "obad": "obad",
        "jonah": "jonah",
        "micah": "micah", "mic": "mic",
        "nahum": "nahum", "nah": "nah",
        "habakkuk": "hab", "hab": "hab",
        "zephaniah": "zeph", "zeph": "zeph",
        "haggai": "hag", "hag": "hag",
        "zechariah": "zech", "zech": "zech",
        "malachi": "mal", "mal": "mal",

        // Japanese Old Testament
        "創世記": "gen", "出エジプト記": "ex", "レビ記": "lev", "民数記": "num", "申命記": "deut",
        "ヨシュア記": "josh", "士師記": "judg", "ルツ記": "ruth",
        "サムエル記上": "1-sam", "サムエル記下": "2-sam", "列王記上": "1-kgs", "列王記下": "2-kgs",
        "歴代誌上": "1-chr", "歴代誌下": "2-chr", "エズラ記": "ezra", "ネヘミヤ記": "neh", "エステル記": "esth",
        "ヨブ記": "job", "詩篇": "ps", "箴言": "prov", "伝道の書": "eccl", "雅歌": "song",
        "イザヤ書": "isa", "エレミヤ書": "jer", "哀歌": "lam", "エゼキエル書": "ezek", "ダニエル書": "dan",
        "ホセア書": "hosea", "ヨエル書": "joel", "アモス書": "amos", "オバデヤ書": "obad", "ヨナ書": "jonah",
        "ミカ書": "micah", "ナホム書": "nahum", "ハバクク書": "hab", "ゼパニヤ書": "zeph", "ハガイ書": "hag",
        "ゼカリヤ書": "zech", "マラキ書": "mal",

        // Portuguese Old Testament
        "gênesis": "gen",
        "êxodo": "ex", "exodo": "ex",
        "levítico": "lev", "levitico": "lev",
        "números": "num", "numeros": "num",
        "deuteronômio": "deut", "deuteronomio": "deut",
        "josué": "josh", "josue": "josh",
        "juízes": "judg", "juizes": "judg",
        "rute": "ruth",
        "1 reis": "1-kgs",
        "2 reis": "2-kgs",
        "1 crônicas": "1-chr", "1 cronicas": "1-chr",
        "2 crônicas": "2-chr", "2 cronicas": "2-chr",
        "esdras": "ezra",
        "neemias": "neh",
        "ester": "esth",
        "jó": "job", "jo": "job",
        "salmos": "ps",
        "provérbios": "prov", "proverbios": "prov",
        "eclesiastes": "eccl",
        "cânticos de salomão": "song", "canticos de salomao": "song",
        "isaías": "isa", "isaias": "isa",
        "jeremias": "jer",
        "lamentações": "lam", "lamentacoes": "lam",
        "ezequiel": "ezek",
        "oseias": "hosea",
        "amós": "amos",
        "obadias": "obad",
        "jonas": "jonah",
        "miqueias": "micah",
        "naum": "nahum",
        "habacuque": "hab",
        "sofonias": "zeph",
        "ageu": "hag",
        "zacarias": "zech",
        "malaquias": "mal",

        // Traditional Chinese Old Testament
 "出埃及記": "ex", "利未記": "lev", "民數記": "num",
        "約書亞記": "josh", "路得記": "ruth",
        "撒母耳記上": "1-sam", "撒母耳記下": "2-sam", "列王紀上": "1-kgs", "列王紀下": "2-kgs",
        "歷代志上": "1-chr", "歷代志下": "2-chr", "以斯拉記": "ezra", "尼希米記": "neh", "以斯帖記": "esth",
        "約伯記": "job", "傳道書": "eccl",
        "以賽亞書": "isa", "耶利米書": "jer", "耶利米哀歌": "lam", "以西結書": "ezek", "但以理書": "dan",
        "何西阿書": "hosea", "約珥書": "joel", "阿摩司書": "amos", "俄巴底亞書": "obad", "約拿書": "jonah",
        "彌迦書": "micah", "那鴻書": "nahum", "哈巴谷書": "hab", "西番雅書": "zeph", "哈該書": "hag",
        "撒迦利亞書": "zech", "瑪拉基書": "mal",

        // Spanish Old Testament
        "génesis": "gen",
        "éxodo": "ex",
        "jueces": "judg",
        "rut": "ruth",
        "1 reyes": "1-kgs",
        "2 reyes": "2-kgs",
        "1 crónicas": "1-chr",
        "2 crónicas": "2-chr",
        "nehemías": "neh", "nehemias": "neh",
        "eclesiastés": "eccl",
        "cantares": "song",
        "jeremías": "jer",
        "lamentaciones": "lam",
        "oseas": "hosea",
        "abdías": "obad", "abdias": "obad",
        "jonás": "jonah",
        "miqueas": "micah",
        "nahúm": "nahum",
        "habacuc": "hab",
        "sofonías": "zeph",
        "hageo": "hag",
        "zacarías": "zech",
        "malaquías": "mal",

        // New Testament
        "matthew": "matt", "matt": "matt",
        "mark": "mark",
        "luke": "luke",
        "john": "john",
        "acts": "acts",
        "romans": "rom", "rom": "rom",
        "1 corinthians": "1-cor", "1 cor": "1-cor",
        "2 corinthians": "2-cor", "2 cor": "2-cor",
        "galatians": "gal", "gal": "gal",
        "ephesians": "eph", "eph": "eph",
        "philippians": "philip", "phil": "philip",
        "colossians": "col", "col": "col",
        "1 thessalonians": "1-thes", "1 thes": "1-thes",
        "2 thessalonians": "2-thes", "2 thes": "2-thes",
        "1 timothy": "1-tim", "1 tim": "1-tim",
        "2 timothy": "2-tim", "2 tim": "2-tim",
        "titus": "titus", "tit": "titus",
        "philemon": "philem", "philem": "philem",
        "hebrews": "heb", "heb": "heb",
        "james": "jas", "jas": "jas",
        "1 peter": "1-pet", "1 pet": "1-pet",
        "2 peter": "2-pet", "2 pet": "2-pet",
        "1 john": "1-jn", "1 jn": "1-jn",
        "2 john": "2-jn", "2 jn": "2-jn",
        "3 john": "3-jn", "3 jn": "3-jn",
        "jude": "jude",
        "revelation": "rev", "rev": "rev",

        // Japanese New Testament
        "マタイによる福音書": "matt", "マタイ": "matt",
        "マルコによる福音書": "mark", "マルコ": "mark",
        "ルカによる福音書": "luke", "ルカ": "luke",
        "ヨハネによる福音書": "john", "ヨハネ": "john",
        "使徒行伝": "acts",
        "ローマ人への手紙": "rom", "ローマ": "rom",
        "コリント人への手紙第一": "1-cor", "第一コリント": "1-cor",
        "コリント人への第一の手紙": "1-cor",
        "コリント人への手紙第二": "2-cor", "第二コリント": "2-cor",
        "コリント人への第二の手紙": "2-cor",
        "ガラテヤ人への手紙": "gal", "ガラテヤ": "gal",
        "エペソ人への手紙": "eph", "エペソ": "eph",
        "ピリピ人への手紙": "philip", "ピリピ": "philip",
        "コロサイ人への手紙": "col", "コロサイ": "col",
        "テサロニケ人への手紙第一": "1-thes", "第一テサロニケ": "1-thes",
        "テサロニケ人への第一の手紙": "1-thes",
        "テサロニケ人への手紙第二": "2-thes", "第二テサロニケ": "2-thes",
        "テサロニケ人への第二の手紙": "2-thes",
        "テモテへの手紙第一": "1-tim", "第一テモテ": "1-tim",
        "テモテへの第一の手紙": "1-tim",
        "テモテへの手紙第二": "2-tim", "第二テモテ": "2-tim",
        "テモテへの第二の手紙": "2-tim",
        "テトスへの手紙": "titus", "テトス": "titus",
        "ピレモンへの手紙": "philem", "ピレモン": "philem",
        "ヘブル人への手紙": "heb", "ヘブル": "heb",
        "ヤコブの手紙": "jas",
        "ペテロの手紙第一": "1-pet", "第一ペテロ": "1-pet",
        "ペテロの第一の手紙": "1-pet",
        "ペテロの手紙第二": "2-pet", "第二ペテロ": "2-pet",
        "ペテロの第二の手紙": "2-pet",
        "ヨハネの手紙第一": "1-jn", "第一ヨハネ": "1-jn",
        "ヨハネの第一の手紙": "1-jn",
        "ヨハネの手紙第二": "2-jn", "第二ヨハネ": "2-jn",
        "ヨハネの第二の手紙": "2-jn",
        "ヨハネの手紙第三": "3-jn", "第三ヨハネ": "3-jn",
        "ヨハネの第三の手紙": "3-jn",
        "ユダの手紙": "jude", "ユダ": "jude",
        "ヨハネの黙示録": "rev", "黙示録": "rev",

        // Portuguese New Testament
        "mateus": "matt",
        "marcos": "mark",
        "lucas": "luke",
        "joão": "john", "joao": "john",
        "atos": "acts",
        "romanos": "rom",
        "1 coríntios": "1-cor", "1 corintios": "1-cor",
        "2 coríntios": "2-cor", "2 corintios": "2-cor",
        "gálatas": "gal", "galatas": "gal",
        "efésios": "eph", "efesios": "eph",
        "filipenses": "philip",
        "colossenses": "col",
        "1 tessalonicenses": "1-thes",
        "2 tessalonicenses": "2-thes",
        "1 timóteo": "1-tim", "1 timoteo": "1-tim",
        "2 timóteo": "2-tim", "2 timoteo": "2-tim",
        "tito": "titus",
        "filemom": "philem",
        "hebreus": "heb",
        "tiago": "jas",
        "1 pedro": "1-pet",
        "2 pedro": "2-pet",
        "1 joão": "1-jn", "1 joao": "1-jn",
        "2 joão": "2-jn", "2 joao": "2-jn",
        "3 joão": "3-jn", "3 joao": "3-jn",
        "judas": "jude",
        "apocalipse": "rev",

        // Traditional Chinese New Testament
        "馬太福音": "matt",
        "馬可福音": "mark",
        "路加福音": "luke",
        "約翰福音": "john",
        "使徒行傳": "acts",
        "羅馬書": "rom",
        "哥林多前書": "1-cor",
        "哥林多後書": "2-cor",
        "加拉太書": "gal",
        "以弗所書": "eph",
        "腓立比書": "philip",
        "歌羅西書": "col",
        "帖撒羅尼迦前書": "1-thes",
        "帖撒羅尼迦後書": "2-thes",
        "提摩太前書": "1-tim",
        "提摩太後書": "2-tim",
        "提多書": "titus",
        "腓利門書": "philem",
        "希伯來書": "heb",

        "彼得前書": "1-pet",
        "彼得後書": "2-pet",
        "約翰一書": "1-jn",
        "約翰二書": "2-jn",
        "約翰三書": "3-jn",
        "猶大書": "jude",
        "啟示錄": "rev",

        // Spanish New Testament
        "mateo": "matt",
        "juan": "john",
        "hechos": "acts",
        "colosenses": "col",
        "1 tesalonicenses": "1-thes",
        "2 tesalonicenses": "2-thes",
        "filemón": "philem", "filemon": "philem",
        "hebreos": "heb",
        "santiago": "jas",
        "1 juan": "1-jn",
        "2 juan": "2-jn",
        "3 juan": "3-jn",
        "apocalipsis": "rev",

        // Pearl of Great Price
        "moses": "moses",
        "abraham": "abr", "abr": "abr",
        "joseph smith matthew": "js-m", "js-m": "js-m", "joseph smith-matthew": "js-m",
        "joseph smith history": "js-h", "js-h": "js-h", "joseph smith-history": "js-h",
        "articles of faith": "a-of-f", "a of f": "a-of-f",

        // Japanese Pearl of Great Price
        "モーセ書": "moses", "モーセ": "moses",
        "アブラハム書": "abr", "アブラハム": "abr",
        "ジョセフ・スミス—マタイ": "js-m",
        "ジョセフ・スミス—歴史": "js-h",
        "信仰箇条": "a-of-f",

        // Japanese Doctrine and Covenants (Official Declarations)
        "公式の宣言": "od",

        // Portuguese Pearl of Great Price
        "moisés": "moses", "moises": "moses",
        "abraão": "abr", "abraao": "abr",
        "joseph smith—mateus": "js-m", "joseph smith mateus": "js-m",
        "joseph smith—história": "js-h", "joseph smith história": "js-h", "joseph smith historia": "js-h",
        "regras de fé": "a-of-f", "regras de fe": "a-of-f",

        // Traditional Chinese Pearl of Great Price
        "摩西書": "moses",
        "亞伯拉罕書": "abr",
        "約瑟·斯密——馬太": "js-m",
        "約瑟·斯密——歷史": "js-h",
        "信條": "a-of-f",

        // Spanish Pearl of Great Price
        "josé smith—mateo": "js-m", "jose smith mateo": "js-m",
        "josé smith—historia": "js-h", "jose smith historia": "js-h",
        "artículos de fe": "a-of-f", "articulos de fe": "a-of-f",

        // Vietnamese Pearl of Great Price
        "môi se": "moses", "moi se": "moses",
        "áp ra ham": "abr", "ap ra ham": "abr",
        "giô sép smith—ma thi ơ": "js-m", "gio sep smith ma thi o": "js-m",
        "giô sép smith—lịch sử": "js-h", "gio sep smith lich su": "js-h",
        "những tín điều": "a-of-f", "nhung tin dieu": "a-of-f",

        // Thai Book of Mormon
        "1 นีไฟ": "1-ne",
        "2 นีไฟ": "2-ne",
        "ยาคอบ": "jacob",
        "อีนัส": "enos",
        "จารอม": "jarom",
        "ออมไน": "omni",
        "ถ้อยคำของมอรมอน": "w-of-m",
        "โมไซยาห์": "mosiah",
        "แอลมา": "alma",
        "ฮีลามัน": "hel",
        "3 นีไฟ": "3-ne",
        "4 นีไฟ": "4-ne",
        "มอรมอน": "morm",
        "อีเธอร์": "eth",
        "โมโรไน": "moro",

        // Thai Old Testament
        "ปฐมกาล": "gen",
        "อพยพ": "ex",
        "เลวีนิติ": "lev",
        "กันดารวิถี": "num",
        "เฉลยธรรมบัญญัติ": "deut",
        "โยชูวา": "josh",
        "ผู้วินิจฉัย": "judg",
        "นางรูธ": "ruth",
        "1 ซามูเอล": "1-sam",
        "2 ซามูเอล": "2-sam",
        "1 พงศ์กษัตริย์": "1-kgs",
        "2 พงศ์กษัตริย์": "2-kgs",
        "1 พงศาวดาร": "1-chr",
        "2 พงศาวดาร": "2-chr",
        "เอสรา": "ezra",
        "เนหะมีย์": "neh",
        "เอสเธอร์": "esth",
        "โยบ": "job",
        "สดุดี": "ps",
        "สุภาษิต": "prov",
        "ปัญญาจารย์": "eccl",
        "เพลงไพเราะ": "song",
        "อิสยาห์": "isa",
        "เยเรมีย์": "jer",
        "เพลงคร่ำครวญ": "lam",
        "เอเสเคียล": "ezek",
        "ดาเนียล": "dan",
        "โฮเชยา": "hosea",
        "โยเอล": "joel",
        "อาโมส": "amos",
        "โอบาดีห์": "obad",
        "โยนาห์": "jonah",
        "มีคาห์": "micah",
        "นาฮูม": "nahum",
        "ฮาบากุก": "hab",
        "เศฟันยาห์": "zeph",
        "ฮักกัย": "hag",
        "เศคาริยาห์": "zech",
        "มาลาคี": "mal",

        // Thai New Testament
        "มัทธิว": "matt",
        "มาระโก": "mark",
        "ลูกา": "luke",
        "ยอห์น": "john",
        "กิจการ": "acts",
        "โรม": "rom",
        "1 โครินธ์": "1-cor",
        "2 โครินธ์": "2-cor",
        "กาลาเทีย": "gal",
        "เอเฟซัส": "eph",
        "ฟิลิปปี": "philip",
        "โคโลสี": "col",
        "1 เธสะโลนิกา": "1-thes",
        "2 เธสะโลนิกา": "2-thes",
        "1 ทิโมธี": "1-tim",
        "2 ทิโมธี": "2-tim",
        "ทิตัส": "titus",
        "ฟีเลโมน": "philem",
        "ฮีบรู": "heb",
        "ยากอบ": "jas",
        "1 เปโตร": "1-pet",
        "2 เปโตร": "2-pet",
        "1 ยอห์น": "1-jn",
        "2 ยอห์น": "2-jn",
        "3 ยอห์น": "3-jn",
        "ยูดา": "jude",
        "วิวรณ์": "rev",

        // Thai Pearl of Great Price
        "โมเสส": "moses",
        "อับราฮัม": "abr",
        "โจเซฟ สมิธ—มัทธิว": "js-m",
        "โจเซฟ สมิธ—ประวัติ": "js-h",
        "หลักแห่งความเชื่อ": "a-of-f",

        // Korean Book of Mormon
        "니파이전서": "1-ne",
        "니파이후서": "2-ne",
        "야곱서": "jacob",
        "이노스서": "enos",
        "예이롬서": "jarom",
        "옴나이서": "omni",
        "몰몬의 말씀": "w-of-m",
        "모사이야서": "mosiah",
        "앨마서": "alma",
        "힐라맨서": "hel",
        "제3니파이": "3-ne",
        "제4니파이": "4-ne",
        "몰몬서": "morm",
        "이더서": "eth",
        "모로나이서": "moro",

        // Korean Old Testament
        "창세기": "gen",
        "출애굽기": "ex",
        "레위기": "lev",
        "민수기": "num",
        "신명기": "deut",
        "여호수아": "josh",
        "사사기": "judg",
        "룻기": "ruth",
        "사무엘상": "1-sam",
        "사무엘하": "2-sam",
        "열왕기상": "1-kgs",
        "열왕기하": "2-kgs",
        "역대상": "1-chr",
        "역대하": "2-chr",
        "에스라": "ezra",
        "느헤미야": "neh",
        "에스더": "esth",
        "욥기": "job",
        "시편": "ps",
        "잠언": "prov",
        "전도서": "eccl",
        "아가": "song",
        "이사야": "isa",
        "예레미야": "jer",
        "예레미야애가": "lam",
        "에스겔": "ezek",
        "다니엘": "dan",
        "호세아": "hosea",
        "요엘": "joel",
        "아모스": "amos",
        "오바댜": "obad",
        "요나": "jonah",
        "미가": "micah",
        "나훔": "nahum",
        "하박국": "hab",
        "스바냐": "zeph",
        "학개": "hag",
        "스가랴": "zech",
        "말라기": "mal",

        // Korean New Testament
        "마태복음": "matt",
        "마가복음": "mark",
        "누가복음": "luke",
        "요한복음": "john",
        "사도행전": "acts",
        "로마서": "rom",
        "고린도전서": "1-cor",
        "고린도후서": "2-cor",
        "갈라디아서": "gal",
        "에베소서": "eph",
        "빌립보서": "philip",
        "골로새서": "col",
        "데살로니가전서": "1-thes",
        "데살로니가후서": "2-thes",
        "디모데전서": "1-tim",
        "디모데후서": "2-tim",
        "디도서": "titus",
        "빌레몬서": "philem",
        "히브리서": "heb",
        "야고보서": "jas",
        "베드로전서": "1-pet",
        "베드로후서": "2-pet",
        "요한1서": "1-jn",
        "요한2서": "2-jn",
        "요한3서": "3-jn",
        "유다서": "jude",
        "요한계시록": "rev",

        // Korean Pearl of Great Price
        "모세서": "moses",
        "아브라함서": "abr",
        "조셉 스미스—마태": "js-m",
        "조셉 스미스—역사": "js-h",
        "신앙개조": "a-of-f",

        // Tagalog
        "1 Nephi": "1-ne",
        "2 Nephi": "2-ne",
        "Jacob": "Jacob",
        "Enos": "Enos",
        "Jarom": "Jarom",
        "Omni": "Omni",
        "Words of Mormon": "Salita ni Mormon",
        "Mosiah": "Mosiah",
        "Alma": "Alma",
        "Helaman": "Helaman",
        "3 Nephi": "3 Nephi",
        "4 Nephi": "4 Nephi",
        "Mormon": "Mormon",
        "Ether": "Eter",
        "Moroni": "Moroni",
        // Old Testament
        "Genesis": "Genesis",
        "Exodus": "Exodo",
        "Leviticus": "Levitico",
        "Numbers": "Mga Bilang",
        "Deuteronomy": "Deuteronomio",
        "Joshua": "Josue",
        "Judges": "Mga Hukom",
        "Ruth": "Ruth",
        "1 Samuel": "1 Samuel",
        "2 Samuel": "2 Samuel",
        "1 Kings": "1 Mga Hari",
        "2 Kings": "2 Mga Hari",
        "1 Chronicles": "1 Mga Cronica",
        "2 Chronicles": "2 Mga Cronica",
        "Ezra": "Ezra",
        "Nehemiah": "Nehemias",
        "Esther": "Ester",
        "Job": "Job",
        "Psalms": "Mga Awit",
        "Proverbs": "Mga Kawikaan",
        "Ecclesiastes": "Eclesiastes",
        "Song of Solomon": "Ang Awit ni Solomon",
        "Isaiah": "Isaias",
        "Jeremiah": "Jeremias",
        "Lamentations": "Mga Panaghoy",
        "Ezekiel": "Ezekiel",
        "Daniel": "Daniel",
        "Hosea": "Oseas",
        "Joel": "Joel",
        "Amos": "Amos",
        "Obadiah": "Obadias",
        "Jonah": "Jonas",
        "Micah": "Mikas",
        "Nahum": "Nahum",
        "Habakkuk": "Habacuc",
        "Zephaniah": "Zefanias",
        "Haggai": "Hagai",
        "Zechariah": "Zacarias",
        "Malachi": "Malakias",
        // New Testament
        "Matthew": "Mateo",
        "Mark": "Marcos",
        "Luke": "Lucas",
        "John": "Juan",
        "Acts": "Mga Gawa",
        "Romans": "Mga Taga-Roma",
        "1 Corinthians": "1 Mga Taga-Corinto",
        "2 Corinthians": "2 Mga Taga-Corinto",
        "Galatians": "Mga Taga-Galacia",
        "Ephesians": "Mga Taga-Efeso",
        "Philippians": "Mga Taga-Filipos",
        "Colossians": "Mga Taga-Colosas",
        "1 Thessalonians": "1 Mga Taga-Tesalonica",
        "2 Thessalonians": "2 Mga Taga-Tesalonica",
        "1 Timothy": "1 Timoteo",
        "2 Timothy": "2 Timoteo",
        "Titus": "Tito",
        "Philemon": "Filemon",
        "Hebrews": "Mga Hebreo",
        "James": "Santiago",
        "1 Peter": "1 Pedro",
        "2 Peter": "2 Pedro",
        "1 John": "1 Juan",
        "2 John": "2 Juan",
        "3 John": "3 Juan",
        "Jude": "Judas",
        "Revelation": "Apocalipsis",
        // Pearl of Great Price
        "Moses": "Moises",
        "Abraham": "Abraham",
        "Joseph Smith-Matthew": "Joseph Smith—Mateo",
        "Joseph Smith-History": "Joseph Smith—Kasaysayan",
        "Articles of Faith": "Mga Saligan ng Pananampalataya",
    };

    const bookUrlPart = bookMappings[bookName];

    if (!bookUrlPart) return null;

    // --- Post-Mapping Smart Volume Detection ---
    if (!volumeUrlPart) {
        const slugToVolume: Record<string, string> = {
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
            // Pearl of Great Price
            'moses': 'pgp', 'abr': 'pgp', 'js-m': 'pgp', 'js-h': 'pgp', 'a-of-f': 'pgp',
            // D&C
            'dc': 'dc-testament', 'od': 'dc-testament'
        };
        volumeUrlPart = slugToVolume[bookUrlPart] || "";
    }

    if (!volumeUrlPart) return null;

    // Special case for Doctrine and Covenants to use its specific URL structure
    if (volumeUrlPart === "dc-testament" && bookUrlPart === "dc") {
        return `${baseUrl}/dc-testament/dc/${chapterNum}${urlSuffix}`;
    }

    return `${baseUrl}/${volumeUrlPart}/${bookUrlPart}/${chapterNum}${urlSuffix}`;
};

export const getCategoryFromScripture = (scriptureText: string | null | undefined): string => {
    // Try to get a URL to see where it leads (this uses the full smart mapping logic)
    const url = getGospelLibraryUrl(null, scriptureText);

    let volumeUrlPart = "";
    if (url) {
        // Extract volume from URL
        // Example: https://www.churchofjesuschrist.org/study/scriptures/ot/gen/1?lang=eng
        // We look for /scriptures/([^/]+)/
        const scriptMatch = url.match(/\/scriptures\/([^/?#]+)/);
        if (scriptMatch) {
            volumeUrlPart = scriptMatch[1];
        } else if (url.includes('/general-conference/')) {
            volumeUrlPart = 'general-conference';
        } else if (url.includes('speeches.byu.edu')) {
            volumeUrlPart = 'byu-speeches';
        }
    }

    // If still not found, try the old detectVolume as fallback
    if (!volumeUrlPart) {
        volumeUrlPart = detectVolume(null, scriptureText);
    }

    const mapping: Record<string, string> = {
        'ot': 'Old Testament',
        'nt': 'New Testament',
        'bofm': 'Book of Mormon',
        'dc-testament': 'Doctrine and Covenants',
        'pgp': 'Pearl of Great Price',
        'ordinances-and-proclamations': 'Ordinances and Proclamations',
        'sacrament': 'Ordinances and Proclamations',
        'baptism': 'Ordinances and Proclamations',
        'the-family-a-proclamation-to-the-world': 'Ordinances and Proclamations',
        'the-living-christ-the-testimony-of-the-apostles': 'Ordinances and Proclamations',
        'the-restoration-of-the-fulness-of-the-gospel-of-jesus-christ': 'Ordinances and Proclamations',
        'general-conference': 'General Conference',
        'byu-speeches': 'BYU Speeches'
    };
    return mapping[volumeUrlPart] || 'Other';
};

export const getScriptureInfoFromText = (text: string | null | undefined): string | null => {
    if (!text) return null;
    const chapterMatch = text.match(/\*\*(?:Chapter|Title):\*\* (.*?)(?:\n|$)/);
    const scriptureMatch = text.match(/\*\*Scripture:\*\* (.*?)(?:\n|$)/);

    if (chapterMatch && scriptureMatch) {
        const scripture = scriptureMatch[1].trim();
        const chapter = chapterMatch[1].trim();
        return getGospelLibraryUrl(scripture, chapter);
    }
    return null;
};
