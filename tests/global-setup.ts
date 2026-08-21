async function globalSetup() {
  console.log('🧹 Wiping emulator databases globally before test suite starts...');
  try {
    const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
    const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

    // 1. Clear Firestore
    await fetch(`http://${firestoreHost}/emulator/v1/projects/scripture-habit-auth/databases/(default)/documents`, {
      method: 'DELETE'
    });
    console.log('🗑️ Firestore emulator wiped successfully.');

    // 2. Clear Auth
    await fetch(`http://${authHost}/emulator/v1/projects/scripture-habit-auth/accounts`, {
      method: 'DELETE'
    });
    console.log('🗑️ Auth emulator wiped successfully.');
  } catch (err) {
    console.warn('⚠️ Emulator wipe failed or bypassed:', err);
  }
}

export default globalSetup;
