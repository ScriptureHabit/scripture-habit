import fs from 'fs';
import path from 'path';

const readmePath = 'C:/Users/dazhi/code/final-project/README.md';
const jaReadmePath = 'C:/Users/dazhi/code/final-project/docs/ja/README.md';

const tourMappings = {
    'Tour 0: Scripture Habit Developer Onboarding': 'Tour 0: Scripture Habit Developer Onboarding',
    'Tour 1: Security, Rules & API Protection': 'Tour 1: Security, Rules & API Protection',
    'Tour 2: Back-end Automation & Maintenance': 'Tour 2: Back-end Automation & Maintenance',
    'Tour 3: Front-end Architecture, State & i18n': 'Tour 3: Front-end Architecture, State & i18n',
    'Tour 4: Testing & CI/CD Pipeline': 'Tour 4: Testing & CI/CD Pipeline',
    'Tour 5: Capacitor Hybrid Mobile Bridge': 'Tour 5: Capacitor Hybrid Mobile Bridge',
    'Tour 6: AI & Gemini Integration Pipeline': 'Tour 6: AI & Gemini Integration Pipeline',
    'Tour 7: Multilingual Gospel Library Mapper & Parsing': 'Tour 7: Multilingual Gospel Library Mapper & Parsing',
    'Tour 8: Distributed Counter Sharding & Transactions': 'Tour 8: Distributed Counter Sharding & Transactions',
    'Tour 9: API Middleware, Error Handling & Sentry': 'Tour 9: API Middleware, Error Handling & Sentry',
    'Tour 10: Firestore Offline Persistence & SDK Initialization': 'Tour 10: Firestore Offline Persistence & SDK Initialization',
    'Tour 11: Incremental Book Suggestion Engine': 'Tour 11: Incremental Book Suggestion Engine',
    'Tour 12: Local Development & Setup': 'Tour 12: Local Development & Setup',
    'Tour 13: Localization & i18n Content': 'Tour 13: Localization & i18n Content',
    'Tour 14: Serverless Endpoint & Router Architecture': 'Tour 14: Serverless Endpoint & Router Architecture',
    'Tour 15: Mobile App Platform Bridge & Native Configs': 'Tour 15: Mobile App Platform Bridge & Native Configs',
    'Tour 16: Advanced Database Auditing & Streak Reliability Tests': 'Tour 16: Advanced Database Auditing & Streak Reliability Tests',
    'Tour 17: GDPR Profile Deletion & Anonymization Pipeline': 'Tour 17: GDPR Profile Deletion & Anonymization Pipeline',
    'Tour 18: Push Notifications & Multicast Deduplication': 'Tour 18: Push Notifications & Multicast Deduplication',
    'Tour 19: Unified Multilingual Context & Dynamic Fallbacks': 'Tour 19: Unified Multilingual Context & Dynamic Fallbacks',
    'Tour 20: Gamified Group Unity & Member Eligibility': 'Tour 20: Gamified Group Unity & Member Eligibility',
    'Tour 21: Dynamic SEO, Meta Managers & OGP Cards': 'Tour 21: Dynamic SEO, Meta Managers & OGP Cards',
    'Tour 22: Frontend Core Mechanics & React Hooks': 'Tour 22: Frontend Core Mechanics & React Hooks'
};

function updateFile(filepath) {
    if (!fs.existsSync(filepath)) return;
    let content = fs.readFileSync(filepath, 'utf8');
    let original = content;

    // Replace the specific lines inside README
    // Let's do string replacements for the list items
    // First, fix Tour 1 vs Tour 22 references in lists
    content = content.replace(/Tour 1: Frontend Core Mechanics & React Hooks/g, 'Tour 22: Frontend Core Mechanics & React Hooks');
    content = content.replace(/Tour 1: フロントエンド/g, 'Tour 22: フロントエンド');
    
    // Convert 12. Local Development ... to Tour 12: Local Development ...
    for (let i = 12; i <= 21; i++) {
        const regex = new RegExp(`(?<=\\*\\*|\\s|^)${i}\\.\\s+`, 'g');
        content = content.replace(regex, `Tour ${i}: `);
    }

    if (original !== content) {
        console.log(`Updated readme formatting for unified titles in: ${path.basename(filepath)}`);
        fs.writeFileSync(filepath, content, 'utf8');
    }
}

updateFile(readmePath);
updateFile(jaReadmePath);
