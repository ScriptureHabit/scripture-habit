# Technical Documentation Index

> [!NOTE]
> **[日本語版の技術ドキュメントはこちら (Japanese Version Available)](ja/README.md)**

Welcome to the **scripture-habit** technical documentation. This directory contains details about the application's architecture, features, design philosophy, and core implementations.

---

## Architecture Overview
- **[Architecture & Structure](architecture.md)**
  - High-level directory structure and layer responsibilities (Frontend, Internal API, Backend).
- **[Network & Performance Optimization](network-performance-optimization.md)**
  - Offline message sync (Service Worker Background Sync) and binary payload format (MessagePack).
  - Multi-tier caching, Brotli compression, and font self-hosting.
- **[Database & Security](database-security.md)**
  - Firestore data models, privacy isolation, and chat archive structure.
- **[App Check & API Protection](security-architecture.md)**
  - Gateway middleware guards, token verification, and rate limiting.
- **[API Middleware & Error Handling](api-middleware-error-handling.md)**
  - Express middleware topology, unified error handling, and Sentry tracking.
- **[Firebase Security Rules](firebase-security-rules.md)**
  - Database-level authentication checks (`isAuthenticated()`) and App Check validation.
- **[AI Context Guide & Coding Standards](ai-context.md)**
  - Development AI directives, state boundary rules, and transactional integrity guidelines.
- **[SEO & Metadata Management](seo-and-meta-management.md)**
  - Search engine indexing, multilingual canonical URLs, and dynamic Open Graph thumbnails.

---

## Key Features
- **[Chat & Dashboard Synchronization](feature-chat-dashboard.md)**
  - Real-time Firestore listener lifecycle and unread message synchronization.
- **[Group Chat Architecture](groupchat-construction-guide.md)**
  - Real-time chat system, state management, custom hooks, and modal controllers.
- **[Note Creation & Editing (NewNote)](newnote-construction-guide.md)**
  - Form state management, URL metadata extraction, AI reflection prompts, and sharing options.
- **[Dashboard & MyNotes](dashboard-mynotes-construction-guide.md)**
  - Calendar grid, habit pace algorithm, note search tokens, and weekly AI recaps.
- **[AI Integration (Gemini)](feature-ai-integration.md)**
  - Gemini 3.1 Flash-Lite integration for automated translation and weekly reflection letters.
- **[Push Notifications](feature-notifications.md)**
  - FCM token lifecycle, background delivery, and OS notification tray management.

---

## UX & Habit Building
- **[Milestone Celebrations & Retention Psychology](logic-milestone-retention.md)**
  - Transitioning to a total days model to prevent demotivation when streaks break.
  - Milestone intervals (Day 10 + every 25 days) and visualizing progress through commemorative cards.
- **[AI Reflection Letters: Psychological Impact & Retention](ux-ai-reflection-letters.md)**
  - User feedback showing that personalized AI reflection letters serve as a key retention driver.
  - Addressing the lack of affirmation in adult daily life and the comfort of non-judgmental, thoughtful reflection.
- **[Small Group Dynamics (Max 5) & Peer Accountability](ux-small-groups-and-peer-accountability.md)**
  - Why groups are capped at 5 members (reducing social loafing and keeping interactions personal).
  - Why groups of close friends and family last longer, and how the app supports groups of strangers.

---

## Core Logic
- **[Note Posting & Streak Logic](logic-note-posting.md)**
  - End-to-end note submission flow and total study days calculation.
- **[Gospel Library Scripture Mapper](gospel-library-mapper.md)**
  - Scripture chapter parsing and deep-link generation with verse highlights.
- **[Group Invites & Joining Pipeline](group-invites.md)**
  - Secure invite links, expiration handling, and group capacity enforcement.
- **[Inactivity & Auto-Kick Engine](inactivity-and-autokick.md)**
  - Automated detection of inactive members and group owner role handoff.
- **[URL Metadata & Speaker Extraction](url-metadata-extraction.md)**
  - Safely fetching article titles and speaker names with two-tier caching.
- **[Internationalization (i18n)](logic-i18n.md)**
  - Frontend locale switching and AI-assisted batch translation.
