import { parseStructuredNoteText } from './note-parser-utils';
import { LANGUAGES } from '../config/languages';

const VOLUME_MAPPINGS: Record<string, string[]> = {
    ot: [
        "old testament", "ot", "old", "旧約聖書", "旧約", "velho testamento", "antigo testamento",
        "antiguo testamento", "cựu ước", "พันธสัญญาเดิม", "구약성경", "구약", "matandang tipan", "agano la kale",
        "旧约", "舊約"
    ],
    nt: [
        "new testament", "nt", "new", "新約聖書", "新約", "novo testamento", "nuevo testamento",
        "tân ước", "พันธสัญญาใหม่", "신약성경", "신약", "bagong tipan", "agano jipya",
        "新约", "新約"
    ],
    bofm: [
        "book of mormon", "bofm", "bom", "mormon", "モルモン書", "モルモン", "livro de mórmon",
        "libro de mormón", "sách mặc môn", "พระคัมภีร์มอรมอน", "몰몬경", "aklat ni mormon", "kitabu cha mormoni",
        "摩爾門經", "摩尔门经"
    ],
    "dc-testament": [
        "dc", "dc-testament", "教義と聖約", "doutrina e convênios", "教義和聖約",
        "doctrina y convenios", "giáo lý và giao ước", "หลักคำสอนและพันธสัญญา",
        "교리와 성약", "doktrina at mga tipan", "mafundisho na maagano",
        "教义和圣约"
    ],
    pgp: [
        "pgp", "pearl of great price", "高価な真珠", "pérola de grande valor", "無價珍珠",
        "perla de gran precio", "trân châu vô giá", "ไข่มุกอันล้ำค่า", "값진 진주",
        "perlas na may dakilang halaga", "lulu ya thamani kuu",
        "无价珍珠"
    ],
    "general-conference": [
        "general conference", "gc", "総大会", "conferência geral", "đại hội trung ương",
        "การประชุมใหญ่สามัญ", "연차대회", "pangkalahatang kumperensya", "mkutano mkuu",
        "总大会", "總大會"
    ],
    "byu-speeches": [
        "byu-speeches", "byu speeches"
    ],
    "ordinances-and-proclamations": [
        "proclamations", "ordinances and proclamations", "priesthood ordinances and proclamations", "儀式と宣言",
        "ordenanças e declarações", "聖職教儀和文告", "ordenanzas del sacerdocio y proclamaciones", "教仪和宣告",
        "mga ordinansa at mga pagpapahayag"
    ]
};

const LANGUAGE_PARAMS: Record<string, string> = Object.fromEntries(
    LANGUAGES.filter(l => l.code !== 'en').map(l => [l.code, `?lang=${l.ldsCode}`])
);

