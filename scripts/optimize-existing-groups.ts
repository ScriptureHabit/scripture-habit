if (!process.argv.includes('--emulator')) {
    process.env.FORCE_PRODUCTION = 'true';
}

interface TranslationItem {
    name?: string;
    description?: string;
}

async function optimizeExistingGroups() {
    const { db } = await import('../api_internal/lib/firebase-admin.js');
    const isApply = process.argv.includes('--apply');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🚀 Starting existing group translation dictionary optimization...`);
    console.log(`⚙️ Mode: ${isApply ? '[APPLY MODE]' : '[DRY-RUN SIMULATION]'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
        const groupsSnapshot = await db.collection('groups').get();
        console.log(`📂 Retrieved ${groupsSnapshot.size} total group documents.\n`);

        let eligibleCount = 0;
        let totalBytesSaved = 0;
        let batch = db.batch();
        let batchOpCount = 0;

        // Cache user preferred languages to avoid redundant Firestore reads
        const userLanguageCache = new Map<string, string>();

        for (const doc of groupsSnapshot.docs) {
            const data = doc.data();
            const groupId = doc.id;
            const isAiGroup = Boolean(data.isAiGroup || data.aiCompanionUid === 'ai-partner-bot');
            const isDemoGroup = Boolean(data.isDemoGroup);

            // Only optimize AI groups and Demo groups where multi-language pre-baking occurred
            if (!isAiGroup && !isDemoGroup) {
                continue;
            }

            const translations = data.translations as Record<string, TranslationItem> | undefined;
            if (!translations || typeof translations !== 'object') {
                continue;
            }

            const langKeys = Object.keys(translations);
            if (langKeys.length <= 1) {
                // Already lightweight
                continue;
            }

            // Determine creator/owner's preferred language
            let preferredLang = 'ja';
            const ownerId = data.ownerUserId as string | undefined;

            if (ownerId) {
                if (userLanguageCache.has(ownerId)) {
                    preferredLang = userLanguageCache.get(ownerId)!;
                } else {
                    const userSnap = await db.collection('users').doc(ownerId).get();
                    if (userSnap.exists) {
                        const userData = userSnap.data();
                        const userLang = (userData?.language || userData?.preferredLanguage) as string | undefined;
                        if (userLang && translations[userLang]) {
                            preferredLang = userLang;
                        }
                    }
                    userLanguageCache.set(ownerId, preferredLang);
                }
            }

            // Fallback if preferredLang is not in translations
            if (!translations[preferredLang]) {
                if (translations.ja) preferredLang = 'ja';
                else if (translations.en) preferredLang = 'en';
                else preferredLang = langKeys[0];
            }

            const newTranslations: Record<string, TranslationItem> = {
                [preferredLang]: translations[preferredLang] || {
                    name: data.name || '',
                    description: data.description || ''
                }
            };

            const oldBytes = Buffer.byteLength(JSON.stringify(translations), 'utf8');
            const newBytes = Buffer.byteLength(JSON.stringify(newTranslations), 'utf8');
            const savedBytes = Math.max(0, oldBytes - newBytes);

            totalBytesSaved += savedBytes;
            eligibleCount++;

            console.log(`📌 [${isAiGroup ? 'AI Group' : 'Demo Group'}] ${data.name || 'Untitled'} (ID: ${groupId})`);
            console.log(`   Languages: ${langKeys.length} (${langKeys.join(', ')}) ➔ retaining ${preferredLang} only`);
            console.log(`   Size reduction: ${oldBytes} bytes ➔ ${newBytes} bytes (-${(savedBytes / 1024).toFixed(2)} KB)\n`);

            if (isApply) {
                batch.update(doc.ref, {
                    translations: newTranslations
                });
                batchOpCount++;

                if (batchOpCount >= 400) {
                    console.log(`📦 Committing batch... (${eligibleCount} items processed)`);
                    await batch.commit();
                    batch = db.batch();
                    batchOpCount = 0;
                }
            }
        }

        if (isApply && batchOpCount > 0) {
            await batch.commit();
        }

        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`✨ Execution Summary:`);
        console.log(`   Optimized Groups: ${eligibleCount}`);
        console.log(`   Total Data Saved: ~${(totalBytesSaved / 1024).toFixed(2)} KB (Avg per doc: -${eligibleCount > 0 ? ((totalBytesSaved / eligibleCount) / 1024).toFixed(2) : 0} KB)`);
        if (!isApply) {
            console.log(`\n💡 This was a [DRY-RUN SIMULATION]. No Firestore data was modified.`);
            console.log(`   To apply these changes, rerun with the '--apply' flag.`);
        } else {
            console.log(`\n🎉 Firestore group dictionaries successfully optimized!`);
        }
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    } catch (error) {
        console.error('❌ Error during optimization:', error);
        process.exit(1);
    }
    process.exit(0);
}

optimizeExistingGroups();
