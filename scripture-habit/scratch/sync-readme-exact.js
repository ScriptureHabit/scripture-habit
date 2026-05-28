import fs from 'fs';
import path from 'path';

const readmePath = 'C:/Users/dazhi/code/final-project/README.md';
const jaReadmePath = 'C:/Users/dazhi/code/final-project/docs/ja/README.md';

const replacements = [
    // English README replacements
    { old: '*   **🚀 Scripture Habit Onboarding Tour**:', new: '*   **Tour 0: Scripture Habit Developer Onboarding**:' },
    { old: '*   **💻 Tour 1: Frontend Core Mechanics & React Hooks**:', new: '*   **Tour 22: Frontend Core Mechanics & React Hooks**:' },
    { old: '*   **🛡️ Tour 1: Security, Rules & API Protection**:', new: '*   **Tour 1: Security, Rules & API Protection**:' },
    { old: '*   **⚙️ Tour 2: Back-end Automation & Maintenance**:', new: '*   **Tour 2: Back-end Automation & Maintenance**:' },
    { old: '*   **🎨 Tour 3: Front-end Architecture, State & i18n**:', new: '*   **Tour 3: Front-end Architecture, State & i18n**:' },
    { old: '*   **🧪 Tour 4: Testing & CI/CD Pipeline**:', new: '*   **Tour 4: Testing & CI/CD Pipeline**:' },
    { old: '*   **📱 Tour 5: Capacitor Hybrid Mobile Bridge**:', new: '*   **Tour 5: Capacitor Hybrid Mobile Bridge**:' },
    { old: '*   **🤖 Tour 6: AI & Gemini Integration Pipeline**:', new: '*   **Tour 6: AI & Gemini Integration Pipeline**:' },
    { old: '*   **📖 Tour 7: Multilingual Gospel Library Mapper & Parsing**:', new: '*   **Tour 7: Multilingual Gospel Library Mapper & Parsing**:' },
    { old: '*   **🔢 Tour 8: Distributed Counter Sharding & Transactions**:', new: '*   **Tour 8: Distributed Counter Sharding & Transactions**:' },
    { old: '*   **🛡️ Tour 9: API Middleware, Error Handling & Sentry**:', new: '*   **Tour 9: API Middleware, Error Handling & Sentry**:' },
    { old: '*   **💾 Tour 10: Firestore Offline Persistence & SDK Initialization**:', new: '*   **Tour 10: Firestore Offline Persistence & SDK Initialization**:' },
    { old: '*   **🔍 Tour 11: Incremental Book Suggestion Engine**:', new: '*   **Tour 11: Incremental Book Suggestion Engine**:' },
    { old: '*   **⚙️ Tour 12: Local Development & Setup**:', new: '*   **Tour 12: Local Development & Setup**:' },
    { old: '*   **🌐 Tour 13: Localization & i18n Content**:', new: '*   **Tour 13: Localization & i18n Content**:' },
    { old: '*   **⚙️ Tour 14: Serverless Endpoint & Router Architecture**:', new: '*   **Tour 14: Serverless Endpoint & Router Architecture**:' },
    { old: '*   **📱 Tour 15: Mobile App Platform Bridge & Native Configs**:', new: '*   **Tour 15: Mobile App Platform Bridge & Native Configs**:' },
    { old: '*   **🧪 Tour 16: Advanced Database Auditing & Streak Reliability Tests**:', new: '*   **Tour 16: Advanced Database Auditing & Streak Reliability Tests**:' },
    { old: '*   **🛡️ Tour 17: GDPR Profile Deletion & Anonymization Pipeline**:', new: '*   **Tour 17: GDPR Profile Deletion & Anonymization Pipeline**:' },
    { old: '*   **🔔 Tour 18: Push Notifications & Multicast Deduplication**:', new: '*   **Tour 18: Push Notifications & Multicast Deduplication**:' },
    { old: '*   **🌐 Tour 19: Unified Multilingual Context & Race Guard Sync**:', new: '*   **Tour 19: Unified Multilingual Context & Race Guard Sync**:' },
    { old: '*   **🏆 Tour 20: Gamified Group Unity & Member Eligibility**:', new: '*   **Tour 20: Gamified Group Unity & Member Eligibility**:' },
    { old: '*   **🔍 Tour 21: Dynamic SEO, Meta Managers & OGP Cards**:', new: '*   **Tour 21: Dynamic SEO, Meta Managers & OGP Cards**:' },

    // Japanese README replacements
    { old: '*   **🚀 Scripture Habit Developer Onboarding Tour (オンボーディング)**:', new: '*   **Tour 0: Scripture Habit Developer Onboarding (オンボーディング)**:' },
    { old: '*   **🛡️ Tour 1: Security, Rules & API Protection (セキュリティ)**:', new: '*   **Tour 1: Security, Rules & API Protection (セキュリティ)**:' },
    { old: '*   **⚙️ Tour 2: Back-end Automation & Maintenance (自動化とバッチ)**:', new: '*   **Tour 2: Back-end Automation & Maintenance (自動化とバッチ)**:' },
    { old: '*   **🎨 Tour 3: Front-end Architecture, State & i18n (フロントエンド設計)**:', new: '*   **Tour 3: Front-end Architecture, State & i18n (フロントエンド設計)**:' },
    { old: '*   **🧪 Tour 4: Testing & CI/CD Pipeline (テストとCI/CD)**:', new: '*   **Tour 4: Testing & CI/CD Pipeline (テストとCI/CD)**:' },
    { old: '*   **📱 Tour 5: Capacitor Hybrid Mobile Bridge (モバイルアプリ連携)**:', new: '*   **Tour 5: Capacitor Hybrid Mobile Bridge (モバイルアプリ連携)**:' },
    { old: '*   **🤖 Tour 6: AI & Gemini Integration Pipeline (AIとGemini連携)**:', new: '*   **Tour 6: AI & Gemini Integration Pipeline (AIとGemini連携)**:' },
    { old: '*   **📖 Tour 7: Multilingual Gospel Library Mapper & Parsing (多言語聖典マッパー)**:', new: '*   **Tour 7: Multilingual Gospel Library Mapper & Parsing (多言語聖典マッパー)**:' },
    { old: '*   **🔢 Tour 8: Distributed Counter Sharding & Transactions (分散カウンタシャード)**:', new: '*   **Tour 8: Distributed Counter Sharding & Transactions (分散カウンタシャード)**:' },
    { old: '*   **🛡️ Tour 9: API Middleware, Error Handling & Sentry (ミドルウェアとエラーハンドリング)**:', new: '*   **Tour 9: API Middleware, Error Handling & Sentry (ミドルウェアとエラーハンドリング)**:' },
    { old: '*   **💾 Tour 10: Firestore Offline Persistence & SDK Initialization (オフライン永続化とSDK初期化)**:', new: '*   **Tour 10: Firestore Offline Persistence & SDK Initialization (オフライン永続化とSDK初期化)**:' },
    { old: '*   **🔍 Tour 11: Incremental Book Suggestion Engine (インクリメンタル書籍提案エンジン)**:', new: '*   **Tour 11: Incremental Book Suggestion Engine (インクリメンタル書籍提案エンジン)**:' },
    { old: '*   **⚙️ Tour 12: Local Development & Setup (開発環境と起動)**:', new: '*   **Tour 12: Local Development & Setup (開発環境と起動)**:' },
    { old: '*   **🌐 Tour 13: Localization & i18n Content (多言語対応と翻訳)**:', new: '*   **Tour 13: Localization & i18n Content (多言語対応と翻訳)**:' },
    { old: '*   **⚙️ Tour 14: Serverless Endpoint & Router Architecture (サーバーレスAPIとルーティング)**:', new: '*   **Tour 14: Serverless Endpoint & Router Architecture (サーバーレスAPIとルーティング)**:' },
    { old: '*   **📱 Tour 15: Mobile App Platform Bridge & Native Configs (モバイルプラットフォームブリッジとネイティブ設定)**:', new: '*   **Tour 15: Mobile App Platform Bridge & Native Configs (モバイルプラットフォームブリッジとネイティブ設定)**:' },
    { old: '*   **🧪 Tour 16: Advanced Database Auditing & Streak Reliability Tests (高度なDB監査とストリーク信頼性)**:', new: '*   **Tour 16: Advanced Database Auditing & Streak Reliability Tests (高度なDB監査とストリーク信頼性)**:' },
    { old: '*   **🛡️ Tour 17: GDPR Profile Deletion & Anonymization Pipeline (GDPRプロフィール削除とインタラクション匿名化)**:', new: '*   **Tour 17: GDPR Profile Deletion & Anonymization Pipeline (GDPRプロフィール削除とインタラクション匿名化)**:' },
    { old: '*   **🔔 Tour 18: Push Notifications & Multicast Deduplication (プッシュ通知と重複排除マルチキャスト)**:', new: '*   **Tour 18: Push Notifications & Multicast Deduplication (プッシュ通知と重複排除マルチキャスト)**:' },
    { old: '*   **🌐 Tour 19: Unified Multilingual Context & Race Guard Sync (統一多言語コンテキストと競合ガード同期)**:', new: '*   **Tour 19: Unified Multilingual Context & Race Guard Sync (統一多言語コンテキストと競合ガード同期)**:' },
    { old: '*   **🏆 Tour 20: Gamified Group Unity & Member Eligibility (団結度ゲーミフィケーション同期と参加資格)**:', new: '*   **Tour 20: Gamified Group Unity & Member Eligibility (団結度ゲーミフィケーション同期と参加資格)**:' },
    { old: '*   **🔍 Tour 21: Dynamic SEO, Meta Managers & OGP Cards (動的SEOとメタデータ管理)**:', new: '*   **Tour 21: Dynamic SEO, Meta Managers & OGP Cards (動的SEOとメタデータ管理)**:' }
];

