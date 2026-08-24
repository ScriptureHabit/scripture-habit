# Technical Documentation Index

> [!NOTE]
> **[日本語版の技術ドキュメントはこちら (Japanese Version Available)](ja/README.md)**

Welcome to the **scripture-habit** technical documentation. This directory contains details about the architecture, features, and core logic of the application.

---

## General Architecture
- **[Architecture & Structure](architecture.md)**
  - High-level directory overview.
  - Layer definitions (API, Internal, Backend, Frontend).
- **[Network Performance & Data Optimization](network-performance-optimization.md)**
  - Service Worker Background Sync and offline message persistence.
  - MessagePack binary communication protocol and DataLoader N+1 query deduplication.
  - Multi-tier caching (Redis, Axios cache interceptor), Brotli/Gzip compression, font self-hosting, and dynamic code splitting.
- **[Database & Security](database-security.md)**
  - Firestore ER model, path hierarchy, and private data isolation.
  - Chat archiving (Bucket pattern) and collection denormalization strategies.
- **[App Check & API Protection](security-architecture.md)**
  - Gateway middleware guards, token validations, and development bypass policies.
- **[API Middleware Architecture & Standard Error Handling](api-middleware-error-handling.md)**
  - Express CORS validation, Vercel TrailingSlash fixes, rate limiting, custom AppError classes, and global Sentry tracking.
- **[Firebase Security Rules & CQRS Write Isolation](firebase-security-rules.md)**
  - Database-level email verification (`isAuthenticated()`) and App Check validation (`isAppCheckVerified()`).
  - Custom group limits (lookup size restrictions) and backend-only CQRS write rules.
- **[AI Context Guide & Development Charter](ai-context.md)**
  - Essential LLM directives and repository-wide system design constraints.
  - State boundaries, logic-component split principles, and transactional integrity rules.
- **[SEO & Dynamic Meta Management](seo-and-meta-management.md)**
  - Dynamic page indexing, robots meta rules, multi-lingual canonical paths, and Open Graph thumbnail rendering.

---

## Feature Deep-Dives
- **[Chat & Dashboard Synchronization](feature-chat-dashboard.md)**
  - Detailed explanation of real-time Firestore listeners.
  - The separation of data and UI.
  - How unread status is synchronized.
- **[Group Chat Architecture & Implementation](groupchat-construction-guide.md)**
  - Overview and architecture of the real-time group chat system.
  - Explains 4-tier Context isolation, custom state engine, 18 domain hooks, UI subcomponents, and 11 modal dialogs.
- **[Note Creation & Edit Modal Architecture](newnote-construction-guide.md)**
  - Overview and architecture of the note creation/editing modal (`NewNote`).
  - Explains URL metadata extraction, AI reflection generator, random scripture picker, sharing scope selector, and submission engine.
- **[Dashboard & MyNotes Architecture](dashboard-mynotes-construction-guide.md)**
  - Overview and architecture of the personal hub (`Dashboard`), `MyNotes`, and `NoteCard` modules.
  - Explains streak calendar grid, habit pace algorithm, note search token engine, weekly AI recap generator, and Gospel Library deep links.
- **[AI Integration](feature-ai-integration.md)**
  - How Gemini 3.1 Flash-Lite is integrated.
  - Translation, Weekly Recaps, and Automation.
- **[Notification System](feature-notifications.md)**
  - FCM token storage, status recovery, and service worker installation.
  - OS notification tray control (clearing streak reminders and group messages).

---

## Core Logic & Mechanisms
- **[Note Posting Mechanism](logic-note-posting.md)**
  - End-to-end flow of posting a note.
  - Detailed streak and level calculation logic.
- **[Gospel Library Mapper](gospel-library-mapper.md)**
  - Multi-lingual scripture and volume mapping engine.
  - Character normalization, regex chapter parsing, and deep-link verse highlights.
- **[Group Invites & Joining Pipeline](group-invites.md)**
  - Safe group membership registration and unique code generation.
  - Rate-limited join attempts, localized metadata preview cards, and expiration timelines.
