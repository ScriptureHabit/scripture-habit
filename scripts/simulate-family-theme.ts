import { db, admin } from '../api_internal/lib/firebase-admin.js';
import { FAMILY_THEMES, FamilyThemeId } from '../src/types/family-theme.js';

const VALID_THEMES: FamilyThemeId[] = [
    'faith',
    'hope',
    'charity',
    'gratitude',
    'prayer',
    'patience',
    'repentance',
    'guidance'
];

const THEME_NAMES_JA: Record<FamilyThemeId, string> = {
    faith: '信仰',
    hope: '希望',
    charity: '慈愛',
    gratitude: '感謝',
    prayer: '祈り',
    patience: '忍耐',
    repentance: '悔い改め',
    guidance: '導き'
};

async function main() {
    const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
    if (!firestoreHost) {
        console.error('❌ Error: FIRESTORE_EMULATOR_HOST is not set. Run with Firebase Emulator running.');
        process.exit(1);
    }

    const arg = (process.argv[2] || 'charity').toLowerCase();
    const familyGroupId = 'seed-group-together-in-faith';
    const partnerUid = 'seeder-partner';

    const groupRef = db.collection('groups').doc(familyGroupId);
    const groupSnap = await groupRef.get();

    if (!groupSnap.exists) {
        console.error(`❌ Error: Group "${familyGroupId}" does not exist.`);
        console.log('👉 Please run `npm run db:seed:existing` first to create the test environment.');
        process.exit(1);
    }

    const groupData = groupSnap.data();
    const todayStr = new Date().toLocaleDateString('sv-SE');

    if (arg === 'reset' || arg === 'clear') {
        // Reset session to completely empty for today
        await groupRef.update({
            familyThemeSession: {
                date: todayStr,
                selections: {}
            }
        });
        console.log('\n==================================================');
        console.log('🧹 [Family Sync Simulator] Session Reset');
        console.log('--------------------------------------------------');
        console.log('Today session is now empty (neither user nor partner has selected a theme).');
        console.log('👉 Open your browser to test the initial state!');
        console.log('==================================================\n');
        return;
    }

    if (!VALID_THEMES.includes(arg as FamilyThemeId)) {
        console.error(`❌ Invalid theme: "${arg}"`);
        console.log(`Available themes: ${VALID_THEMES.join(', ')}`);
        console.log('Or use "reset" to clear today\'s session.');
        process.exit(1);
    }

    const selectedTheme = arg as FamilyThemeId;
    const themeMeta = FAMILY_THEMES.find(t => t.id === selectedTheme);

    const currentSession = groupData?.familyThemeSession || {};
    const currentSelections = (currentSession.date === todayStr ? currentSession.selections : {}) || {};

    // Update partner selection, clear matchedTheme if setting partner to another theme
    const newSelections = {
        ...currentSelections,
        [partnerUid]: selectedTheme
    };

    const updatePayload: Record<string, unknown> = {
        'familyThemeSession.date': todayStr,
        'familyThemeSession.selections': newSelections
    };

    // If there was already a match, remove it so the user can test matching anew
    if (currentSession.matchedTheme) {
        updatePayload['familyThemeSession.matchedTheme'] = admin.firestore.FieldValue.delete();
        updatePayload['familyThemeSession.completedAt'] = admin.firestore.FieldValue.delete();
    }

    await groupRef.update(updatePayload);

    const themeLabel = THEME_NAMES_JA[selectedTheme];

    console.log('\n==================================================');
    console.log('🌸 [Family Sync Simulator] Partner Selection Updated');
    console.log('--------------------------------------------------');
    console.log(`Group:   Together in Faith 🌿 (${familyGroupId})`);
    console.log(`Partner: Partner 🌸 (${partnerUid})`);
    console.log(`Theme:   ✨ ${themeMeta?.icon || ''} 【${themeLabel}】 (${selectedTheme}) ✨`);
    console.log('--------------------------------------------------');
    console.log('Status:  Partner is now waiting in the dashboard!');
    console.log('👉 Open Dashboard in browser -> FamilyThemeCard should show "Partner ready"');
    console.log(`👉 Select "${themeLabel}" to test SUCCESS (Confetti & Unity)`);
    console.log('👉 Select a different theme to test MISMATCH warning');
    console.log('==================================================\n');
}

main().catch(err => {
    console.error('❌ Error executing simulator:', err);
    process.exit(1);
});
