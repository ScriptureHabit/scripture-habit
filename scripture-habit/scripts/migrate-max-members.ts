import { db } from '../api_internal/lib/firebase-admin.js';

async function migrateMaxMembers() {
    console.log('🚀 既存グループの maxMembers の5人制限移行を開始します...');
    
    try {
        // 1. Fetch all groups
        const groupsSnapshot = await db.collection('groups').get();
        console.log(`📂 全 ${groupsSnapshot.size} 件のグループを取得しました。`);
        
        let updateCount = 0;
        let batch = db.batch();
        let batchOpCount = 0;
        
        for (const doc of groupsSnapshot.docs) {
            const data = doc.data();
            const currentMaxMembers = data.maxMembers;
            
            // maxMembers が 5 以外のすべてのドキュメント（未定義、または 100000 など）を対象にする
            if (currentMaxMembers !== 5) {
                batch.update(doc.ref, {
                    maxMembers: 5
                });
                batchOpCount++;
                updateCount++;
                
                // Firestore の 500 件書き込み制限ごとにバッチコミット
                if (batchOpCount >= 400) {
                    console.log(`📦 バッチコミット中... (${updateCount} 件処理済)`);
                    await batch.commit();
                    batch = db.batch();
                    batchOpCount = 0;
                }
            }
        }
        
        // 残りのバッチがあればコミット
        if (batchOpCount > 0) {
            await batch.commit();
        }
        
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`✨ 移行処理が完了しました！`);
        console.log(`📝 更新されたグループ数: ${updateCount} 件`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        
    } catch (error) {
        console.error('❌ 移行中にエラーが発生しました:', error);
        process.exit(1);
    }
    process.exit(0);
}

migrateMaxMembers();