- **[Inactivity & Auto-Kick Engine](inactivity-and-autokick.md)**
  - Evaluation thresholds, rotational scheduler, self-healing subcollections, and ownership transfer logic.
- **[URL Metadata & Speaker Extraction](url-metadata-extraction.md)**
  - Client-server pipeline for parsing page titles and speakers.
  - SSRF protection, Firebase security guards, and dual-fetch fallback handling.
  - Optimized two-tier caching (Memory + LocalStorage) and front-end hooks.
- **[I18n & Localization: Global Reach](logic-i18n.md)**
  - Frontend context and backend template systems.
  - Automated AI translation strategies.
- **[Unity Participation & Sync Architecture](unity-participation.md)**
  - Group sync math, real-time message sync client overrides, and triple-fallback joined-at eligibility filtering.
- **[Firestore Transactions & Counter Service Design](firestore-transactions-counters.md)**
  - Dynamic transaction read-before-write ordering, atomic multi-document updates, and read-cost audit.
- **[Incremental Book Suggestion Engine](incremental-book-suggestions.md)**
  - Multi-lingual Unicode normalization, Japanese Hiragana-to-Katakana phonetic code-shifting, and 4-tier sorting priorities.
- **[User Profile Sync & Reaction Anonymization](profile-sync-anonymization.md)**
  - Syncing user details to group chats and search indices.
  - Anonymizing personal data during account deletion.
- **[Timezone-Aware Streak Reminders](timezone-streak-reminders.md)**
  - Dynamic timezone target resolution using Javascript `Intl` libraries.
  - Partitioned query chunking, multi-lingual multicast, and self-healing FCM token pruning.

---

## Operations & Development
- **[Development & Environment Guide](development-guide.md)**
  - Local setup and deployment instructions.
- **[Technical Troubleshooting & FAQ](troubleshooting.md)**
  - Resolution paths for AppCheck test bypasses.
- **[Testing & Reliability Guide](testing-guide.md)**
  - Unit and integration testing setup using Vitest, Firebase rule unit tests, and Playwright E2E automation.
- **[CI/CD & Maintenance Automation Guide](cicd-maintenance-automation.md)**
  - GitHub Actions continuous integration, local Java Firebase Emulators, Playwright pipeline runs, Vercel prod CD deployments, and daily inactivity scan Cron triggers.
- **[Maintenance & Batch Jobs](maintenance-cron.md)**
  - Inactivity checks, owner transfers, and counter aggregation.
  - Archiving and self-healing mechanisms.
- **[Monitoring & Observability](monitoring-observability.md)**
  - Sentry integration, vConsole, and PWA lifecycle.
  - Error silencing and performance tracing.
- **[Firestore Offline Persistence & Multi-Tab Sync](firestore-offline-persistence.md)**
  - IndexedDB cache configurations, multi-tab shared-locks, failover try-catch blocks, and automated runner webdriver optimizations.
- **[Client-Side Unity Midnight Reset Hook](client-unity-midnight-reset.md)**
  - React lifecycle hook executing sub-minute timezone date-flip polling.
  - OS sleep/wake sync focus hooks, dual-token authorization gateway handshakes.

---

## Deep-Dive Detail Guides
- **[Note Posting & Streak Logic Deep-Dive](details/note-posting-streak.md)**
  - Detailed transactional step-by-step sequences, localized timezone evaluations, and 36-hour grace period algorithms with Mermaid sequence/flowcharts and annotated code.
- **[AI (Gemini) Translation & Weekly Recap Pipeline Deep-Dive](details/ai-integration.md)**
  - Minimal thinking latency API settings, dynamic caching strategies, optimized single-call batch translations, and smart 6-day cooldown recovery flows with sequence/flowcharts and annotated code.
- **[App Check & API Gateway Security Deep-Dive](details/api-gateway-security.md)**
  - Multi-layered security topology, strict production bypass block safeguards, Playwright CI/CD test account exception rules, and hashed SHA-256 IP rate limiters with sequence/flowcharts and annotated code.
