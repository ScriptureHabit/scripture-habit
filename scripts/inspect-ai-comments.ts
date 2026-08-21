import { AI_DAILY_COMMENTS } from '../api_internal/data/ai-daily-comments-2026.js';

const keys = Object.keys(AI_DAILY_COMMENTS);
console.log('Total entries:', keys.length);
console.log('First date:', keys[0], 'Last date:', keys[keys.length - 1]);
if (keys.length > 0) {
    const sample = AI_DAILY_COMMENTS[keys[0]];
    console.log('Languages in comment:', Object.keys(sample.comment));
    console.log('Languages in chapter:', Object.keys(sample.chapter));
    console.log('Languages in scripture:', Object.keys(sample.scripture));
}

const chapterList: { date: string; scripture: string; chapter: string; commentJa: string }[] = [];
for (const k of keys) {
    const entry = AI_DAILY_COMMENTS[k];
    chapterList.push({
        date: k,
        scripture: entry.scripture.ja,
        chapter: entry.chapter.ja,
        commentJa: entry.comment.ja.replace(/\n/g, ' / ')
    });
}
console.log('Sample 10 items:');
console.log(chapterList.slice(0, 10));
console.log('Job items (around Aug 2026):');
console.log(chapterList.filter(c => c.chapter.includes('ヨブ')));

