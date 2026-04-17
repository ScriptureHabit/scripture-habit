
function formatDateInTimeZone(date, timeZone) {
  try {
    return date.toLocaleDateString('sv-SE', { timeZone });
  } catch (e) {
    return date.toISOString().split('T')[0]; // Fallback to UTC
  }
}

const d = new Date('2026-04-17T23:59:50Z');
console.log('UTC:', formatDateInTimeZone(d, 'UTC'));
console.log('Tokyo:', formatDateInTimeZone(d, 'Asia/Tokyo'));
console.log('NY:', formatDateInTimeZone(d, 'America/New_York'));
