import fs from 'fs';
import path from 'path';

const toursDir = 'C:/Users/dazhi/code/final-project/.tours';

const tourMappings = {
    'onboarding.tour': 'Tour 0: Scripture Habit Developer Onboarding',
    'security-and-rules.tour': 'Tour 1: Security, Rules & API Protection',
    'maintenance-and-cron.tour': 'Tour 2: Back-end Automation & Maintenance',
    'frontend-architecture.tour': 'Tour 3: Front-end Architecture, State & i18n',
    'testing-and-cicd.tour': 'Tour 4: Testing & CI/CD Pipeline',
    'capacitor-mobile.tour': 'Tour 5: Capacitor Hybrid Mobile Bridge',
    'ai-and-gemini.tour': 'Tour 6: AI & Gemini Integration Pipeline',
    'gospel-mapper.tour': 'Tour 7: Multilingual Gospel Library Mapper & Parsing',
    'distributed-counters.tour': 'Tour 8: Distributed Counter Sharding & Transactions',
    'api-middleware-errors.tour': 'Tour 9: API Middleware, Error Handling & Sentry',
    'offline-persistence.tour': 'Tour 10: Firestore Offline Persistence & SDK Initialization',
    'suggestion-engine.tour': 'Tour 11: Incremental Book Suggestion Engine',
    'development-setup.tour': 'Tour 12: Local Development & Setup',
    'localization-content.tour': 'Tour 13: Localization & i18n Content',
    'serverless-router.tour': 'Tour 14: Serverless Endpoint & Router Architecture',
    'mobile-native-bridge.tour': 'Tour 15: Mobile App Platform Bridge & Native Configs',
    'advanced-testing.tour': 'Tour 16: Advanced Database Auditing & Streak Reliability Tests',
    'gdpr-profile-anonymization.tour': 'Tour 17: GDPR Profile Deletion & Anonymization Pipeline',
    'fcm-notifications-lifecycle.tour': 'Tour 18: Push Notifications & Multicast Deduplication',
    'language-context-sync.tour': 'Tour 19: Unified Multilingual Context & Dynamic Fallbacks',
    'group-unity-gamification.tour': 'Tour 20: Gamified Group Unity & Member Eligibility',
    'seo-pwa-lifecycle.tour': 'Tour 21: Dynamic SEO, Meta Managers & OGP Cards',
    'frontend-core-mechanics.tour': 'Tour 22: Frontend Core Mechanics & React Hooks'
};

Object.entries(tourMappings).forEach(([file, newTitle]) => {
    const filepath = path.join(toursDir, file);
    if (!fs.existsSync(filepath)) {
        console.error(`File does not exist: ${file}`);
        return;
    }
    try {
        const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        const oldTitle = data.title;
        if (oldTitle !== newTitle) {
            console.log(`Updating ${file}: "${oldTitle}" -> "${newTitle}"`);
            data.title = newTitle;
            fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
        }
    } catch (e) {
        console.error(`Failed to update ${file}`, e);
    }
});
