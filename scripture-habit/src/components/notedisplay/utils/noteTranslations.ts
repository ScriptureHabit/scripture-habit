/**
 * Translation fallbacks for NoteDisplay labels across multiple languages.
 * In a production app, these should ideally be in the main translation files,
 * but this utility ensures they are present even if the main i18n is missing them.
 */

export const getNoteLabelFallback = (key: string, lang: string, originalVal: string) => {
    // If the label is not just the key, it means i18n found a value
    const isEnglishKey = /Category|Chapter|Comment|Scripture|Talk|Speech|Title/.test(originalVal);
    
    // Only apply fallback if the value is missing or defaulted to English in a non-English context
    if (lang !== 'en' && (originalVal === key || isEnglishKey)) {
        const defaults: Record<string, Record<string, string>> = {
            ja: { 
                'noteLabels.scripture': 'カテゴリ', 
                'noteLabels.chapter': '章', 
                'noteLabels.comment': 'コメント', 
                'noteLabels.talk': 'お話', 
                'noteLabels.title': 'タイトル', 
                'noteLabels.speech': 'スピーチ',
                'noteLabels.fetchingInfo': '情報を取得中...',
                'noteLabels.newStudyNote': '新ノート' 
            },
            es: { 'noteLabels.scripture': 'Escritura', 'noteLabels.chapter': 'Capítulo', 'noteLabels.comment': 'Comentario', 'noteLabels.talk': 'Discurso', 'noteLabels.title': 'Título', 'noteLabels.speech': 'Discurso', 'noteLabels.newStudyNote': 'Nueva nota' },
            pt: { 'noteLabels.scripture': 'Escritura', 'noteLabels.chapter': 'Capítulo', 'noteLabels.comment': 'Comentário', 'noteLabels.talk': 'Discurso', 'noteLabels.title': 'Título', 'noteLabels.speech': 'Discurso', 'noteLabels.newStudyNote': 'Nova nota' },
            ko: { 'noteLabels.scripture': '성구', 'noteLabels.chapter': '장', 'noteLabels.comment': '코멘트', 'noteLabels.newStudyNote': '새 노트' },
            zho: { 'noteLabels.scripture': '經文', 'noteLabels.chapter': '章節', 'noteLabels.comment': '評論', 'noteLabels.newStudyNote': '新筆記' },
            tl: { 'noteLabels.scripture': 'Banal na Kasulatan', 'noteLabels.chapter': 'Kabanata', 'noteLabels.comment': 'Komento', 'noteLabels.newStudyNote': 'Bagong Tala' },
            vi: { 'noteLabels.scripture': 'Thánh thư', 'noteLabels.chapter': 'Chương', 'noteLabels.comment': 'Nhận xét', 'noteLabels.newStudyNote': 'Ghi chú mới' },
            sw: { 'noteLabels.scripture': 'Andiko', 'noteLabels.chapter': 'Sura', 'noteLabels.comment': 'Maoni', 'noteLabels.newStudyNote': 'Dokezo Jipya' },
            th: { 'noteLabels.scripture': 'พระคัมภีร์', 'noteLabels.chapter': 'บท', 'noteLabels.comment': 'ความคิดเห็น', 'noteLabels.newStudyNote': 'โน้ตใหม่' }
        };
        return defaults[lang]?.[key] || originalVal;
    }
    return originalVal;
};

export const translateScriptureName = (name: string, t: (key: string) => string): string => {
    if (!name) return '';
    const map: Record<string, string> = {
        'Old Testament': 'scriptures.oldTestament',
        'New Testament': 'scriptures.newTestament',
        'Book of Mormon': 'scriptures.bookOfMormon',
        'Doctrine and Covenants': 'scriptures.doctrineAndCovenants',
        'Pearl of Great Price': 'scriptures.pearlOfGreatPrice',
        'Ordinances and Proclamations': 'scriptures.ordinancesAndProclamations',
        'General Conference': 'scriptures.generalConference',
        'BYU Speeches': 'scriptures.byuSpeeches',
        'Other': 'scriptures.other',
        'その他': 'scriptures.other'
    };
    const key = map[name];
    return key ? t(key) : name;
};
