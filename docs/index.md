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
  - title: Web Architecture
    details: React + Vite + TypeScript frontend with Express & Vercel Serverless API layer and CQRS-based Firestore design.
    link: /architecture
  - title: Security Architecture
    details: App Check verification, Firebase security rules, rate limiting, and private data isolation.
    link: /database-security
  - title: Chat & Streak Sync
    details: Firestore listeners, bucket archiving, and timezone-aware midnight streak calculation.
    link: /feature-chat-dashboard
  - title: AI Integration (Gemini)
    details: Gemini 3.1 Flash-Lite for weekly recaps, scripture question prompts, and AI partner notes.
    link: /feature-ai-integration
  - title: Internationalization (i18n) & Scripture Mapper
    details: 11 supported languages with dynamic locale resolution, scripture phonetics, and Gospel Library deep linking.
    link: /logic-i18n
  - title: CI/CD & Operations
    details: GitHub Actions with emulated Firebase tests, Playwright E2E suites, and daily cron maintenance.
    link: /cicd-maintenance-automation
---
