# Technical Documentation Index

Welcome to the **scripture-habit** technical documentation. This directory contains detailed guides covering the application's architecture, feature implementations, UX design rationale, and operations.

---

## Architecture Overview
- **[Architecture & Structure](architecture.md)**
  - Frontend, API, and backend layer responsibilities.
- **[Network & Performance Optimization](network-performance-optimization.md)**
  - Service Worker Background Sync, MessagePack binary protocol, and caching layers.
- **[Database & Security](database-security.md)**
  - Firestore collection hierarchy, ER models, and token isolation.
- **[App Check & API Protection](security-architecture.md)**
  - Firebase App Check validation and multi-tier rate limiting.
- **[API Middleware & Error Handling](api-middleware-error-handling.md)**
  - Express middleware pipelines, standardized `AppError` hierarchy, and Sentry tracking.
- **[Firebase Security Rules](firebase-security-rules.md)**
  - Database access controls (`isAuthenticated()`) and mutation write isolation.
- **[AI Context Guide & Standards](ai-context.md)**
  - AI developer standards, component-logic separation, and state taxonomy.
- **[SEO & Metadata Management](seo-and-meta-management.md)**
  - Canonical URL resolution, dynamic robots directives, and OGP cards.
- **[UI/UX Design System](design-system.md)**
  - Color tokens, glassmorphism containers, typography, and responsive rules.

---

## Key Features
- **[Chat & Dashboard Synchronization](feature-chat-dashboard.md)**
  - Real-time listeners and read marker reconciliation.
- **[Group Chat Construction Guide](groupchat-construction-guide.md)**
  - Chat layout, context isolation, modal orchestration, and optimistic UI updates.
- **[Note Creation (NewNote) Guide](newnote-construction-guide.md)**
  - Form state management, URL metadata extraction, and AI question prompts.
- **[Dashboard & MyNotes Guide](dashboard-mynotes-construction-guide.md)**
  - Habit calendar, study metrics, search filtering, and weekly recap letters.
- **[AI Integration (Gemini)](feature-ai-integration.md)**
  - Gemini 3.1 Flash-Lite translations, weekly letters, and prompt caching.
- **[Push Notification System](feature-notifications.md)**
  - FCM token lifecycle, background delivery, and notification tray pruning.

---

## UX & Habit Building
- **[Milestone Celebrations & Retention Psychology](logic-milestone-retention.md)**
  - Transitioning to total-day streaks and visual milestone cards (10-day/25-day).
- **[Psychological Impact & Retention of AI Reflection Letters](ux-ai-reflection-letters.md)**
  - Encouraging reflections, validation of personal efforts, and long-term engagement.
- **[Small Group Dynamics (Max 5) & Peer Accountability](ux-small-groups-and-peer-accountability.md)**
  - Mitigating diffusion of responsibility and supporting high-trust peer circles.

---

## Core Logic
- **[Note Posting & Streaks](logic-note-posting.md)**
  - Submission transactions, timezone-safe streak calculations, and level progressions.
- **[Gospel Library Scripture Mapper](gospel-library-mapper.md)**
  - Chapter and verse parsing with deep links to official church applications.
- **[Group Invites & Joining Pipeline](group-invites.md)**
  - Invite token generation, expiration tracking, and 5-member limit enforcement.
- **[Inactivity & Auto-Kick Engine](inactivity-and-autokick.md)**
  - Inactivity detection, automated member pruning, and ownership succession.
- **[URL Metadata & Speaker Extraction](url-metadata-extraction.md)**
  - Article metadata extraction, SSRF security guards, and multi-tier caching.
- **[Internationalization (i18n)](logic-i18n.md)**
  - Language negotiation, UI translation hooks, and AI-assisted dynamic translation.
- **[Unity & Daily Participation](unity-participation.md)**
  - Real-time group participation rate calculation and daily progress tracking.
- **[Firestore Transactions & Counters](firestore-transactions-counters.md)**
  - Atomic transactions, distributed counters, and aggregation optimizations.
- **[Incremental Book Suggestions](incremental-book-suggestions.md)**
  - Multilingual fuzzy completion and Japanese reading kana mappings.
- **[Profile Synchronization & Anonymization](profile-sync-anonymization.md)**
  - Profile metadata synchronization and GDPR-compliant account deletion.
- **[Timezone-Aware Streak Reminders](timezone-streak-reminders.md)**
  - Localized evening push reminders and dead token cleanup.
- **[Firestore Offline Persistence](firestore-offline-persistence.md)**
  - IndexedDB caching, multi-tab coordination, and offline conflict resolution.

---

## Development & Operations
- **[Development & Setup Guide](development-guide.md)**
  - Local emulator setup, environment configuration, and dev runners.
- **[Troubleshooting & FAQ](troubleshooting.md)**
  - Common development issues, App Check bypasses, and port conflicts.
- **[Testing & Reliability Guide](testing-guide.md)**
  - Vitest unit tests, emulated API tests, and Playwright E2E suites.
- **[CI/CD & Maintenance Automation](cicd-maintenance-automation.md)**
  - GitHub Actions pipelines, automated test runs, and continuous delivery.
- **[Maintenance & Scheduled Jobs (Cron)](maintenance-cron.md)**
  - Background sweeps, orphan pruning, and automated chat TTL cleanup.
- **[Monitoring & Observability](monitoring-observability.md)**
  - Sentry error logging, performance tracing, and PWA lifecycle alerts.
- **[Daily Unity Midnight Reset Hook](client-unity-midnight-reset.md)**
  - Client-side timezone rollover detection and midnight activity resets.

---

> [!TIP]
> All documentation includes interactive **Mermaid Diagrams** illustrating architecture, data flows, and state machines.
