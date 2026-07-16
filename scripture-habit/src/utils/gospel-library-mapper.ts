import { parseStructuredNoteText } from './note-parser-utils';

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
    } else if (lowerVolume.includes("doctrine and") || volume === "教義と聖約" || volume === "Doutrina e Convênios" || volume === "教義和聖約" || volume === "Doctrina y Convenios" || volume === "Giáo Lý và Giao Ước" || volume === "หลักคำสอนและพันธสัญญา" || volume === "교리와 성약" || volume === "Doktrina at mga Tipan" || volume === "Mafundisho na Maagano" || lowerVolume === "dc-testament" || lowerVolume === "dc") {
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

    if (volumeUrlPart === "general-conference") {
        if (chapterInput.includes("churchofjesuschrist.org")) {
            try {
                let urlStr = chapterInput.trim();
                if (!urlStr.startsWith('http')) urlStr = 'https://' + urlStr;
                const url = new URL(urlStr);
                const targetLang = langParam.split('=')[1];
                url.searchParams.set('lang', targetLang);
                return url.toString();
            } catch {
                return chapterInput;
            }
        }
        if (/^\d{4}\/\d{2}\/.+/.test(chapterInput)) {
            return `https://www.churchofjesuschrist.org/study/general-conference/${chapterInput}${langParam}`;
        }
        if (/^\d{4}\/\d{2}$/.test(chapterInput)) {
            return `https://www.churchofjesuschrist.org/study/general-conference/${chapterInput}${langParam}`;
        }
    }

    if (volumeUrlPart === "byu-speeches") return chapterInput;

    if (volumeUrlPart === "ordinances-and-proclamations") {
        const lowerChap = chapterInput.toLowerCase();
        if (lowerChap.includes("sacrament") || lowerChap.includes("聖餐") || lowerChap.includes("sacramental") || lowerChap.includes("tiệc thánh")) return `${baseUrl}/sacrament${langParam}`;
        if (lowerChap.includes("baptism") || lowerChap.includes("バプテスマ") || lowerChap.includes("batismo") || lowerChap.includes("bautismo") || lowerChap.includes("báp têm")) return `${baseUrl}/baptism${langParam}`;
        if (lowerChap.includes("family") || lowerChap.includes("家族") || lowerChap.includes("família") || lowerChap.includes("proclamación sobre la family")) return `${baseUrl}/the-family-a-proclamation-to-the-world${langParam}`;
        if (lowerChap.includes("living christ") || lowerChap.includes("生けるキリスト") || lowerChap.includes("cristo vivo") || lowerChap.includes("cristo viviente")) return `${baseUrl}/the-living-christ-the-testimony-of-the-apostles${langParam}`;
        if (lowerChap.includes("restoration") || lowerChap.includes("回復") || lowerChap.includes("restauração") || lowerChap.includes("restauración")) return `${baseUrl}/the-restoration-of-the-fulness-of-the-gospel-of-jesus-christ${langParam}`;
        return `${baseUrl}/ordinances-and-proclamations${langParam}`;
    }

    let cleanChapterInput = chapterInput;
    cleanChapterInput = cleanChapterInput.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    cleanChapterInput = cleanChapterInput.replace(/：/g, ':').replace(/[，、]/g, ',').replace(/\u3000/g, ' ').replace(/[－—―]/g, '-');
    cleanChapterInput = cleanChapterInput.replace(/章\s*(?=\d)/g, ':').replace(/章/g, '').replace(/節/g, '');

    const match = cleanChapterInput.match(/(.*?)\s*(\d+)(?::([\d\s,-]+))?\s*$/);
    if (!match) return null;

    const bookName = match[1].trim().toLowerCase().replace(/[.]/g, '').replace(/^第(?=\d)/, '');
    const chapterNum = match[2];
    const verses = match[3];

    const bookMappings: Record<string, string> = {
        "1 nephi": "1-ne", "1 néfi": "1-ne", "1 nefi": "1-ne", "1ニーファイ": "1-ne", "第1ニーファイ": "1-ne", "第１ニーファイ": "1-ne", "第一ニーファイ": "1-ne", "ニーファイ第一の書": "1-ne", "ニーファイ第一書": "1-ne", "尼腓一書": "1-ne", "1 นีไฟ": "1-ne", "니파이전서": "1-ne",
        "2 nephi": "2-ne", "2 néfi": "2-ne", "2 nefi": "2-ne", "2ニーファイ": "2-ne", "第2ニーファイ": "2-ne", "第２ニーファイ": "2-ne", "第二ニーファイ": "2-ne", "ニーファイ第二の書": "2-ne", "ニーファイ第二書": "2-ne", "尼腓二書": "2-ne", "2 นีไฟ": "2-ne", "니파이후서": "2-ne",
        "jacob": "jacob", "jacó": "jacob", "gia cốp": "jacob", "ヤコブ書": "jacob", "雅各書": "jacob", "ยาคอบ": "jacob", "야곱서": "jacob",
        "enos": "enos", "enós": "enos", "ê nốt": "enos", "エノス書": "enos", "以挪士書": "enos", "อีนัส": "enos", "이노스서": "enos",
        "jarom": "jarom", "gia rôm": "jarom", "ジェロム書": "jarom", "雅龍書": "jarom", "จารอม": "jarom", "예이롬서": "jarom",
        "omni": "omni", "ômni": "omni", "オムナイ書": "omni", "奧姆奈書": "omni", "ออมไน": "omni", "옴나이서": "omni",
        "words of mormon": "w-of-m", "palavras de mórmon": "w-of-m", "palabras de mormón": "w-of-m", "モルモンの言葉": "w-of-m", "摩爾門語": "w-of-m", "ถ้อยคำของมอรมอน": "w-of-m", "몰몬의 말씀": "w-of-m", "salita ni mormon": "w-of-m",
        "mosiah": "mosiah", "mosías": "mosiah", "mosias": "mosiah", "モーサヤ書": "mosiah", "摩賽亞書": "mosiah", "โมไซยาห์": "mosiah", "모사이야서": "mosiah",
        "alma": "alma", "an ma": "alma", "アルマ書": "alma", "阿爾瑪書": "alma", "แอลมา": "alma", "앨마서": "alma",
        "helaman": "hel", "hel": "hel", "helamã": "hel", "helamán": "hel", "hê la man": "hel", "ヒラマン書": "hel", "希拉曼書": "hel", "ฮีลามัน": "hel", "힐라맨서": "hel",
        "3 nephi": "3-ne", "3 néfi": "3-ne", "3 nefi": "3-ne", "3ニーファイ": "3-ne", "第3ニーファイ": "3-ne", "第三ニーファイ": "3-ne", "ニーファイ第三の書": "3-ne", "ニーファイ第三書": "3-ne", "尼腓三書": "3-ne", "3 นีไฟ": "3-ne", "제3니파이": "3-ne",
        "4 nephi": "4-ne", "4 néfi": "4-ne", "4 nefi": "4-ne", "4ニーファイ": "4-ne", "第4ニーファイ": "4-ne", "第四ニーファイ": "4-ne", "ニーファイ第四の書": "4-ne", "ニーファイ第四書": "4-ne", "尼腓四書": "4-ne", "4 นีไฟ": "4-ne", "제4니파이": "4-ne",
        "mormon": "morm", "mórmon": "morm", "mormón": "morm", "モルモン書": "morm", "摩爾門書": "morm", "มอรมอน": "morm", "몰몬경": "morm",
        "ether": "eth", "éter": "eth", "エテル書": "eth", "以帖書": "eth", "อีเธอร์": "eth", "이더서": "eth",
        "moroni": "moro", "morôni": "moro", "モロナイ書": "moro", "摩羅乃書": "moro", "โมโรไน": "moro", "모로나이서": "moro",
        "genesis": "gen", "gênesis": "gen", "génesis": "gen", "創世記": "gen", "ปฐมกาล": "gen", "창세기": "gen",
        "exodus": "ex", "êxodo": "ex", "éxodo": "ex", "出エジプト記": "ex", "出埃及記": "ex", "อพยพ": "ex", "출애굽기": "ex", "exodo": "ex",
        "leviticus": "lev", "levítico": "lev", "レビ記": "lev", "利未記": "lev", "เลวีนิติ": "lev", "레위기": "lev", "levitico": "lev",
        "numbers": "num", "números": "num", "民数記": "num", "民數記": "num", "กันดารวิถี": "num", "민수기": "num", "mga bilang": "num",
        "deuteronomy": "deut", "deuteronômio": "deut", "deuteronomio": "deut", "申命記": "deut", "เฉลยธรรมบัญญัติ": "deut", "신명기": "deut",
        "joshua": "josh", "josué": "josh", "josue": "josh", "ヨシュア記": "josh", "約書亞記": "josh", "โยชูวา": "josh", "여호와": "josh",
        "judges": "judg", "juízes": "judg", "jueces": "judg", "士師記": "judg", "ผู้วินิจฉัย": "judg", "사사기": "judg", "mga hukom": "judg",
        "ruth": "ruth", "rute": "ruth", "rut": "ruth", "ルツ記": "ruth", "路得記": "ruth", "นางรูธ": "ruth", "룻기": "ruth",
        "1 samuel": "1-sam", "サムエル記上": "1-sam", "撒母耳記上": "1-sam", "1 ซามูเอล": "1-sam", "사무엘상": "1-sam",
        "2 samuel": "2-sam", "サムエル記下": "2-sam", "撒母耳記下": "2-sam", "2 ซามูเอล": "2-sam", "사무엘하": "2-sam",
        "1 kings": "1-kgs", "1 reis": "1-kgs", "1 reyes": "1-kgs", "列王記上": "1-kgs", "列王紀上": "1-kgs", "1 พงศ์กษัตริย์": "1-kgs", "열왕기상": "1-kgs", "1 mga hari": "1-kgs",
        "2 kings": "2-kgs", "2 reis": "2-kgs", "2 reyes": "2-kgs", "列王記下": "2-kgs", "列王紀下": "2-kgs", "2 พงศ์กษัตริย์": "2-kgs", "열왕기하": "2-kgs", "2 mga hari": "2-kgs",
        "1 chronicles": "1-chr", "1 crônicas": "1-chr", "1 crónicas": "1-chr", "歴代誌上": "1-chr", "歷代志上": "1-chr", "1 พงศาวดาร": "1-chr", "역대상": "1-chr", "1 mga cronica": "1-chr",
        "2 chronicles": "2-chr", "2 crônicas": "2-chr", "2 crónicas": "2-chr", "歴代誌下": "2-chr", "歷代志下": "2-chr", "2 พงศาวดาร": "2-chr", "역대하": "2-chr", "2 mga cronica": "2-chr",
        "ezra": "ezra", "esdras": "ezra", "エズラ記": "ezra", "以斯拉記": "ezra", "เอสรา": "ezra", "에스라": "ezra",
        "nehemiah": "neh", "neemias": "neh", "nehemías": "neh", "ネヘミヤ記": "neh", "尼希米記": "neh", "เนหะมีย์": "neh", "느헤미야": "neh", "nehemias": "neh",
        "esther": "esth", "ester": "esth", "エステル記": "esth", "以斯帖記": "esth", "เอสเธอร์": "esth", "에스더": "esth",
        "job": "job", "jó": "job", "ヨブ記": "job", "約伯記": "job", "โยบ": "job", "욥기": "job",
        "psalms": "ps", "psalm": "ps", "salmos": "ps", "詩篇": "ps", "สดุดี": "ps", "시편": "ps", "mga awit": "ps",
        "proverbs": "prov", "provérbios": "prov", "proverbios": "prov", "箴言": "prov", "สุภาษิต": "prov", "잠언": "prov", "mga kawikaan": "prov",
        "ecclesiastes": "eccl", "eclesiastes": "eccl", "eclesiastés": "eccl", "伝道の書": "eccl", "傳道書": "eccl", "ปัญญาจารย์": "eccl", "전도서": "eccl",
        "song of solomon": "song", "cânticos de salomão": "song", "cantares": "song", "雅歌": "song", "เพลงไพเราะ": "song", "아가": "song", "ang awit ni solomon": "song",
        "isaiah": "isa", "isaías": "isa", "isaias": "isa", "イザヤ書": "isa", "以賽亞書": "isa", "อิสยาห์": "isa", "이사야": "isa",
        "jeremiah": "jer", "jeremias": "jer", "jeremías": "jer", "エレミヤ書": "jer", "耶利米書": "jer", "เยเรมีย์": "jer", "예레미야": "jer",
        "lamentations": "lam", "lamentações": "lam", "lamentaciones": "lam", "哀歌": "lam", "耶利米哀歌": "lam", "เพลงคร่ำครวญ": "lam", "예레미야애가": "lam", "mga panaghoy": "lam",
        "ezekiel": "ezek", "ezequiel": "ezek", "エゼキエル書": "ezek", "以西結書": "ezek", "เอเสเคียล": "ezek", "에스겔": "ezek",
        "daniel": "dan", "ダニエル書": "dan", "但以理書": "dan", "ดาเนียล": "dan", "다니엘": "dan",
        "hosea": "hosea", "oseias": "hosea", "oseas": "hosea", "ホセア書": "hosea", "何西阿書": "hosea", "โฮเชยา": "hosea", "호세า": "hosea",
        "joel": "joel", "ヨエル書": "joel", "約珥書": "joel", "โยเอล": "joel", "요엘": "joel",
        "amos": "amos", "amós": "amos", "アモス書": "amos", "阿摩司書": "amos", "อาโมส": "amos", "아โมส": "amos",
        "obadiah": "obad", "obadias": "obad", "abdías": "obad", "オバデヤ書": "obad", "俄巴底亞書": "obad", "โอบาดีห์": "obad", "오바댜": "obad",
        "jonah": "jonah", "jonas": "jonah", "jonás": "jonah", "ヨナ書": "jonah", "約拿書": "jonah", "โยนา": "jonah", "요나": "jonah",
        "micah": "micah", "miqueias": "micah", "miqueas": "micah", "ミカ書": "micah", "彌迦書": "micah", "มีคาห์": "micah", "미가": "micah", "mikas": "micah",
        "nahum": "nahum", "naum": "nahum", "nahúm": "nahum", "ナホム書": "nahum", "那鴻書": "nahum", "นาฮูม": "nahum", "나훔": "nahum",
        "habakkuk": "hab", "habacuque": "hab", "habacuc": "hab", "ハバクク書": "hab", "哈巴谷書": "hab", "ฮาบากุก": "hab", "하박국": "hab",
        "zephaniah": "zeph", "sofonias": "zeph", "sofonías": "zeph", "ゼパニヤ書": "zeph", "西番雅書": "zeph", "เศฟันยาห์": "zeph", "스바냐": "zeph", "zefanias": "zeph",
        "haggai": "hag", "ageu": "hag", "hageo": "hag", "ハガイ書": "hag", "哈該書": "hag", "ฮักกัย": "hag", "학개": "hag", "hagai": "hag",
        "zechariah": "zech", "zacarias": "zech", "zacarías": "zech", "ゼカリヤ書": "zech", "撒迦利亞書": "zech", "เศคาริยาห์": "zech", "스가랴": "zech",
        "malachi": "mal", "malaquias": "mal", "malaquías": "mal", "マラキ書": "mal", "瑪拉基書": "mal", "มาลาคี": "mal", "말라기": "mal", "malakias": "mal",
        "matthew": "matt", "mateus": "matt", "mateo": "matt", "マタイによる福音書": "matt", "馬太福音": "matt", "มัทธิว": "matt", "마태복음": "matt",
        "mark": "mark", "marcos": "mark", "マルコによる福音書": "mark", "馬可福音": "mark", "มาระโก": "mark", "마가복음": "mark",
        "luke": "luke", "lucas": "luke", "ルカによる福音書": "luke", "路加福音": "luke", "ลูกา": "luke", "누가복음": "luke",
        "john": "john", "joão": "john", "juan": "john", "ヨハネによる福音書": "john", "約翰福音": "john", "ยอห์น": "john", "요한복음": "john",
        "acts": "acts", "atos": "acts", "hechos": "acts", "使徒行伝": "acts", "使徒行傳": "acts", "กิจการ": "acts", "사도행전": "acts", "mga gawa": "acts",
        "romans": "rom", "romanos": "rom", "ローマ人への手紙": "rom", "羅馬書": "rom", "โรม": "rom", "로마서": "rom", "mga taga-roma": "rom",
        "1 corinthians": "1-cor", "1 coríntios": "1-cor", "1 corintios": "1-cor", "コリント人への第一の手紙": "1-cor", "コリント人への手紙第一": "1-cor", "哥林多前書": "1-cor", "1 โครินธ์": "1-cor", "고린도전서": "1-cor", "1 mga taga-corinto": "1-cor",
        "2 corinthians": "2-cor", "2 coríntios": "2-cor", "2 corintios": "2-cor", "コリント人への第二の手紙": "2-cor", "コリント人への手紙第二": "2-cor", "哥林多後書": "2-cor", "2 โครินธ์": "2-cor", "고린도후서": "2-cor", "2 mga taga-corinto": "2-cor",
        "galatians": "gal", "gálatas": "gal", "galatas": "gal", "ガラテヤ人への手紙": "gal", "加拉太書": "gal", "กาลาเทีย": "gal", "갈라디아서": "gal", "mga taga-galacia": "gal",
        "ephesians": "eph", "efésios": "eph", "efesios": "eph", "エペソ人への手紙": "eph", "以弗所書": "eph", "เอเฟซัส": "eph", "에베소서": "eph", "mga taga-efeso": "eph",
        "philippians": "philip", "filipenses": "philip", "ピリピ人への手紙": "philip", "腓立比書": "philip", "ฟิลิปปี": "philip", "빌립보서": "philip", "mga taga-filipos": "philip",
        "colossians": "col", "colossenses": "col", "colosenses": "col", "コロサイ人への手紙": "col", "歌羅西書": "col", "โคโลสี": "col", "골로새서": "col", "mga taga-colosas": "col",
        "1 thessalonians": "1-thes", "1 tessalonicenses": "1-thes", "1 tesalonicenses": "1-thes", "テサロニケ人への第一の手紙": "1-thes", "テサロニケ人への手紙第一": "1-thes", "帖撒羅尼迦前書": "1-thes", "1 เธสะโลนิกา": "1-thes", "데살로니가전서": "1-thes", "1 mga taga-tesalonica": "1-thes",
        "2 thessalonians": "2-thes", "2 tessalonicenses": "2-thes", "2 tesalonicenses": "2-thes", "テサロニケ人への第二の手紙": "2-thes", "テサロニケ人への手紙第二": "2-thes", "帖撒羅尼迦後書": "2-thes", "2 เธสะโลนิกา": "2-thes", "데살로니가후서": "2-thes", "2 mga taga-tesalonica": "2-thes",
        "1 timothy": "1-tim", "1 timóteo": "1-tim", "1 timoteo": "1-tim", "テモテへの第一の手紙": "1-tim", "テモテへの手紙第一": "1-tim", "提摩太前書": "1-tim", "1 ทิโมธี": "1-tim", "디모데전서": "1-tim",
        "2 timothy": "2-tim", "2 timóteo": "2-tim", "2 timoteo": "2-tim", "テモテへの第二の手紙": "2-tim", "テモテへの手紙第二": "2-tim", "提摩太後書": "2-tim", "2 ทิโมธี": "2-tim", "디모데후서": "2-tim",
        "titus": "titus", "tito": "titus", "テトスへの手紙": "titus", "提多書": "titus", "ทิตัส": "titus", "디도서": "titus",
        "philemon": "philem", "filemom": "philem", "filemón": "philem", "filemon": "philem", "ピレモンへの手紙": "philem", "腓利門書": "philem", "ฟีเลโมน": "philem", "빌레몬서": "philem",
        "hebrews": "heb", "hebreus": "heb", "hebreos": "heb", "ヘブル人への手紙": "heb", "希伯來書": "heb", "ฮีบรู": "heb", "히브리서": "heb", "mga hebreo": "heb",
        "james": "jas", "tiago": "jas", "santiago": "jas", "ヤコブの手紙": "jas", "ยากอบ": "jas", "야고보서": "jas",
        "1 peter": "1-pet", "1 pedro": "1-pet", "ペテロの第一の手紙": "1-pet", "ペテロの手紙第一": "1-pet", "彼得前書": "1-pet", "1 เปโตร": "1-pet", "베드로전서": "1-pet",
        "2 peter": "2-pet", "2 pedro": "2-pet", "ペテロの第二の手紙": "2-pet", "ペテロの手紙第二": "2-pet", "彼得後書": "2-pet", "2 เปโตร": "2-pet", "베드로후서": "2-pet",
        "1 john": "1-jn", "1 joão": "1-jn", "1 joao": "1-jn", "1 juan": "1-jn", "ヨハネの第一の手紙": "1-jn", "ヨハネの手紙第一": "1-jn", "約翰一書": "1-jn", "1 ยอห์น": "1-jn", "요한1서": "1-jn",
        "2 john": "2-jn", "2 joão": "2-jn", "2 joao": "2-jn", "2 juan": "2-jn", "ヨハネの第二の手紙": "2-jn", "ヨハネの手紙第二": "2-jn", "約翰二書": "2-jn", "2 ยอห์น": "2-jn", "요한2서": "2-jn",
        "3 john": "3-jn", "3 joão": "3-jn", "3 joao": "3-jn", "3 juan": "3-jn", "ヨハネの第三の手紙": "3-jn", "ヨハネの手紙第三": "3-jn", "約翰三書": "3-jn", "3 ยอห์น": "3-jn", "요한3서": "3-jn",
        "jude": "jude", "judas": "jude", "ユダの手紙": "jude", "猶大書": "jude", "ยูดา": "jude", "유다서": "jude",
        "revelation": "rev", "apocalipse": "rev", "apocalipsis": "rev", "ヨハネの黙示録": "rev", "啟示錄": "rev", "วิวรณ์": "rev", "요한계시록": "rev",
        "moses": "moses", "moisés": "moses", "moises": "moses", "môi se": "moses", "モーセ書": "moses", "摩西書": "moses", "โมเสส": "moses", "모세서": "moses",
        "abraham": "abr", "abraão": "abr", "abraao": "abr", "áp ra ham": "abr", "アブラハム書": "abr", "亞伯拉罕書": "abr", "อับราฮัม": "abr", "아브라함서": "abr",
        "joseph smith-matthew": "js-m", "joseph smith matthew": "js-m", "joseph smith—mateus": "js-m", "josé smith—mateo": "js-m", "giô sép smith—ma thi ơ": "js-m", "ジョセフ・スミス—マタイ": "js-m", "約瑟·斯密——馬太": "js-m", "โจเซฟ สมิธ—มัทธิว": "js-m", "조셉 スミス—마태": "js-m",
        "joseph smith-history": "js-h", "joseph smith history": "js-h", "joseph smith—história": "js-h", "josé smith—historia": "js-h", "giô sép smith—lịch sử": "js-h", "ジョセフ・スミス—歴史": "js-h", "約瑟·斯密——歷史": "js-h", "โจเซฟ สมิธ—ประวัติ": "js-h", "조셉 スミス—역사": "js-h",
        "articles of faith": "a-of-f", "regras de fé": "a-of-f", "artículos de fe": "a-of-f", "những tín điều": "a-of-f", "信仰箇条": "a-of-f", "信條": "a-of-f", "หลักแห่งความเชื่อ": "a-of-f", "신앙개조": "a-of-f",
        "doctrine and covenants": "dc", "教義と聖約": "dc", "doutrina e convênios": "dc", "教義和聖約": "dc", "doctrina y convenios": "dc", "giáo lý và giao ước": "dc", "หลักคำสอนและพันธสัญญา": "dc", "교리와 성약": "dc", "doktrina at mga tipan": "dc", "mafundisho na maagano": "dc", "d&c": "dc", "dc": "dc",
        "od": "od", "公式の宣言": "od", "official declarations": "od"
    };

    let bookUrlPart = bookMappings[bookName];
    if (!bookUrlPart && volumeUrlPart === "dc-testament" && !bookName) {
        bookUrlPart = "dc";
    }
    if (!bookUrlPart) return null;

    if (!volumeUrlPart) {
        const slugToVolume: Record<string, string> = {
            'gen': 'ot', 'ex': 'ot', 'lev': 'ot', 'num': 'ot', 'deut': 'ot', 'josh': 'ot', 'judg': 'ot', 'ruth': 'ot',
            '1-sam': 'ot', '2-sam': 'ot', '1-kgs': 'ot', '2-kgs': 'ot', '1-chr': 'ot', '2-chr': 'ot', 'ezra': 'ot',
            'neh': 'ot', 'esth': 'ot', 'job': 'ot', 'ps': 'ot', 'prov': 'ot', 'eccl': 'ot', 'song': 'ot', 'isa': 'ot',
            'jer': 'ot', 'lam': 'ot', 'ezek': 'ot', 'dan': 'ot', 'hosea': 'ot', 'joel': 'ot', 'amos': 'ot', 'obad': 'ot',
            'jonah': 'ot', 'micah': 'ot', 'nahum': 'ot', 'hab': 'ot', 'zeph': 'ot', 'hag': 'ot', 'zech': 'ot', 'mal': 'ot',
            'matt': 'nt', 'mark': 'nt', 'luke': 'nt', 'john': 'nt', 'acts': 'nt', 'rom': 'nt', '1-cor': 'nt', '2-cor': 'nt',
            'gal': 'nt', 'eph': 'nt', 'philip': 'nt', 'col': 'nt', '1-thes': 'nt', '2-thes': 'nt', '1-tim': 'nt', '2-tim': 'nt',
            'titus': 'nt', 'philem': 'nt', 'heb': 'nt', 'jas': 'nt', '1-pet': 'nt', '2-pet': 'nt', '1-jn': 'nt', '2-jn': 'nt',
            '3-jn': 'nt', 'jude': 'nt', 'rev': 'nt',
            '1-ne': 'bofm', '2-ne': 'bofm', 'jacob': 'bofm', 'enos': 'bofm', 'jarom': 'bofm', 'omni': 'bofm', 'w-of-m': 'bofm',
            'mosiah': 'bofm', 'alma': 'bofm', 'hel': 'bofm', '3-ne': 'bofm', '4-ne': 'bofm', 'morm': 'bofm', 'eth': 'bofm',
            'moro': 'bofm',
            'moses': 'pgp', 'abr': 'pgp', 'js-m': 'pgp', 'js-h': 'pgp', 'a-of-f': 'pgp',
            'dc': 'dc-testament', 'od': 'dc-testament'
        };
        volumeUrlPart = slugToVolume[bookUrlPart] || "";
    }

    if (!volumeUrlPart) return null;

    let urlSuffix = langParam;
    if (verses) {
        const idValue = verses.replace(/\d+/g, m => `p${m}`);
        const firstVerse = verses.match(/\d+/)?.[0];
        if (idValue) {
            urlSuffix += `&id=${idValue}`;
            if (firstVerse) urlSuffix += `#p${firstVerse}`;
        }
    }

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