- **[Gospel Library Mapper & Autocomplete Engine Deep-Dive](details/gospel-scripture-mapper.md)**
  - Full-width character standardization, regex scripture parsing, dynamic verse scroll anchors, Unicode NFKC normalization, and phonetic Hiragana-to-Katakana shifting suggestion algorithms with flowcharts and annotated code.
- **[Inactivity Sweep & Auto-Kick & Handoff Engine Deep-Dive](details/inactivity-autokick.md)**
  - Batch sweep rotations (The Net + Rotation), 90% database read-savings queries, self-healing subcollection repairs, and automated owner transfers / recursive ghost group deletions with sequence/flowcharts and annotated code.
- **[Group Chat Interaction Engine Deep-Dive](details/group-chat-interactions.md)**
  - Optimistic message pipeline (temp-ID → real-ID resolution + rollback), reaction toggle & 3-cap preview cache, 400ms debounce batch translation queue, timezone-aware cheer system, double-tap guard patterns, and SNS share handlers with sequence/flowcharts and annotated code.
- **[Push Notification System Deep-Dive](details/push-notifications.md)**
  - Device token registration, multi-layer secure Firestore vault, automatic self-healing dead token lifecycle, multi-lingual dynamic multicast splitting, and OS notification tray context-aware sanitation with sequence diagrams and annotated code.
- **[User Profile Sync & Account Deletion Pipeline Deep-Dive](details/profile-sync-deletion.md)**
  - Active Horizon sync boundaries, paginated cursor batch execution, multi-target entity synchronization, personal note prefix search index reconstruction, and GDPR-compliant social identity reaction anonymization with sequence diagrams and annotated code.
- **[Firestore Transactions & Distributed Counter Sharding Deep-Dive](details/firestore-transactions-counters.md)**
  - Read-before-write transaction sequencing (IIFE phase pattern), multi-document atomic sets, 10-shard distributed counter writes, transaction-safe parallel reads, server-side count() aggregation, archive-aware counts, and the global 300-read telemetry warning audit with sequence/flow diagrams and annotated code.
- **[Firestore Offline Persistence & Multi-Tab Synchronization Deep-Dive](details/firestore-offline-persistence.md)**
  - Coordinated multi-tab access via persistentMultipleTabManager (Shared-Locks / Web Locks API), active Master Tab elections, background offline mutation queues with automatic communication channel flushes, incognito/private sandbox try-catch memory fallbacks, and E2E automated test runner (navigator.webdriver) LocalStorage session token telemetry with sequence diagrams.
- **[URL Metadata Extraction & Speaker Auto-Analysis Deep-Dive](details/url-metadata-extraction.md)**
  - Client-side two-tier caching pipeline (Memory Cache + LocalStorage safeStorage), Server-Side Request Forgery (SSRF) safety filters (loopback / private blocklist), Dual-Fetch localized fallback parameter stripping, cheerio-based server metadata scraping and author prefix cleansing, and Firebase Auth & AppCheck protected header handshakes with flowcharts and sequence diagrams.
- **[Timezone-Aware Streak Reminder System Deep-Dive](details/timezone-streak-reminders.md)**
  - Dynamic local hour mapping using Javascript Intl DateTimeFormat timezone APIs, 10-timezone query chunk partitions for Firestore compliance, timezone-aware sv-SE YYYY-MM-DD completion evaluations, language-localized multicast push notification pools, and self-healing dead token array removals with Firestore batch pruning with sequence diagrams.

---

## Design & UX
- **[UI/UX Design System](design-system.md)**
  - Global CSS tokens, visual design, and mobile-first rules.
  - Animation patterns and typography standards.

---

> [!TIP]
> Each document includes Mermaid diagrams to visualize data flow and interactions. For the best experience, view these in a tool that supports Mermaid rendering (like GitHub or a VS Code extension).