const SLUG_TO_VOLUME: Record<string, string> = {
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

const CHAPTER_FALLBACKS = [
    {
        key: "ordinances-and-proclamations",
        keywords: [
            // English
            "proclamation", "family", "living christ", "restoration", "sacrament", "baptism",
            // Japanese
            "家族", "生けるキリスト", "回復", "聖餐", "バプテスマ",
            // Spanish
            "proclama", "declaracion", "familia", "cristo viviente", "restauración", "bautismo",
            // Portuguese
            "declaração", "família", "cristo vivo", "restauração", "sacramento", "batismo",
            // Chinese
            "家庭", "活著的基督", "復興", "洗禮", "聖職教儀和文告",
            // Korean
            "선언문", "살아 계신 그리스도", "회복", "침례",
            // Thai
            "ประกาศ", "ครอบครัว", "พระคริสต์ผู้ทรงพระชนม์", "การฟื้นฟู", "ศีลระลึก", "บัพติศมา",
            // Vietnamese
            "tuyên ngôn", "gia đình", "đấng ky tô hằng sống", "sự phục hồi", "tiệc thánh", "báp têm",
            // Tagalog
            "pahayag", "pamilya", "buhay na cristo", "panunumbalik", "sakramento",
            // Swahili
            "tangazo", "kristo aliye hai", "urejesho", "sakramenti", "ubatizo"
        ]
    },
    {
        key: "general-conference",
        keywords: [
            // English
            "general conference", "conference", "churchofjesuschrist.org",
            // Japanese
            "総大会", "大会",
            // Spanish
            "conferencia general", "conferencia",
            // Portuguese
            "conferência geral", "conferência",
            // Chinese
            "總大會", "大會", "总大会",
            // Korean
            "연차대회", "대회",
            // Thai
            "การประชุมใหญ่สามัญ", "การประชุมใหญ่",
            // Vietnamese
            "đại hội trung ương", "đại hội",
            // Tagalog
            "pangkalahatang kumperensya", "kumperensya",
            // Swahili
            "mkutano mkuu", "mkutano"
        ]
    },
    {
        key: "byu-speeches",
        keywords: [
            "byu", "speeches.byu.edu"
        ]
    },
    {
        key: "dc-testament",
        keywords: [
            // English
            "doctrine and covenants", "d&c", "d.&c.", "d. & c.",
            // Japanese
            "教義と聖約",
            // Spanish
            "doctrina y convenios",
            // Portuguese
            "doutrina e convênios",
            // Chinese
            "教義和聖約",
            // Korean
            "교리와 성약",
            // Thai
            "หลักคำสอนและพันธสัญญา",
            // Vietnamese
            "giáo lý và giao ước",
            // Tagalog
            "doktrina at mga tipan",
            // Swahili
            "mafundisho na maagano"
        ]
    },
    {
        key: "bofm",
        keywords: [
            // English
            "1 nephi", "2 nephi", "jacob", "enos", "jarom", "omni", "words of mormon", "mosiah", "alma", "helaman",
            "3 nephi", "4 nephi", "mormon", "ether", "moroni",
            // Japanese
            "ニーファイ", "ヤコブ", "エノス", "ジェロム", "オムナイ", "モルモンの言葉", "モーサヤ", "アルマ", "ヒラマン", "エテル", "モロナイ",
            // Spanish
            "nefi", "jacobo", "enós", "jarom", "omni", "palabras de mormón", "mosíah", "alma", "helamán", "mormón", "éter", "moroni",
            // Portuguese
            "néfi", "jacó", "enos", "jarom", "ômni", "palavras de mórmon", "mosias", "alma", "helamã", "mórmon", "éter", "morôni",
            // Chinese
            "尼腓", "雅各書", "以挪士", "雅龍書", "奧姆奈", "摩爾門語", "摩賽亞", "阿爾瑪", "希拉曼", "摩爾門書", "以帖", "摩羅乃",
            // Korean
            "니파이", "야곱서", "이노스", "예이롬", "옴나이", "몰몬의 말씀", "모사이야", "앨마", "힐라맨", "몰몬경", "이더", "모로나이",
            // Thai
            "นีไฟ", "ยาคอบ", "อีนัส", "จารอม", "ออมไน", "ถ้อยคำของมอรมอน", "โมไซยาห์", "แอลมา", "ฮีลามัน", "มอรมอน", "อีเธอร์", "โมโรไน",
            // Vietnamese
            "nê-phi", "gia cốp", "ê nốt", "gia rôm", "ô-mni", "lời của mặc môn", "mô-si-a", "an-ma", "hê-la-man", "mặc môn", "ét", "mô-rô-ni",
            // Tagalog
            "salita ni mormon", "aklat ni mormon",
            // Swahili
            "nefi", "yakobo", "enosi", "yaromu", "maneno ya mormoni", "mosia", "helamani", "kitabu cha mormoni"
        ]
    },
    {
        key: "ot",
        keywords: [
            // English
            "genesis", "exodus", "leviticus", "numbers", "deuteronomy", "joshua", "judges", "ruth", "1 samuel",
            "2 samuel", "1 kings", "2 kings", "1 chronicles", "2 chronicles", "ezra", "nehemiah", "esther", "job",
            "psalms", "proverbs", "ecclesiastes", "song of solomon", "isaiah", "jeremiah", "lamentations", "ezekiel",
            "daniel", "hosea", "joel", "amos", "obadiah", "jonah", "micah", "nahum", "habakkuk", "zephaniah", "haggai",
            "zechariah", "malachi",
            // Japanese
            "創世記", "出エジプト", "レビ", "民数", "申命", "ヨシュア", "士師", "ルツ", "サムエル",
            "列王", "歴代", "エズラ", "ネヘミヤ", "エステル", "ヨブ", "詩篇", "箴言", "伝道", "雅歌", "イザヤ", "エレミヤ",
            "哀歌", "エゼキエル", "ダニエル", "ホセア", "ヨエル", "アモス", "オバデヤ", "ヨナ", "ミカ", "ナホム", "ハバクク",
            "ゼパニヤ", "ハガイ", "ゼカリヤ", "マラキ",
            // Spanish
            "génesis", "génesis", "éxodo", "levítico", "números", "deuteronomio", "josué", "jueces", "rut", "reyes",
            "crónicas", "esdras", "nehemias", "nehemías", "ester", "job", "salmos", "proverbios", "eclesiastés", "cantares",
            "isaías", "isaias", "jeremías", "lamentaciones", "ezequiel", "oseas", "joel", "amós", "abdías", "jonás",
            "miqueas", "nahúm", "habacuc", "sofonías", "hageo", "zacarías", "malaquías",
            // Portuguese
            "gênesis", "êxodo", "levítico", "números", "deuteronômio", "josué", "juízes", "rute", "reis", "crônicas",
            "esdras", "neemias", "ester", "jó", "salmos", "provérbios", "eclesiastes", "cânticos", "isaías", "jeremias",
            "lamentações", "ezequiel", "oseias", "joel", "amós", "obadias", "jonas", "miqueias", "naum", "habacuque",
            "sofonias", "ageu", "zacarias", "malaquias",
            // Chinese
            "創世記", "出埃及記", "利未記", "民數記", "申命記", "約書亞記", "士師記", "路得記", "撒母耳記",
            "列王紀", "歷代志", "以斯拉記", "尼希米記", "以斯帖記", "約伯記", "詩篇", "箴言", "傳道書", "雅歌",
            "以賽亞書", "耶利米書", "耶利米哀歌", "以西結書", "但以理書", "何西阿書", "約珥書", "阿摩司書", "俄巴底亞書",
            "約拿書", "彌迦書", "那鴻書", "哈巴谷書", "西番雅書", "哈該書", "撒迦利亞書", "瑪拉基書",
            // Korean
            "창세기", "출애굽기", "레위기", "민수기", "신명기", "여호와", "사사기", "룻기", "사무엘", "열왕기", "역대", "에스라", "느헤미야",
            "에스더", "욥기", "시편", "잠언", "전도서", "아가", "이사야", "예레미야", "예레미야애가", "에스겔", "다니엘", "호세아", "요엘",
            "아모스", "오바댜", "요나", "미가", "나훔", "하박국", "스바냐", "학개", "스가랴", "말라기",
            // Thai
            "ปฐมกาล", "อพยพ", "เลวีนิติ", "กันดารวิถี", "เฉลยธรรมบัญญัติ", "โยชูวา", "ผู้วินิจฉัย", "นางรูธ", "ซามูเอล", "พงศ์กษัตริย์",
            "พงศาวดาร", "เอสรา", "เนหะมีย์", "เอสเธอร์", "สดุดี", "สุภาษิต", "ปัญญาจารย์", "เพลงไพเราะ", "อิสยาห์", "เยเรมีย์",
            "เพลงคร่ำครวญ", "เอเสเคียล", "ดาเนียล", "โฮเชยา", "โยเอล", "อาโมส", "โอบาดีห์", "โยนา", "มีคาห์", "นาฮูม", "ฮาบากุก", "เศฟันยาห์", "ฮักกัย",
            "เศคาริยาห์", "มาลาคี",
            // Vietnamese
            "sáng thế ký", "xuất ê-díp-tô ký", "lê-vi ký", "dân số ký", "phục truyền luật lệ ký", "giô-suê", "các quan xét",
            "ru-tơ", "sa-mu-ên", "các vua", "sử ký", "ê-xơ-ra", "nê-hê-mi", "ê-xơ-tê", "giốp", "thi thiên", "châm ngôn",
            "truyền đạo", "nhã ca", "ê-sai", "giê-rê-mi", "ca thương", "ê-xê-chi-ên", "đa-ni-ên", "ô-sê", "giô-ên", "a-mốt",
            "áp-đia", "giô-nát", "mi-chê", "na-hum", "ha-ba-cúc", "sô-phô-ni", "ha-gai", "xa-cha-ri", "ma-la-chi",
            // Tagalog
            "mga bilang", "mga hukom", "mga hari", "mga cronica", "mga awit", "mga kawikaan", "ang awit ni solomon",
            "mga panaghoy", "mikas", "zefanias", "malakias",
            // Swahili
            "mwanzo", "kutoka", "mambo ya walawi", "hesabu", "kumbukumbu la torati", "yoshua", "waamuzi", "ruthu",
            "samweli", "wafalme", "mambo ya nyakati", "esteri", "ayubu", "zaburi", "mithali", "muhubiri", "wimbo ulio bora",
            "isaya", "yeremia", "maombolezo", "ezekieli", "danieli", "mika", "nahumu", "sepania", "zekaria", "malaki"
        ]
    },
    {
        key: "nt",
        keywords: [
            // English
            "matthew", "mark", "luke", "john", "acts", "romans", "1 corinthians", "2 corinthians", "galatians",
            "ephesians", "philippians", "colossians", "1 thessalonians", "2 thessalonians", "1 timothy", "2 timothy",
            "titus", "philemon", "hebrews", "james", "1 peter", "2 peter", "1 john", "2 john", "3 john", "jude",
            "revelation",
            // Japanese
            "マタイ", "マルコ", "ルカ", "ヨハネ", "使徒", "ローマ", "コリント", "ガラテヤ", "エペソ", "ピリピ",
            "コロサイ", "テサロニケ", "テモテ", "テトス", "ピレモン", "ヘブル", "ヤコブ", "ペテロ", "ユダ", "黙示",
            // Spanish
            "mateo", "marcos", "lucas", "juan", "hechos", "romanos", "corintios", "gálatas", "galatas", "efesios",
            "filipenses", "colosenses", "tesalonicenses", "timoteo", "tito", "filemón", "filemon", "hebreos", "santiago",
            "pedro", "judas", "apocalipsis",
            // Portuguese
            "mateus", "marcos", "lucas", "joão", "joao", "atos", "romanos", "coríntios", "gálatas", "efésios",
            "filipenses", "colossenses", "tessalonicenses", "timóteo", "tito", "filemom", "hebreus", "tiago",
            "pedro", "judas", "apocalipse",
            // Chinese
            "馬太福音", "馬可福音", "路加福音", "約翰福音", "使徒行傳", "羅馬書", "哥林多前書", "哥林多後書",
            "加拉太書", "以弗所書", "腓立比書", "歌羅西書", "帖撒羅尼迦前書", "帖撒羅尼迦後書", "提摩太前書",
            "提摩太後書", "提多書", "腓利門書", "希伯來書", "雅各書", "彼得前書", "彼得後書", "約翰一書",
            "約翰二書", "約翰三書", "猶大書", "啟示錄",
            // Korean
            "마태복음", "마가복음", "누가복음", "요한복음", "사도행전", "로마서", "고린도", "갈라디아", "에베소서",
            "빌립보", "골로새", "데살로니가", "디모데", "디도", "빌레몬", "히브리", "야고보", "베드로", "요한",
            "유다", "요한계시록",
            // Thai
            "มัทธิว", "มาระโก", "ลูกา", "ยอห์น", "กิจการ", "โรม", "โครินธ์", "กาลาเทia", "กาลาเทีย", "เอเฟซัส",
            "ฟิลิปปี", "โคโลสี", "เธสะโลนิกา", "ทิโมธี", "ทิตัส", "ฟีเลโมน", "ฮีบรู", "ยากอบ", "เปโตร", "ยอห์น",
            "ยูดา", "วิวรณ์",
            // Vietnamese
            "ma-thi-ơ", "mác", "lu-ca", "giăng", "công vụ", "rô-ma", "cô-rin-tô", "ga-la-ti", "ê-phê-sô",
            "phi-líp", "cô-lô-se", "tê-sa-lô-ni-ca", "ti-mô-thê", "tít", "phi-lê-môn", "hê-bơ-rơ", "gia-cơ",
            "phi-e-rơ", "giu-đe", "khải huyền",
            // Tagalog
            "mga gawa", "mga taga-roma", "mga taga-corinto", "mga taga-galacia", "mga taga-efeso",
            "mga taga-filipos", "mga taga-colosas", "mga taga-tesalonica",
            // Swahili
            "mathayo", "marko", "luka", "yohana", "matendo", "rumi", "wakorintho", "wagalatia", "waefeso",
            "wafilipi", "wakolosai", "wathesalonike", "timotheo", "tito", "filemoni", "waebrania", "yakobo",
            "petro", "yuda", "ufunuo"
        ]
    },
    {
        key: "pgp",
        keywords: [
            // English
            "moses", "abraham", "joseph smith—history", "joseph smith-history", "joseph smith—matthew", "joseph smith-matthew", "articles of faith",
            // Japanese
            "モーセ", "アブラハム", "ジョセフ・スミス—歴史", "ジョセフ・スミス—マタイ", "信仰箇条",
            // Spanish
            "moisés", "moises", "abrahán", "josé smith—historia", "josé smith—mateo", "artículos de fe",
            // Portuguese
            "abraão", "abraao", "joseph smith—história", "joseph smith—mateus", "regras de fé",
            // Chinese
            "摩西", "亞伯拉罕", "約瑟·斯密——歷史", "約瑟·斯密——馬太", "信條",
            // Korean
            "모세", "아브라함", "조셉 스미스—역사", "조셉 스미스—마태", "신앙개조",
            // Thai
            "โมเสส", "อับราฮัม", "โจเซฟ สมิธ—ประวัติ", "โจเซฟ สมิธ—มัทธิว", "หลักแห่งความเชื่อ",
            // Vietnamese
            "môi se", "áp ra ham", "giô sép smith—lịch sử", "giô sép smith—ma thi ơ", "những tín điều",
            // Tagalog
            "kasaysayan ni joseph smith", "mga saligan ng pananampalataya",
            // Swahili
            "musa", "ibrahimu", "joseph smith—historia", "joseph smith—mathayo", "makala ya imani"
        ]
    }
];

const BOOK_MAPPINGS: Record<string, string> = {
    "1 nephi": "1-ne", "1 néfi": "1-ne", "1 nefi": "1-ne", "1ニーファイ": "1-ne", "第1ニーファイ": "1-ne", "第１ニーファイ": "1-ne", "第一ニーファイ": "1-ne", "ニーファイ第一の書": "1-ne", "ニーファイ第一書": "1-ne", "尼腓一書": "1-ne", "1 นีไฟ": "1-ne", "니파이전서": "1-ne",
    "2 nephi": "2-ne", "2 néfi": "2-ne", "2 nefi": "2-ne", "2ニーファイ": "2-ne", "第2ニーファイ": "2-ne", "第２ニーファイ": "2-ne", "第二ニーファイ": "2-ne", "ニーファイ第二の書": "2-ne", "ニーファイ第二書": "2-ne", "尼腓二書": "2-ne", "2 นีไฟ": "2-ne", "니파이후서": "2-ne",
    "jacob": "jacob", "jacó": "jacob", "gia cốp": "jacob", "ヤコブ書": "jacob", "雅各書": "jacob", "ยาคอบ": "jacob", "야곱서": "jacob",
    "enos": "enos", "enós": "enos", "ê nốt": "enos", "エノス書": "enos", "以挪士書": "enos", "อีนัส": "enos", "이노스서": "enos",
    "jarom": "jarom", "gia rôm": "jarom", "ジェロム書": "jarom", "雅龍書": "jarom", "จารอม": "jarom", "예い롬서": "jarom",
    "omni": "omni", "ômni": "omni", "オムナイ書": "omni", "奧姆奈書": "omni", "ออมไน": "omni", "옴나이서": "omni",
    "words of mormon": "w-of-m", "palavras de mórmon": "w-of-m", "palabras de mormón": "w-of-m", "モルモンの言葉": "w-of-m", "摩爾門語": "w-of-m", "ถ้อยคำของมอรมอน": "w-of-m", "몰몬의 말씀": "w-of-m", "salita ni mormon": "w-of-m",
    "mosiah": "mosiah", "mosías": "mosiah", "mosias": "mosiah", "モーサヤ書": "mosiah", "摩賽亞書": "mosiah", "โมไซยาห์": "mosiah", "모사이야서": "mosiah",
    "alma": "alma", "an ma": "alma", "アルマ書": "alma", "阿爾瑪書": "alma", "แอลมา": "alma", "앨มา서": "alma",
    "helaman": "hel", "hel": "hel", "helamã": "hel", "helamán": "hel", "hê la man": "hel", "ヒラマン書": "hel", "希拉曼書": "hel", "ฮีลามัน": "hel", "힐라맨서": "hel",
    "3 nephi": "3-ne", "3 néfi": "3-ne", "3 nefi": "3-ne", "3ニーファイ": "3-ne", "第3ニーファイ": "3-ne", "第三ニーファイ": "3-ne", "ニーファイ第三の書": "3-ne", "ニーファイ第三書": "3-ne", "尼腓三書": "3-ne", "3 นีไฟ": "3-ne", "제3니파이": "3-ne",
    "4 nephi": "4-ne", "4 néfi": "4-ne", "4 nefi": "4-ne", "4ニーファイ": "4-ne", "第4ニーファイ": "4-ne", "第四ニーファイ": "4-ne", "ニーファイ第四の書": "4-ne", "ニーファイ第四書": "4-ne", "尼腓四書": "4-ne", "4 นีไฟ": "4-ne", "제4니파이": "4-ne",
    "mormon": "morm", "mórmon": "morm", "mormón": "morm", "モルモン書": "morm", "摩爾門書": "morm", "มอรมอน": "morm", "몰몬경": "morm",
    "ether": "eth", "éter": "eth", "エテル書": "eth", "以帖書": "eth", "อีเธอร์": "eth", "이더서": "eth",
    "moroni": "moro", "morôni": "moro", "モロナイ書": "moro", "摩羅乃書": "moro", "โมโรไน": "moro", "모로나이서": "moro",
    "genesis": "gen", "gênesis": "gen", "génesis": "gen", "創世記": "gen", "ปฐมกาล": "gen", "창세기": "gen",
    "exodus": "ex", "êxodo": "ex", "éxodo": "ex", "出エジプト記": "ex", "出エイジプト記": "ex", "อพยพ": "ex", "출애굽기": "ex", "exodo": "ex",
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
    "1 chronicles": "1-chr", "1 crônicas": "1-chr", "1 crónicas": "1-chr", "歴代志上": "1-chr", "歷代志上": "1-chr", "1 พงศาวดาร": "1-chr", "역대상": "1-chr", "1 mga cronica": "1-chr",
    "2 chronicles": "2-chr", "2 crônicas": "2-chr", "2 crónicas": "2-chr", "歴代志下": "2-chr", "歷代志下": "2-chr", "2 พงศาวดาร": "2-chr", "역대하": "2-chr", "2 mga cronica": "2-chr",
    "ezra": "ezra", "esdras": "ezra", "エズラ記": "ezra", "以斯拉記": "ezra", "เอสรา": "ezra", "에스라": "ezra",
    "nehemiah": "neh", "neemias": "neh", "nehemías": "neh", "ネヘミヤ書": "neh", "尼希米記": "neh", "เนหะมีย์": "neh", "느헤미야": "neh", "nehemias": "neh",
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
    "amos": "amos", "amós": "amos", "アモス書": "amos", "阿摩司書": "amos", "อาโมส": "amos", "아모ส": "amos",
    "obadiah": "obad", "obadias": "obad", "abdías": "obad", "オバデヤ書": "obad", "俄巴底亞書": "obad", "โอบาดีห์": "obad", "오바댜": "obad",
    "jonah": "jonah", "jonas": "jonah", "jonás": "jonah", "ヨナ書": "jonah", "約拿書": "jonah", "โยนา": "jonah", "요นา": "jonah",
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
    "1 corinthians": "1-cor", "1 coríntios": "1-cor", "1 corintios": "1-cor", "コリント人への第一の手紙": "1-cor", "コリント人への手紙第一": "1-cor", "哥林多前書": "1-cor", "1 โครินธ์": "1-cor", "고린도전書": "1-cor", "고린도전서": "1-cor", "1 mga taga-corinto": "1-cor",
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
    "abraham": "abr", "abraão": "abr", "abraao": "abr", "áp ra ham": "abr", "アブラハム書": "abr", "亞伯拉罕書": "abr", "อับราฮัม": "abr", "아브ราฮัม서": "abr",
    "joseph smith-matthew": "js-m", "joseph smith matthew": "js-m", "joseph smith—mateus": "js-m", "josé smith—mateo": "js-m", "giô sép smith—ma thi ơ": "js-m", "ジョセフ・スミス—マタイ": "js-m", "約瑟·斯密——馬太": "js-m", "โจเซフ สมิธ—มัทธิว": "js-m", "조셉 スミス—마태": "js-m",
    "joseph smith-history": "js-h", "joseph smith history": "js-h", "joseph smith—história": "js-h", "josé smith—historia": "js-h", "giô sép smith—lịch sử": "js-h", "ジョセフ・スミス—歴史": "js-h", "約瑟·斯密——歷史": "js-h", "โจเซフ สมิธ—ประวัติ": "js-h", "조셉 スミス—역사": "js-h",
    "articles of faith": "a-of-f", "regras de fé": "a-of-f", "artículos de fe": "a-of-f", "những tín điều": "a-of-f", "信仰箇条": "a-of-f", "信條": "a-of-f", "หลักแห่งความเชื่อ": "a-of-f", "신앙개조": "a-of-f",
    "doctrine and covenants": "dc", "教義と聖約": "dc", "doutrina e convênios": "dc", "教義和聖約": "dc", "doctrina y convenios": "dc", "giáo lý và giao ước": "dc", "หลักคำสอนและพันธสัญญา": "dc", "교리와 성약": "dc", "doktrina at mga tipan": "dc", "mafundisho na maagano": "dc", "d&c": "dc", "dc": "dc",
    "od": "od", "公式の宣言": "od", "official declarations": "od"
};

// Helper to detect volume from input
const detectVolume = (volume: string | null | undefined, chapterInput: string | null | undefined): string => {
    const targetVolume = volume ? volume.trim().toLowerCase() : "";
    let volumeUrlPart = "";

    // 1. Check direct matches
    for (const [key, aliases] of Object.entries(VOLUME_MAPPINGS)) {
        if (aliases.includes(targetVolume) || (key === 'dc-testament' && targetVolume.includes('doctrine and'))) {
            volumeUrlPart = key;
            break;
        }
    }

    // 2. Fallback check from chapterInput if volume didn't match
    if (!volumeUrlPart && chapterInput) {
        const lowerChap = chapterInput.toLowerCase();
        for (const fallback of CHAPTER_FALLBACKS) {
            if (fallback.keywords.some(keyword => lowerChap.includes(keyword))) {
                volumeUrlPart = fallback.key;
                break;
            }
        }
    }

    return volumeUrlPart;
};

// 儀式と宣言の判定用のキーワードとスラグのマッピング
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

    const bookName = match[1].trim().toLowerCase().replace(/[.]/g, '').replace(/^第(?=\d)/, '');
    const chapterNum = match[2];
    const verses = match[3];

    let bookUrlPart = BOOK_MAPPINGS[bookName];
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
