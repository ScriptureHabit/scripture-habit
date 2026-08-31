# Technical Documentation Index

Welcome to the **scripture-habit** technical documentation. This collection outlines the architectural foundations, feature designs, behavioral psychology, and engineering practices that shape the application.

> [!TIP]
> **Interested in contributing or exploring?**  
> You don't need to read everything upfront! Pick a feature or guide that sparks your curiosity and feel free to start small.

---

## Architecture Overview
- **[Architecture & Directory Structure](architecture.md)**
  - Layered responsibilities and clear boundary definitions across the frontend, internal API, and backend.
- **[Network & Performance Optimization](network-performance-optimization.md)**
  - Offline message queuing with Service Worker Sync, binary MessagePack transport, and multi-tier caching for rapid responsiveness.
- **[Database & Data Security](database-security.md)**
  - Thoughtful Firestore schema modeling, secure permission boundaries, and conversation history archiving.
- **[App Check & API Protection](security-architecture.md)**
  - Abuse prevention through Firebase App Check validation and multi-tier rate limiting.
- **[API Design & Error Handling](api-middleware-error-handling.md)**
  - Express middleware pipelines, standardized error hierarchies, and real-time monitoring via Sentry.
- **[Firebase Security Rules](firebase-security-rules.md)**
  - Strict database-level access controls (`isAuthenticated`) and write isolation.
- **[AI Context Guide & Standards](ai-context.md)**
  - Architectural context and component-logic separation principles for AI-assisted development.
- **[PWA & Mobile Lifecycle](hybrid-mobile-lifecycle.md)**
  - Seamless Service Worker update flows, platform-adaptive install prompts, and safe escapes from in-app WebViews (LINE, Instagram).
- **[SEO & Metadata Management](seo-and-meta-management.md)**
  - Clean search engine indexing, multilingual URL structures, and dynamic social share cards.
- **[UI/UX Design System](design-system.md)**
  - Curated color palettes, glassmorphism tokens, refined typography, and responsive layouts.

---

## Key Features
- **[Chat & Dashboard Synchronization](feature-chat-dashboard.md)**
  - Real-time listener orchestration and seamless unread badge reconciliation.
- **[Group Chat Architecture & Construction](groupchat-construction-guide.md)**
  - Real-time messaging workflows, optimistic UI updates, custom hooks, and modal management.
- **[Note Creation & Editing (NewNote)](newnote-construction-guide.md)**
  - Form state management, scripture URL metadata extraction, AI reflective prompts, and privacy settings.
- **[Dashboard & MyNotes Architecture](dashboard-mynotes-construction-guide.md)**
  - Study pace calculations, habit calendar tracking, fast note filtering, and weekly recaps.
- **[AI Integration (Gemini)](feature-ai-integration.md)**
  - Multilingual translation and reflective letter generation powered by Gemini 3.1 Flash-Lite, following church AI guidelines.
- **[Push Notification System](feature-notifications.md)**
  - FCM token lifecycle management, background message handling, and notification tray hygiene.

---

## UX & Habit Building Psychology
- **[Milestone Celebrations & Retention Psychology](logic-milestone-retention.md)**
  - A cumulative study-day model that prevents discouragement from broken streaks, paired with 10-day and 25-day milestone awards.
- **[Psychological Impact of AI Reflection Letters](ux-ai-reflection-letters.md)**
  - Exploring why adult learners thrive on personal feedback, addressing the lack of everyday validation through non-judgmental AI empathy.
- **[Small Groups (Max 5) & Peer Accountability](ux-small-groups-and-peer-accountability.md)**
  - The rationale behind 5-member circles—preventing bystander hesitation while fostering high-trust, low-pressure accountability.
- **[Letters to Future Self (Time Capsule) & Retention](ux-letters-to-future-self.md)**
  - Enhancing Future Self Continuity through pre-commitments, timely SOS encouragement banners, and snapshot-backed milestone unlocks.

---

## Core Logic
- **[Note Posting & Streak Calculations](logic-note-posting.md)**
  - End-to-end note submission pipelines, atomic Firestore updates, and timezone-safe study metrics.
- **[Gospel Library Scripture Mapper](gospel-library-mapper.md)**
  - Intelligent multi-language scripture parsing with highlighted deep links to official Church study tools.
- **[Group Invites & Joining Pipeline](group-invites.md)**
  - Secure invite link generation, expiration handling, and 5-member capacity enforcement.
- **[Inactivity Detection & Automated Housekeeping](inactivity-and-autokick.md)**
  - Graceful inactivity pruning, automated group ownership succession, and empty circle cleanup.
- **[URL Metadata & Speaker Extraction](url-metadata-extraction.md)**
  - Safe article title and speaker parsing with SSRF protection and in-memory caching.
- **[Internationalization (i18n)](logic-i18n.md)**
  - Dynamic language negotiation, locale-aware date rendering, and real-time AI translation.
- **[Unity & Daily Group Participation](unity-participation.md)**
  - Fair daily participation rate calculation and real-time synchronization across group members.
- **[Firestore Transactions & Counters](firestore-transactions-counters.md)**
  - Atomic data integrity, distributed counter strategies, and aggregation query optimizations.
- **[Incremental Book Suggestions](incremental-book-suggestions.md)**
  - Multilingual fuzzy completion supporting Japanese reading kana and scripture abbreviations.
- **[Profile Synchronization & Anonymization](profile-sync-anonymization.md)**
  - Real-time profile updates across group chats and privacy-respecting account deletion.
- **[Timezone-Aware Streak Reminders](timezone-streak-reminders.md)**
  - Localized evening push notifications dynamically triggered at 8:00 PM in each user's local time zone.
- **[Firestore Offline Persistence](firestore-offline-persistence.md)**
  - IndexedDB offline caching, multi-tab mutex locking, and conflict resolution.

---

## Development & Operations
- **[Development & Setup Guide](development-guide.md)**
  - Step-by-step local environment setup, Firebase emulators, and local development workflows.
- **[Troubleshooting & FAQ](troubleshooting.md)**
  - Solutions for common local issues, App Check bypass configurations, and port conflicts.
- **[Testing & Reliability Guide](testing-guide.md)**
  - Vitest unit test suites, security rule verification, and Playwright end-to-end tests.
- **[CI/CD & Maintenance Automation](cicd-maintenance-automation.md)**
  - Automated testing pipelines, production deployment workflows, and scheduled cron jobs via GitHub Actions.
- **[Scheduled Maintenance Jobs](maintenance-cron.md)**
  - Automated cron workers handling inactivity sweeps, counter aggregations, and data hygiene.
- **[Monitoring & Observability](monitoring-observability.md)**
  - Sentry error tracking, diagnostic performance tracing, and live issue alerts.
- **[Daily Unity Midnight Reset Hook](client-unity-midnight-reset.md)**
  - Client-side timezone boundary detection for smooth midnight resets.

---

> [!TIP]
> Each document is accompanied by **Mermaid diagrams** clearly illustrating data flows, sequence interactions, and state transitions.
