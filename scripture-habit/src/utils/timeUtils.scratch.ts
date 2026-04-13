import { formatDateInTimeZone, normalizeDateString } from './timeUtils';

const test = () => {
    const now = new Date('2026-04-13T12:00:00Z');
    
    const tz1 = 'Asia/Tokyo';
    const d1 = formatDateInTimeZone(now, tz1);
    console.log(`Tokyo: ${d1} -> ${normalizeDateString(d1)}`);
    
    const tz2 = 'America/New_York';
    const d2 = formatDateInTimeZone(now, tz2);
    console.log(`New York: ${d2} -> ${normalizeDateString(d2)}`);
    
    const tz3 = 'UTC';
    const d3 = formatDateInTimeZone(now, tz3);
    console.log(`UTC: ${d3} -> ${normalizeDateString(d3)}`);

    // Simulate potential hidden chars
    const dirtyDate = '\u200E2026-04-13';
    console.log(`Dirty: ${dirtyDate} -> ${normalizeDateString(dirtyDate)}`);
};

test();
