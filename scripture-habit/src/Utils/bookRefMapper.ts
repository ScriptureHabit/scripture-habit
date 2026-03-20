/**
 * Cross-language book name identification.
 * This map allows identifying a book name regardless of which language it was written in.
 */

// Japanese to English Book Map (Partial, common ones first)
export const BOOK_IDENTITY_MAP: Record<string, string> = {
    // Book of Mormon
    "ニーファイ第一書": "1 Nephi",
    "第1ニーファイ": "1 Nephi",
    "第１ニーファイ": "1 Nephi",
    "第一ニーファイ": "1 Nephi",
    "ニーファイ第二書": "2 Nephi",
    "第2ニーファイ": "2 Nephi",
    "第２ニーファイ": "2 Nephi",
    "第二ニーファイ": "2 Nephi",
    "ヤコブ書": "Jacob",
    "エノス書": "Enos",
    "ジェロム書": "Jarom",
    "オムナイ書": "Omni",
    "モルモンの言葉": "Words of Mormon",
    "モーサヤ書": "Mosiah",
    "アルマ書": "Alma",
    "ヒラマン書": "Helaman",
    "第三ニーファイ": "3 Nephi",
    "第3ニーファイ": "3 Nephi",
    "第３ニーファイ": "3 Nephi",
    "第四ニーファイ": "4 Nephi",
    "第4ニーファイ": "4 Nephi",
    "第４ニーファイ": "4 Nephi",
    "モルモン書": "Mormon",
    "エテル書": "Ether",
    "モロナイ書": "Moroni",
    // Old Testament
    "創世記": "Genesis",
    "出エジプト記": "Exodus",
    "レビ記": "Leviticus",
    "民数記": "Numbers",
    "申命記": "Deuteronomy",
    "ヨシュア記": "Joshua",
    "士師記": "Judges",
    "ルツ記": "Ruth",
    "サムエル記上": "1 Samuel",
    "サムエル記下": "2 Samuel",
    "列王記上": "1 Kings",
    "列王記下": "2 Kings",
    "歴代誌上": "1 Chronicles",
    "歴代誌下": "2 Chronicles",
    "エズラ記": "Ezra",
    "ネヘミヤ記": "Nehemiah",
    "エステル記": "Esther",
    "ヨブ記": "Job",
    "詩篇": "Psalms",
    "箴言": "Proverbs",
    "伝道の書": "Ecclesiastes",
    "雅歌": "Song of Solomon",
    "イザヤ書": "Isaiah",
    "エレミヤ書": "Jeremiah",
    "哀歌": "Lamentations",
    "エゼキエル書": "Ezekiel",
    "ダニエル書": "Daniel",
    "ホセア書": "Hosea",
    "ヨエル書": "Joel",
    "アモス書": "Amos",
    "オバデヤ書": "Obadiah",
    "ヨナ書": "Jonah",
    "ミカ書": "Micah",
    "ナホム書": "Nahum",
    "ハバクク書": "Habakkuk",
    "ゼパニヤ書": "Zephaniah",
    "ハガイ書": "Haggai",
    "ゼカリヤ書": "Zechariah",
    "マラキ書": "Malachi",
    // New Testament
    "マタイによる福音書": "Matthew",
    "マルコによる福音書": "Mark",
    "ルカによる福音書": "Luke",
    "ヨハネによる福音書": "John",
    "使徒行伝": "Acts",
    "ローマ人への手紙": "Romans",
    "コリント人への第一の手紙": "1 Corinthians",
    "コリント人への第二の手紙": "2 Corinthians",
    "ガラテヤ人への手紙": "Galatians",
    "エペソ人への手紙": "Ephesians",
    "ピリピ人への手紙": "Philippians",
    "コロサイ人への手紙": "Colossians",
    "テサロニケ人への第一の手紙": "1 Thessalonians",
    "テサロニケ人への第二の手紙": "2 Thessalonians",
    "テモテへの第一の手紙": "1 Timothy",
    "テモテへの第二の手紙": "2 Timothy",
    "テトスへの手紙": "Titus",
    "ヘブル人への手紙": "Hebrews",
    "ヤコブの手紙": "James",
    "ペテロの第一の手紙": "1 Peter",
    "ペテロの第二の手紙": "2 Peter",
    "ヨハネの第一の手紙": "1 John",
    "ヨハネの第二の手紙": "2 John",
    "ヨハネの第三の手紙": "3 John",
    "ユダの手紙": "Jude",
    "ヨハネの黙示録": "Revelation",
    // Pearl of Great Price
    "モーセ書": "Moses",
    "アブラハム書": "Abraham",
    "ジョセフ・スミス—マタイ": "Joseph Smith-Matthew",
    "ジョセフ・スミス—歴史": "Joseph Smith-History",
    "信仰箇条": "Articles of Faith",
    // Doctrine and Covenants
    "教義と聖約": "Doctrine and Covenants",

    // Chinese (Partial, for common ones)
    "尼腓一書": "1 Nephi",
    "尼腓二書": "2 Nephi",
    "雅各書": "Jacob",
    "摩賽亞書": "Mosiah",
    "阿爾瑪書": "Alma",
    "摩爾門書": "Mormon",
    "馬太福音": "Matthew",
    "使徒行傳": "Acts",
    "教義和聖約": "Doctrine and Covenants",
};

/**
 * Normalizes any book name to its English key if possible.
 */
export const identifyBookKey = (bookName: string): string => {
    // 1. Try common identity map
    const mapped = BOOK_IDENTITY_MAP[bookName];
    if (mapped) return mapped;

    // 2. Try case-insensitive comparison (for English/etc)
    // (In a full implementation, we could loop over all translations, but identity map covers most issues)
    
    return bookName;
};
