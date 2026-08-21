
export const volumeBooks: Record<string, string[]> = {
    "Book of Mormon": [
        "1 Nephi", "2 Nephi", "Jacob", "Enos", "Jarom", "Omni", "Words of Mormon",
        "Mosiah", "Alma", "Helaman", "3 Nephi", "4 Nephi", "Mormon", "Ether", "Moroni"
    ],
    "Old Testament": [
        "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth",
        "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra",
        "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon",
        "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
        "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi"
    ],
    "New Testament": [
        "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians",
        "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
        "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter",
        "1 John", "2 John", "3 John", "Jude", "Revelation"
    ],
    "Pearl of Great Price": [
        "Moses", "Abraham", "Joseph Smith-Matthew", "Joseph Smith-History", "Articles of Faith"
    ],
    "Ordinances and Proclamations": [
        "The Family: A Proclamation to the World",
        "The Living Christ",
        "The Restoration of the Fulness of the Gospel of Jesus Christ: A Bicentennial Proclamation to the World"
    ],
    "Doctrine and Covenants": [
        "D&C"
    ]
};

const KANJI_BOOK_READINGS: Record<string, string> = {
    // Old Testament
    "創世記": "ソウセイキ",
    "出エジプト記": "シュツエジプトキ",
    "レビ記": "レビキ",
    "民数記": "ミンスウキ",
    "申命記": "シンメイキ",
    "ヨシュア記": "ヨシュアキ",
    "士師記": "シシキ",
    "ルツ記": "ルツキ",
    "サムエル記上": "サムエルキジョウ",
    "サムエル記下": "サムエルキゲ",
    "列王記上": "レツオウキジョウ",
    "列王記下": "レツオウキゲ",
    "歴代志上": "レキダイシジョウ",
    "歴代志下": "レキダイシゲ",
    "エズラ記": "エズラキ",
    "ネヘミヤ書": "ネヘミヤショ",
    "エステル記": "エステルキ",
    "ヨブ記": "ヨブキ",
    "詩篇": "シヘン",
    "箴言": "シンゲン",
    "伝道の書": "デンドウノショ",
    "雅歌": "ガカ",
    "イザヤ書": "イザヤショ",
    "エレミヤ書": "エレミヤショ",
    "哀歌": "アイカ",
    "エゼキエル書": "エゼキエルショ",
    "ダニエル書": "ダニエルショ",
    "ホセア書": "ホセアショ",
    "ヨエル書": "ヨエルショ",
    "アモス書": "アモスショ",
    "オバデヤ書": "オバデヤショ",
    "ヨナ書": "ヨナショ",
    "ミカ書": "ミカショ",
    "ナホム書": "ナホムショ",
    "ハバクク書": "ハバククショ",
    "ゼパニヤ書": "ゼパニヤショ",
    "ハガイ書": "ハガイショ",
    "ゼカリヤ書": "ゼカリヤショ",
    "マラキ書": "マラキショ",

    // New Testament
    "マタイによる福音書": "マタイニヨルフクインショ",
    "マルコによる福音書": "マルコニヨルフクインショ",
    "ルカによる福音書": "ルカニヨルフクインショ",
    "ヨハネによる福音書": "ヨハネニヨルフクインショ",
    "使徒行伝": "シトギョウデン",
    "ローマ人への手紙": "ローマジンヘノテガミ",
    "コリント人への第一の手紙": "コリントジンヘノダイイチノテガミ",
    "コリント人への第二の手紙": "コリントジンヘノダイニノテガミ",
    "ガラテヤ人への手紙": "ガラテヤジンヘノテガミ",
    "エペソ人への手紙": "エペソジンヘノテガミ",
    "ピリピ人への手紙": "ピリピジンヘノテガミ",
    "コロサイ人への手紙": "コロサイジンヘノテガミ",
    "テサロニケ人への第一の手紙": "テサロニケジンヘノダイイチノテガミ",
    "テサロニケ人への第二の手紙": "テサロニケジンヘノダイニノテガミ",
    "テモテへの第一の手紙": "テモテヘノダイイチノテガミ",
    "テモテへの第二の手紙": "テモテヘノダイニノテガミ",
    "テトスへの手紙": "テトスヘノテガミ",
    "フィレモンへの手紙": "フィレモンヘノテガミ",
    "ヘブル人への手紙": "ヘブルジンヘノテガミ",
    "ヤコブの手紙": "ヤコブノテガミ",
    "ペテロの第一の手紙": "ペテロノダイイチノテガミ",
    "ペテロの第二の手紙": "ペテロノダイニノテガミ",
    "ヨハネの第一の手紙": "ヨハネノダイイチノテガミ",
    "ヨハネの第二の手紙": "ヨハネノダイニノテガミ",
    "ヨハネの第三の手紙": "ヨハネノダイサンノテガミ",
    "ユダの手紙": "ユダノテガミ",
    "ヨハネの黙示録": "ヨハネノモクシロク",

    // Book of Mormon
    "ニーファイ第一書": "ニーファイダイイチショ",
    "ニーファイ第二書": "ニーファイダイニショ",
    "ヤコブ書": "ヤコブショ",
    "エノス書": "エノスショ",
    "ジェロム書": "ジェロムショ",
    "オムナイ書": "オムナイショ",
    "モルモンの言葉": "モルモンノコトバ",
    "モーサヤ書": "モーサヤショ",
    "アルマ書": "アルマショ",
    "ヒラマン書": "ヒラマンショ",
    "第三ニーファイ": "ダイサンニーファイ",
    "第四ニーファイ": "ダイヨンニーファイ",
    "モルモン書": "モルモンショ",
    "エテル書": "エテルショ",
    "モロナイ書": "モロナイショ",

    // Pearl of Great Price
    "モーセ書": "モーセショ",
    "アブラハム書": "アブラハムショ",
    "ジョセフ・スミス—マタイ": "ジョセフスミスマタイ",
    "ジョセフ・スミス—歴史": "ジョセフスミスレキシ",
    "信仰箇条": "シンコウカジョウ",

    // Doctrine and Covenants
    "教義と聖約": "キョウギトセイヤク",

    // Ordinances and Proclamations
    "聖餐の祈り": "セイサンノイノリ",
    "バプテスマの儀式": "バプテスマノギシキ",
    "生けるキリスト": "イケルキリスト",
    "家族の宣言": "カゾクノセンゲン",
    "回復の宣言": "カイフクノセンゲン"
};

