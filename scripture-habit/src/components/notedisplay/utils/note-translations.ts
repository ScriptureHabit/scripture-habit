/**
 * Translation fallbacks for NoteDisplay labels across multiple languages.
 * In a production app, these should ideally be in the main translation files,
 * but this utility ensures they are present even if the main i18n is missing them.
 */

import { SCRIPTURE_TRANSLATION_MAP } from '../../../data/data';

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
                'noteLabels.fetchingInfo': '情報を取得中...'
            },
            es: { 'noteLabels.scripture': 'Escritura', 'noteLabels.chapter': 'Capítulo', 'noteLabels.comment': 'Comentario', 'noteLabels.talk': 'Discurso', 'noteLabels.title': 'Título', 'noteLabels.speech': 'Discurso' },
            pt: { 'noteLabels.scripture': 'Escritura', 'noteLabels.chapter': 'Capítulo', 'noteLabels.comment': 'Comentário', 'noteLabels.talk': 'Discurso', 'noteLabels.title': 'Título', 'noteLabels.speech': 'Discurso' },
            ko: { 'noteLabels.scripture': '성구', 'noteLabels.chapter': '장', 'noteLabels.comment': '코멘트' },
            zho: { 'noteLabels.scripture': '經文', 'noteLabels.chapter': '章節', 'noteLabels.comment': '評論' },
            tl: { 'noteLabels.scripture': 'Banal na Kasulatan', 'noteLabels.chapter': 'Kabanata', 'noteLabels.comment': 'Komento' },
            vi: { 'noteLabels.scripture': 'Thánh thư', 'noteLabels.chapter': 'Chương', 'noteLabels.comment': 'Nhận xét' },
            sw: { 'noteLabels.scripture': 'Andiko', 'noteLabels.chapter': 'Sura', 'noteLabels.comment': 'Maoni' },
            th: { 'noteLabels.scripture': 'พระคัมภีร์', 'noteLabels.chapter': 'บท', 'noteLabels.comment': 'ความคิดเห็น' }
        };
        return defaults[lang]?.[key] || originalVal;
    }
    return originalVal;
};

