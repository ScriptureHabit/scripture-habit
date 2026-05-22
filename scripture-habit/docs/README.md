# Technical Documentation Index

Welcome to the **scripture-habit** technical documentation. This directory contains deep-dives into the architecture, features, and core logic of the application.

---

## 📚 General Architecture
- **[Architecture & Structure](architecture.md)**
  - High-level directory overview.
  - Layer definitions (API, Internal, Backend, Frontend).
- **[Database & Security: The Foundation](database-security.md)**
  - Firestore structure and path-based permissions.
  - Email verification and AppCheck guards.
- **[App Check & API Protection](security-architecture.md)**
  - Gateway middleware guards, token validations, and development bypass policies.
- **[API Middleware Architecture & Standard Error Handling](api-middleware-error-handling.md)**
  - Express CORS validation, Vercel TrailingSlash fixes, rate limiting, custom AppError classes, and global Sentry tracking.
- **[Firebase Security Rules & CQRS Write Isolation](firebase-security-rules.md)**
  - Multi-tiered authentication shields, custom rules-bound validation limits, and backend-centric CQRS write restrictions.
- **[AI Context Guide & Development Charter](ai-context.md)**
  - Essential LLM directives and repository-wide system design constraints.
  - State boundaries, logic-component split principles, and transactional integrity rules.
- **[SEO & Dynamic Meta Management](seo-and-meta-management.md)**
  - Dynamic page indexing, robots meta rules, multi-lingual canonical paths, and Open Graph thumbnail rendering.

---

## 💬 Feature Deep-Dives
- **[Chat & Dashboard Synchronization](feature-chat-dashboard.md)**
  - Detailed explanation of real-time Firestore listeners.
  - The architectural separation of "Pure Data" and "UI Representation".
  - The mechanism behind unread status synchronization.
- **[AI Integration: Intelligence Layer](feature-ai-integration.md)**
  - Gemini 3.1 Flash-Lite integration details.
  - Translation, Weekly Recaps, and Automation.
- **[Notification System: Push & Delivery](feature-notifications.md)**
  - FCM token privacy vault separation, dynamic flag healing, and native SW installation.
  - Contextual OS tray control (streak reminder startup clearing and group-specific message removals).

---

## 🧪 Core Logic & Mechanisms
- **[Note Posting Mechanism](logic-note-posting.md)**
  - End-to-end flow of posting a note.
  - Detailed streak and level calculation logic.
- **[Gospel Library Mapper](gospel-library-mapper.md)**
  - Multi-lingual scripture and volume mapping engine.
  - Character normalization, regex chapter parsing, and deep-link verse highlights.
- **[Group Invites & Joining Pipeline](group-invites.md)**
  - Concurrency-safe group membership registration and transactional unique code generation.
  - Rate-limited join attempts, localized metadata preview cards, and expiration timelines.
- **[Inactivity & Auto-Kick Engine](inactivity-and-autokick.md)**
  - Evaluation thresholds, rotational scheduler, self-healing subcollections, and ownership transfer logic.
- **[URL Metadata & Speaker Extraction](url-metadata-extraction.md)**
  - Client-server pipeline for parsing page titles and speakers.
  - SSRF protection, Firebase security guards, and dual-fetch fallback handling.
  - Optimized two-tier caching (Memory + LocalStorage) and front-end hooks.
- **[I18n & Localization: Global Reach](logic-i18n.md)**
  - Frontend context and backend template systems.
  - Automated AU translation strategies.
- **[Unity Participation & Sync Architecture](unity-participation.md)**
  - Core math for group solidarity, real-time message sync client overrides, and triple-fallback joined-at eligibility filtering.
- **[Firestore Transactions & Counter Service Design](firestore-transactions-counters.md)**
  - Dynamic transaction read-before-write ordering, atomic multi-document updates, and distributed counter sharding.
- **[Incremental Book Suggestion Engine](incremental-book-suggestions.md)**
  - Multi-lingual Unicode normalization, Japanese Hiragana-to-Katakana phonetic code-shifting, and 4-tier sorting priorities.
- **[User Profile Sync & Reaction Anonymization](profile-sync-anonymization.md)**
  - High-performance propagation of user details to group chats and search indices.
  - Secure social identity anonymization replacing personal data with dummy values during account deletion.
- **[Timezone-Aware Streak Reminders](timezone-streak-reminders.md)**
  - Dynamic timezone target resolution using Javascript `Intl` libraries.
  - Partitioned query chunking, multi-lingual multicast, and self-healing FCM token pruning.

---

## 🛠️ Operations & Development
- **[Development & Environment Guide](development-guide.md)**
  - Local setup, mobile development (Capacitor), and deployment instructions.
- **[Technical Troubleshooting & FAQ](troubleshooting.md)**
  - Resolution paths for Capacitor loopback issues, Android clean-traffic configurations, AppCheck test bypasses, and keystore SHA-1 alignments.
- **[Testing & Reliability Guide](testing-guide.md)**
  - Unit and integration testing setup using Vitest, Firebase rule unit tests, and Playwright E2E automation.
- **[CI/CD & Maintenance Automation Guide](cicd-maintenance-automation.md)**
  - GitHub Actions continuous integration, local Java Firebase Emulators, Playwright pipeline runs, Vercel prod CD deployments, and daily inactivity scan Cron triggers.
- **[Capacitor App Signing & Release Guide](hybrid-mobile-release-guide.md)**
  - Mobile store release compilation, Android keystore bundle signatures, Google Auth SHA fingerprint registry, iOS provisioning profiles, and APNs certificate binds.
- **[Maintenance & Batch Jobs](maintenance-cron.md)**
  - Inactivity checks, owner transfers, and counter aggregation.
  - Archiving and self-healing mechanisms.
- **[Monitoring & Observability](monitoring-observability.md)**
  - Sentry integration, vConsole, and PWA lifecycle.
  - Error silencing and performance tracing.
- **[PWA & Capacitor Hybrid Mobile Lifecycle](hybrid-mobile-lifecycle.md)**
  - Service Worker background caching update prompts, iOS sharebar instruction overlays, and Capacitor emulator cleartext networking setup.
  - In-app WebView sandboxed browser checks and dynamic OS escape protocols (LINE external overrides, Android Chrome intents).
- **[Firestore Offline Persistence & Multi-Tab Sync](firestore-offline-persistence.md)**
  - IndexedDB cache configurations, multi-tab shared-locks, failover try-catch blocks, and automated runner webdriver optimizations.
- **[Client-Side Unity Midnight Reset Hook](client-unity-midnight-reset.md)**
  - React lifecycle hook executing sub-minute timezone date-flip polling.
  - OS sleep/wake sync focus hooks, dual-token authorization gateway handshakes.

---

## 🎨 Design & UX
- **[UI/UX Design System: Premium Aesthetics](design-system.md)**
  - Global CSS tokens, Glassmorphism, and mobile-first rules.
  - Animation patterns and typography standards.

---

> [!TIP]
> Each document includes Mermaid diagrams to visualize data flow and interactions. For the best experience, view these in a tool that supports Mermaid rendering (like GitHub or a VS Code extension).
