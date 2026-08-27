if (!process.argv.includes('--emulator')) {
    process.env.FORCE_PRODUCTION = 'true';
}

async function migrateDeprecatePublicGroups() {
    const { db } = await import('../api_internal/lib/firebase-admin.js');
    const isApply = process.argv.includes('--apply');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 パブリックグループ廃止に伴うデータマイグレーションを開始します');
    console.log(`⚙️ モード: ${isApply ? '【本番適用モード (APPLY)】' : '【シミュレーション (DRY-RUN)】'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
        const groupsSnapshot = await db.collection('groups').get();
        console.log(`📂 全 ${groupsSnapshot.size} 件のグループドキュメントを取得しました。\n`);

        let modifiedCount = 0;
        let batch = db.batch();
        let batchOpCount = 0;

        for (const doc of groupsSnapshot.docs) {
            const data = doc.data();
            const groupId = doc.id;
            const isPublic = Boolean(data.isPublic);

            if (isPublic) {
                modifiedCount++;
                console.log(`🔒 [対象グループ] ID: ${groupId}, Name: "${data.name || '名称未設定'}" -> isPublic: false に更新`);

                if (isApply) {
                    batch.update(doc.ref, {
                        isPublic: false,
                        isPrivate: true
                    });
                    batchOpCount++;

                    if (batchOpCount >= 400) {
                        await batch.commit();
                        batch = db.batch();
                        batchOpCount = 0;
                    }
                }
            }
        }

        if (isApply && batchOpCount > 0) {
            await batch.commit();
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`✅ 処理完了`);
        console.log(`📊 対象グループ数: ${modifiedCount} 件`);
        if (!isApply) {
            console.log(`💡 実際に変更を適用するには --apply フラグを付けて実行してください:`);
            console.log(`   npx tsx scripts/migrate-deprecate-public-groups.ts --apply`);
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } catch (err) {
        console.error('❌ マイグレーション中にエラーが発生しました:', err);
        process.exit(1);
    }
}

migrateDeprecatePublicGroups();
