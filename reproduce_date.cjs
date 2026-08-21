
const formatDateInTimeZone = (date, timeZone) => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;

    return `${year}-${month}-${day}`;
  } catch (e) {
    console.error(e);
    return 'error';
  }
};

const normalizeDateString = (dateStr) => {
  return dateStr.replace(/[^\d-]/g, '');
};

// Test mismatch
const now = new Date('2026-04-17T03:00:00Z'); // 12:00 PM JST
const tz = 'Asia/Tokyo';

const todayStr = formatDateInTimeZone(now, tz);
const normalizedToday = normalizeDateString(todayStr);

console.log('Today:', todayStr);
console.log('Normalized Today:', normalizedToday);

const activityDate = '2026-04-17';
const normalizedActivity = normalizeDateString(activityDate);

console.log('Match?', normalizedToday === normalizedActivity);

// What if tz is UTC?
const utcToday = formatDateInTimeZone(now, 'UTC');
console.log('UTC Today:', utcToday);
console.log('Match with Activity?', normalizeDateString(utcToday) === normalizedActivity);
