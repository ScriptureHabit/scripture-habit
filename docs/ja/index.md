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
  - title: Webアーキテクチャ
    details: React + Vite + TypeScript フロントエンド、Express & Vercel Serverless バックエンド、CQRSに基づいたFirestore設計。
    link: /ja/architecture
  - title: セキュリティ設計
    details: App Check検証、Firestoreセキュリティルール、レート制限、プライベートデータの分離管理。
    link: /ja/database-security
  - title: チャット & ストリーク同期
    details: Firestoreリスナー、バケットアーカイブ、タイムゾーンを考慮した深夜リセットロジック。
    link: /ja/feature-chat-dashboard
  - title: AI機能 (Gemini)
    details: Gemini 3.1 Flash-Lite を活用した振り返り手紙、質問提案、AIパートナー投稿。
    link: /ja/feature-ai-integration
  - title: 多言語対応 (i18n) & 聖典マッパー
    details: 11言語のローカライズ、ひらがな/カタカナ音声変換サジェスト、福音ライブラリへのディープリンク。
    link: /ja/logic-i18n
  - title: CI/CD & 運用
    details: GitHub Actions、エミュレータによるテスト、Playwright E2E、日次Cronによる定期メンテナンス。
    link: /ja/cicd-maintenance-automation
---
