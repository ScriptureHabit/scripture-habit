---
layout: home

hero:
  name: "Scripture Habit"
  text: "技術ドキュメント"
  tagline: "アーキテクチャ・セキュリティ・CQRS・リアルタイム同期・運用バッチ設計"
  image:
    src: /images/dashboard.png
    alt: Scripture Habit ダッシュボード
  actions:
    - theme: brand
      text: アーキテクチャ概要を読む
      link: /ja/architecture
    - theme: alt
      text: コアロジック解説
      link: /ja/logic-note-posting
    - theme: alt
      text: アプリを開く
      link: https://scripturehabit.app

features:
  - title: モダンWebアーキテクチャ
    details: React + Vite + TypeScript フロントエンド、Express & Vercel Serverless バックエンド、CQRSに基づいたFirestore設計。
    link: /ja/architecture
  - title: 堅牢なセキュリティ設計
    details: App Check検証、厳格なFirestoreセキュリティルール、レート制限、プライベートデータの完全隔離。
    link: /ja/database-security
  - title: リアルタイム同期 & ストリーク
    details: Firestore最適化リスナー、バケットアーカイブパターン、タイムゾーンを考慮した深夜リセットロジック。
    link: /ja/feature-chat-dashboard
  - title: AI自動化 (Gemini)
    details: Gemini 3.1 Flash-Lite を活用した週次振り返り生成、聖句の問いかけ提案、AIボットの自動投稿。
    link: /ja/feature-ai-integration
  - title: 多言語化 (i18n) & 聖典マッパー
    details: 10言語以上の動的ローカライズ、ひらがな/カタカナ音声変換サジェスト、福音ライブラリへのディープリンク。
    link: /ja/logic-i18n
  - title: 自動化された CI/CD & 運用
    details: GitHub Actions、エミュレータによるルール/結合テスト、Playwright E2E、日次クローンによる自己修復バッチ。
    link: /ja/cicd-maintenance-automation
---