export const translateScriptureName = (name: string, t: (key: string) => string): string => {
    if (!name) return '';
    const map: Record<string, string> = {
        // English (Shared config)
        ...SCRIPTURE_TRANSLATION_MAP,
        // Japanese
        '旧約聖書': 'scriptures.oldTestament',
        '新約聖書': 'scriptures.newTestament',
        'モルモン書': 'scriptures.bookOfMormon',
        '教義と聖約': 'scriptures.doctrineAndCovenants',
        '高価な真珠': 'scriptures.pearlOfGreatPrice',
        '儀式と宣言': 'scriptures.ordinancesAndProclamations',
        '総大会': 'scriptures.generalConference',
        'その他': 'scriptures.other',
        // Spanish
        'Antiguo Testamento': 'scriptures.oldTestament',
        'Nuevo Testamento': 'scriptures.newTestament',
        'El Libro de Mormón': 'scriptures.bookOfMormon',
        'Doctrina y Convenios': 'scriptures.doctrineAndCovenants',
        'La Perla de Gran Precio': 'scriptures.pearlOfGreatPrice',
        'Ordenanzas y Declaraciones': 'scriptures.ordinancesAndProclamations',
        'Conferencia General': 'scriptures.generalConference',
        'Otros': 'scriptures.other',
        // Portuguese
        'Velho Testamento': 'scriptures.oldTestament',
        'Novo Testamento': 'scriptures.newTestament',
        'O Livro de Mórmon': 'scriptures.bookOfMormon',
        'Doutrina e Convênios': 'scriptures.doctrineAndCovenants',
        'Pérola de Grande Valor': 'scriptures.pearlOfGreatPrice',
        'Ordenanças e Declarações': 'scriptures.ordinancesAndProclamations',
        'Conferência Geral': 'scriptures.generalConference',
        'Outros': 'scriptures.other',
        // Korean
        '구약전서': 'scriptures.oldTestament',
        '신약전서': 'scriptures.newTestament',
        '몰몬경': 'scriptures.bookOfMormon',
        '교리와 성약': 'scriptures.doctrineAndCovenants',
        '값진 진주': 'scriptures.pearlOfGreatPrice',
        '의식 및 선언': 'scriptures.ordinancesAndProclamations',
        '연차 대회': 'scriptures.generalConference',
        '기타': 'scriptures.other',
        // Chinese
        '舊約': 'scriptures.oldTestament',
        '新約': 'scriptures.newTestament',
        '摩爾門經': 'scriptures.bookOfMormon',
        '教義和聖約': 'scriptures.doctrineAndCovenants',
        '無價珍珠': 'scriptures.pearlOfGreatPrice',
        '儀式與宣言': 'scriptures.ordinancesAndProclamations',
        '總會大會': 'scriptures.generalConference',
        '其他': 'scriptures.other',
        // Vietnamese
        'Cựu Ước': 'scriptures.oldTestament',
        'Tân Ước': 'scriptures.newTestament',
        'Sách Mặc Môn': 'scriptures.bookOfMormon',
        'Giáo Lý và Giao Ước': 'scriptures.doctrineAndCovenants',
        'Trân Châu Vô Giá': 'scriptures.pearlOfGreatPrice',
        'Các Giáo Lễ và Tuyên Ngôn': 'scriptures.ordinancesAndProclamations',
        'Đại Hội Trung Ương': 'scriptures.generalConference',
        'Khác': 'scriptures.other',
        // Thai
        'พันธสัญญาเดิม': 'scriptures.oldTestament',
        'พันธสัญญาใหม่': 'scriptures.newTestament',
        'พระคัมภีร์มอรมอน': 'scriptures.bookOfMormon',
        'หลักคำสอนและพันธสัญญา': 'scriptures.doctrineAndCovenants',
        'ไข่มุกอันล้ำค่า': 'scriptures.pearlOfGreatPrice',
        'พิธีการและถ้อยแถลง': 'scriptures.ordinancesAndProclamations',
        'การประชุมใหญ่สามัญ': 'scriptures.generalConference',
        'อื่นๆ': 'scriptures.other',
        // Tagalog
        'Lumang Tipan': 'scriptures.oldTestament',
        'Bagong Tipan': 'scriptures.newTestament',
        'Aklat ni Mormon': 'scriptures.bookOfMormon',
        'Doktrina at mga Tipan': 'scriptures.doctrineAndCovenants',
        'Mahalagang Perlas': 'scriptures.pearlOfGreatPrice',
        'Mga Ordenansa at Pagpapahayag': 'scriptures.ordinancesAndProclamations',
        'Pangkalahatang Kumperensya': 'scriptures.generalConference',
        'Mga Talumpati sa BYU': 'scriptures.byuSpeeches',
        'Iba pa': 'scriptures.other',
        // Swahili
        'Agano la Kale': 'scriptures.oldTestament',
        'Agano Jipya': 'scriptures.newTestament',
        'Kitabu cha Mormoni': 'scriptures.bookOfMormon',
        'Mafundisho na Maagano': 'scriptures.doctrineAndCovenants',
        'Lulu ya Thamani Kuu': 'scriptures.pearlOfGreatPrice',
        'Ibada na Matangazo': 'scriptures.ordinancesAndProclamations',
        'Mkutano Mkuu': 'scriptures.generalConference',
        'Nyingine': 'scriptures.other',
    };
    const key = map[name];
    return key ? t(key) : name;
};

/**
 * Checks if a value is a placeholder that should be hidden (e.g., "(未分類)", "-", "Unclassified").
 */
export const isPlaceholderValue = (value: string | undefined): boolean => {
    if (!value) return true;
    const v = value.trim();
    if (!v || v === '-' || v === 'ー') return true;
    
    const placeholders = [
        // English
        '(unclassified)', 'unclassified', 'uncategorized', 'none', 'n/a', 'unknown', 'other', '(other)',
        // Japanese
        '(未分類)', '未分類', '(なし)', 'なし', 'その他', '(その他)',
        // Spanish
        '(sin clasificar)', 'sin clasificar', 'ninguno', 'otros', '(otros)',
        // Portuguese
        '(sem classificação)', 'sem classificação', 'nenhum', 'outros', '(outros)',
        // Korean
        '(미분류)', '미분류', '(없음)', '없음', '기타', '(기타)',
        // Chinese
        '(未分類)', '未分類', '(無)', '無', '其他', '(其他)',
        // Vietnamese
        '(chưa phân loại)', 'chưa phân loại', 'không có', 'khác', '(khác)',
        // Tagalog
        '(hindi nakategorya)', 'hindi nakategorya', 'wala', 'iba pa', '(iba pa)',
        // Swahili
        '(isiyoainishwa)', 'isiyoainishwa', 'hakuna', 'nyingine', '(nyingine)',
        // Thai
        '(ไม่ได้จัดหมวดหมู่)', 'ไม่ได้จัดหมวดหมู่', 'ไม่มี', 'อื่นๆ', '(อื่นๆ)'
    ];
    
    return placeholders.includes(v.toLowerCase());
};