- **[Unity Participation & Sync](unity-participation.md)**
  - Group-wide daily study completion percentage and real-time synchronization.
- **[Firestore Transactions & Counters](firestore-transactions-counters.md)**
  - Transactional data integrity and distributed sharded counter patterns.
- **[Incremental Book Suggestions](incremental-book-suggestions.md)**
  - Multilingual and phonetic auto-complete suggestions for scripture book names.
- **[User Profile Sync & Anonymization](profile-sync-anonymization.md)**
  - Propagating profile updates to group chats and GDPR-compliant data anonymization.
- **[Timezone-Aware Streak Reminders](timezone-streak-reminders.md)**
  - Scheduling personalized evening push notifications based on user timezones.

---

## Development & Operations
- **[Development & Setup Guide](development-guide.md)**
  - Local environment setup, emulators, and deployment steps.
- **[Troubleshooting & FAQ](troubleshooting.md)**
  - Common development issues and bypass procedures (App Check, auth).
- **[Testing & Reliability Guide](testing-guide.md)**
  - Unit tests with Vitest, Firestore security rules tests, and Playwright E2E suites.
- **[CI/CD & Maintenance Automation](cicd-maintenance-automation.md)**
  - GitHub Actions pipelines, production CD deployment, and daily Cron triggers.
- **[Maintenance & Batch Jobs (Cron)](maintenance-cron.md)**
  - Scheduled jobs for inactive account cleanups and counter reconciliations.
- **[Monitoring & Observability](monitoring-observability.md)**
  - Sentry error monitoring, performance tracing, and crash reporting.
- **[Firestore Offline Persistence](firestore-offline-persistence.md)**
  - IndexedDB offline mutation queues and multi-tab shared lock coordination.
- **[Client-Side Unity Midnight Reset Hook](client-unity-midnight-reset.md)**
  - Polling and resetting group Unity percentages at midnight local time.

---

## Technical Deep-Dives
- **[Note Posting & Streak Logic Deep-Dive](details/note-posting-streak.md)**
  - Detailed transactional sequences, timezone calculations, and 36-hour grace periods.
- **[AI (Gemini) Translation & Recap Deep-Dive](details/ai-integration.md)**
  - API parameter optimizations, caching strategies, and batch translation parsing.
- **[App Check & API Security Deep-Dive](details/api-gateway-security.md)**
  - Defense-in-depth topology, automated testing exceptions, and IP rate limiters.
- **[Gospel Library Mapper Deep-Dive](details/gospel-scripture-mapper.md)**
  - Unicode character normalization, search suggestion sorting, and deep links.
- **[Inactivity & Auto-Kick Deep-Dive](details/inactivity-autokick.md)**
  - Low-read batch scanning, automated removals, and owner succession logic.
- **[Group Chat Interaction Deep-Dive](details/group-chat-interactions.md)**
  - Optimistic UI updates, reaction debouncing, translation queues, and cheers.
- **[Push Notification System Deep-Dive](details/push-notifications.md)**
  - Token vaults, dead token pruning, and language-split multicast delivery.
- **[Profile Sync & Deletion Deep-Dive](details/profile-sync-deletion.md)**
  - Paginated cursor updates and privacy-preserving account deletion.
- **[Firestore Distributed Counters Deep-Dive](details/firestore-transactions-counters.md)**
  - 10-shard distributed counters, server-side count aggregations, and read audits.
- **[Firestore Offline Persistence Deep-Dive](details/firestore-offline-persistence.md)**
  - Web Locks API master tab elections, offline queues, and fallback mechanisms.
- **[URL Metadata Extraction Deep-Dive](details/url-metadata-extraction.md)**
  - Two-tier caching, SSRF prevention, and Cheerio-based metadata cleansing.
- **[Timezone-Aware Reminder Deep-Dive](details/timezone-streak-reminders.md)**
  - Intl API timezone mapping, chunked queries, and delivery recovery flows.

---

## Design System
- **[UI/UX Design System](design-system.md)**
  - Global CSS tokens, visual design guidelines, and typography standards.

---

> [!TIP]
> Each document includes **Mermaid diagrams** to illustrate workflows and architectural relationships.
