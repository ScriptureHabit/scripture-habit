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
    console.log(`🚀 既存グループの多言語辞書スリム化・最適化処理を開始します`);
    console.log(`⚙️ モード: ${isApply ? '【本番適用モード (APPLY)】' : '【シミュレーション (DRY-RUN)】'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
        const groupsSnapshot = await db.collection('groups').get();
        console.log(`📂 全 ${groupsSnapshot.size} 件のグループドキュメントを取得しました。\n`);

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

            console.log(`📌 [${isAiGroup ? 'AIグループ' : 'デモグループ'}] ${data.name || '名称未設定'} (ID: ${groupId})`);
            console.log(`   言語数: ${langKeys.length}言語 (${langKeys.join(', ')}) ➔ ${preferredLang} のみ保持`);
            console.log(`   削減サイズ: ${oldBytes} bytes ➔ ${newBytes} bytes (-${(savedBytes / 1024).toFixed(2)} KB)\n`);

            if (isApply) {
                batch.update(doc.ref, {
                    translations: newTranslations
                });
                batchOpCount++;

                if (batchOpCount >= 400) {
                    console.log(`📦 バッチコミット中... (${eligibleCount} 件処理済)`);
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
        console.log(`✨ 処理結果サマリー:`);
        console.log(`   最適化対象グループ数: ${eligibleCount} 件`);
        console.log(`   合計削減データ量: ~${(totalBytesSaved / 1024).toFixed(2)} KB (1ドキュメント平均 -${eligibleCount > 0 ? ((totalBytesSaved / eligibleCount) / 1024).toFixed(2) : 0} KB)`);
        if (!isApply) {
            console.log(`\n💡 これは【シミュレーション】です。Firestoreのデータはまだ更新されていません。`);
            console.log(`   実際にデータを更新する場合は、'--apply' オプションをつけて実行してください。`);
        } else {
            console.log(`\n🎉 Firestoreの既存グループデータが正常にスリム化されました！`);
        }
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    } catch (error) {
        console.error('❌ 処理中にエラーが発生しました:', error);
        process.exit(1);
    }
    process.exit(0);
}

optimizeExistingGroups();