export interface BookSuggestion {
    english: string;
    translated: string;
    normalizedTranslated: string;
    normalizedEnglish: string;
    reading?: string;
}

export const getBookSuggestions = (
    volume: string | null | undefined,
    input: string | null | undefined,
    language: string,
    currentLanguageBooks: Record<string, string>
): BookSuggestion[] => {
    if (!volume || !input || !currentLanguageBooks) return [];

    const volumeList = volumeBooks[volume];
    if (!volumeList) return [];

    const normalize = (str: string | null | undefined): string => {
        if (!str) return '';
        // 1. Lowercase and NFKC
        let res = str.toLowerCase().normalize('NFKC');
        // 2. Strip combining diacritical marks (accents) for Latin/European languages
        res = res.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        // 3. Hiragana to Katakana if Japanese
        if (language === 'ja') {
            res = res.replace(/[\u3041-\u3096]/g, m => String.fromCharCode(m.charCodeAt(0) + 0x60));
        }
        // 4. Recompose to NFC (especially important for Japanese dakuten/handakuten after NFD)
        return res.normalize('NFC');
    };

    const normalizedInput = normalize(input);
    if (!normalizedInput) return [];

    const translatedList = volumeList.map(englishName => {
        const translatedName = currentLanguageBooks[englishName] || englishName;
        const normalizedTranslated = normalize(translatedName);
        let reading = '';
        if (language === 'ja') {
            reading = KANJI_BOOK_READINGS[translatedName] || '';
        }
        return {
            english: englishName,
            translated: translatedName,
            normalizedTranslated,
            normalizedEnglish: normalize(englishName),
            reading
        };
    });

    return translatedList
        .filter(book =>
            book.normalizedTranslated.includes(normalizedInput) ||
            book.normalizedEnglish.includes(normalizedInput) ||
            (book.reading && book.reading.includes(normalizedInput))
        )
        .sort((a, b) => {
            // Priority 1: Exact match (normalized)
            const aExact = a.normalizedTranslated === normalizedInput || (a.reading && a.reading === normalizedInput);
            const bExact = b.normalizedTranslated === normalizedInput || (b.reading && b.reading === normalizedInput);
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;

            // Priority 2: Starts with input (translated or reading)
            const aStartsT = a.normalizedTranslated.startsWith(normalizedInput) || (a.reading && a.reading.startsWith(normalizedInput));
            const bStartsT = b.normalizedTranslated.startsWith(normalizedInput) || (b.reading && b.reading.startsWith(normalizedInput));
            if (aStartsT && !bStartsT) return -1;
            if (!aStartsT && bStartsT) return 1;

            // Priority 3: Starts with input (english)
            const aStartsE = a.normalizedEnglish.startsWith(normalizedInput);
            const bStartsE = b.normalizedEnglish.startsWith(normalizedInput);
            if (aStartsE && !bStartsE) return -1;
            if (!aStartsE && bStartsE) return 1;

            // Priority 4: Shorter string first
            return a.translated.length - b.translated.length;
        })
        .slice(0, 10);
};