function runExactReplace(filepath) {
    if (!fs.existsSync(filepath)) return;
    let content = fs.readFileSync(filepath, 'utf8');
    const original = content;

    // Apply exact replacements
    replacements.forEach(r => {
        // Escape special regex chars except hyphen/slash
        const escapedOld = r.old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Let's allow the emoji to be optional or a wild placeholder to match variations selector
        const regexString = escapedOld.replace(/🛡️|⚙️|🚀|💻|🎨|🧪|📱|🤖|📖|🔢|💾|🔍|🌐|🔔|🏆/g, '.{1,4}');
        const regex = new RegExp(regexString, 'g');
        content = content.replace(regex, r.new);
    });

    // Also add the new Tour 22 reference to the end of the lists in both files
    if (filepath === readmePath) {
        if (!content.includes('Tour 22: Frontend Core Mechanics & React Hooks')) {
            content = content.replace(
                /(\*\s+\*\*Tour 21: Dynamic SEO, Meta Managers & OGP Cards\*\*[\s\S]*?\n)/,
                '$1*   **Tour 22: Frontend Core Mechanics & React Hooks**: Guides developers through the real-time group chat synchronization controller, unread messages calculation, and live daily streak computations.\n'
            );
        }
    } else if (filepath === jaReadmePath) {
        if (!content.includes('Tour 22: Frontend Core Mechanics & React Hooks')) {
            content = content.replace(
                /(\*\s+\*\*Tour 21: Dynamic SEO, Meta Managers & OGP Cards\s*\(動的SEOとメタデータ管理\)\*\*[\s\S]*?\n)/,
                '$1*   **Tour 22: Frontend Core Mechanics & React Hooks (フロントエンド主要設計)**: リアルタイムチャット同期、既読数カウント、および継続学習日数（ストリーク）のフロントエンド算出制御ロジックを解説します。\n'
            );
        }
    }

    if (original !== content) {
        console.log(`Pristine replaced exact titles in: ${path.relative(path.dirname(readmePath), filepath)}`);
        fs.writeFileSync(filepath, content, 'utf8');
    }
}

runExactReplace(readmePath);
runExactReplace(jaReadmePath);
