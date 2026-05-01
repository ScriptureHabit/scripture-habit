import { db } from '../api_internal/lib/firebase-admin.js';

async function test() {
    console.log('Testing Firestore connectivity...');
    const start = Date.now();
    try {
        const testRef = db.collection('test_connectivity').doc('check');
        await testRef.set({ lastCheck: new Date() });
        console.log('Write successful in', Date.now() - start, 'ms');
        const snap = await testRef.get();
        console.log('Read successful. Data:', snap.data());
    } catch (e) {
        console.error('Firestore test failed:', e);
    }
    process.exit(0);
}

test();
