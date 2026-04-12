
const { Timestamp } = require('firebase-admin/firestore');

function toMillis(ts) {
    if (!ts) return 0;
    if (ts && typeof ts === 'object' && 'toMillis' in ts && typeof ts.toMillis === 'function') {
        return ts.toMillis();
    }
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts === 'number') return ts;
    if (typeof ts === 'string') {
        const d = new Date(ts);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    }
    const tsObj = ts;
    if (tsObj.seconds !== undefined) return tsObj.seconds * 1000;
    if (tsObj._seconds !== undefined) return tsObj._seconds * 1000;
    return 0;
}

// Test cases
const tests = [
    { name: 'null', val: null, expected: 0 },
    { name: 'undefined', val: undefined, expected: 0 },
    { name: 'Timestamp Obj', val: Timestamp.now(), expected: 'number' },
    { name: 'Date Obj', val: new Date(), expected: 'number' },
    { name: 'Number', val: 12345678, expected: 12345678 },
    { name: 'ISO String', val: '2026-03-29T13:47:58.103Z', expected: new Date('2026-03-29T13:47:58.103Z').getTime() },
    { name: 'Simple Seconds Obj', val: { seconds: 12345 }, expected: 12345000 },
    { name: 'Internal Seconds Obj', val: { _seconds: 12345 }, expected: 12345000 }
];

tests.forEach(t => {
    const result = toMillis(t.val);
    const pass = typeof t.expected === 'string' ? typeof result === t.expected : result === t.expected;
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${t.name}: result=${result}`);
});
