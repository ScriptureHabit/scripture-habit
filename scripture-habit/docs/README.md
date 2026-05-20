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
- **[AI Context Guide & Development Charter](ai-context.md)**
  - Essential LLM directives and repository-wide system design constraints.
  - State boundaries, logic-component split principles, and transactional integrity rules.

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
  - FCM token management (Public/Private).
  - Multicast delivery and token cleanup logic.

---

## 🧪 Core Logic & Mechanisms
- **[Note Posting Mechanism](logic-note-posting.md)**
  - End-to-end flow of posting a note.
  - Detailed streak and level calculation logic.
- **[I18n & Localization: Global Reach](logic-i18n.md)**
  - Frontend context and backend template systems.
  - Automated AU translation strategies.

---

## 🛠️ Operations & Development
- **[Development & Environment Guide](development-guide.md)**
  - Local setup, mobile development (Capacitor), and deployment instructions.
- **[Technical Troubleshooting & FAQ](troubleshooting.md)**
  - Resolution paths for Capacitor loopback issues, Android clean-traffic configurations, AppCheck test bypasses, and keystore SHA-1 alignments.
- **[Testing & Reliability Guide](testing-guide.md)**
  - Unit and integration testing setup using Vitest, Firebase rule unit tests, and Playwright E2E automation.
- **[Maintenance & Batch Jobs](maintenance-cron.md)**
  - Inactivity checks, owner transfers, and counter aggregation.
  - Archiving and self-healing mechanisms.
- **[Monitoring & Observability](monitoring-observability.md)**
  - Sentry integration, vConsole, and PWA lifecycle.
  - Error silencing and performance tracing.

---

## 🎨 Design & UX
- **[UI/UX Design System: Premium Aesthetics](design-system.md)**
  - Global CSS tokens, Glassmorphism, and mobile-first rules.
  - Animation patterns and typography standards.

---

> [!TIP]
> Each document includes Mermaid diagrams to visualize data flow and interactions. For the best experience, view these in a tool that supports Mermaid rendering (like GitHub or a VS Code extension).
