---
layout: home

hero:
  name: "Scripture Habit"
  text: "Technical Documentation"
  tagline: "Architecture, Security, CQRS, Realtime Sync & Batch Operations"
  image:
    src: /images/dashboard.png
    alt: Scripture Habit Dashboard
  actions:
    - theme: brand
      text: Get Started (Architecture)
      link: /architecture
    - theme: alt
      text: Core Logic
      link: /logic-note-posting
    - theme: alt
      text: View App
      link: https://scripturehabit.app

features:
  - title: Modern Web Architecture
    details: React + Vite + TypeScript frontend with Express & Vercel Serverless API layer and strict CQRS Firestore design.
    link: /architecture
  - title: Enterprise-Grade Security
    details: App Check verification, Firebase security rules, rate limiting, and dual-layer data isolation.
    link: /database-security
  - title: Realtime Chat & Streak Sync
    details: Optimized Firestore listeners, bucket archiving patterns, and timezone-aware midnight streak calculation.
    link: /feature-chat-dashboard
  - title: AI Automation
    details: Gemini 3.1 Flash-Lite integration for weekly recaps, scripture reflection generation, and automated note posts.
    link: /feature-ai-integration
  - title: Global Reach & I18n
    details: 10+ supported languages with dynamic locale resolution, gospel book phonetics, and multi-lingual scripture mapping.
    link: /logic-i18n
  - title: Automated CI/CD & Operations
    details: GitHub Actions with emulated Firebase unit/rule tests, Playwright E2E suites, and automated cron maintenance.
    link: /cicd-maintenance-automation
---
