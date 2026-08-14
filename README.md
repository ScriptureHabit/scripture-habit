# Scripture Habit

English | [日本語](README.ja.md)

A community web application featuring AI real-time translation & group features to make daily scripture study a habit together with friends.

 **Web Application**: [https://scripturehabit.app](https://scripturehabit.app)

<p align="center">
  <img src="https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-7.0%20(Native)-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript 7.0" />
  <img src="https://img.shields.io/badge/Node.js-26.0-5FA04E?style=for-the-badge&logo=nodedotjs" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express-5.0-000000?style=for-the-badge&logo=express" alt="Express 5.0" />
  <img src="https://img.shields.io/badge/Firebase-Firestore%2FAuth-FFCA28?style=for-the-badge&logo=firebase" alt="Firebase" />
</p>

---

## Overview

**Scripture Habit** is a web application designed to help people consistently and enjoyably study scriptures together with friends, overcoming the common tendency to give up when studying alone. In addition to levels and consecutive study streak mechanisms, it features AI-powered automatic translation, enabling members to share study notes in groups across different countries and languages.

### Background & Motivation
- **Problem**: Daily solo study is difficult to maintain continuously, and language barriers make studying with friends overseas challenging.
- **Solution**: Built an environment where study habits are formed through group features and streak management, and members speaking different languages can interact seamlessly via Gemini AI real-time translation.

---

## Operational Data

The application is actively deployed and in operation, tracking daily active users studying scriptures. Currently, an average of 10+ users post study notes daily on a continuous basis.

- 📈 **[Daily Note-Posting Active Users (Google Sheet)](https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/edit?usp=sharing)**

---

## Key Features

### 1. Dashboard
<p align="center">
  <img src="./docs/images/en-dashboard.png" width="340" alt="Dashboard" />
</p>

- **Level & Streak Display**: Experience visible growth as continuous study days (streaks) and levels increase with daily note creation.
- **Today's Reading Guide**: Automatically displays the recommended reading passage for the day, allowing users to open the target page with a single tap.

---

### 2. Note Creation
<p align="center">
  <img src="./docs/images/en-create-note.png" width="320" alt="Note Creation" />
</p>

- **Note Editor**: Record and save daily insights and reflection notes.
- **Atomic Update Processing**: Executes a Firestore transaction upon saving a note to atomically handle streak calculation, chat synchronization, and user data updates.

---

### 3. My Notes & Reflection
<p align="center">
  <img src="./docs/images/en-my-notes.png" width="250" alt="My Notes" />
  <img src="./docs/images/en-weekly-letter.png" width="250" alt="Weekly Letter" />
</p>

- **Search & Filtering**: Instantly search past study notes by tags or keywords.
- **AI Weekly Letter**: Gemini AI analyzes a week's worth of note entries to deliver personalized reflection feedback.

---

### 4. Group Chat & Multi-language Support
<p align="center">
  <img src="./docs/images/en-group-chat.png" width="250" alt="Group Chat" />
  <img src="./docs/images/en-languages.png" width="250" alt="Language Settings" />
</p>

- **Automatic Scripture Link Conversion**: Automatically converts scripture references in chat messages into easy-to-read interactive links.
- **AI Real-Time Translation**: Instantly and automatically translates messages and user names from international group members.

---

### 5. Habit Rules & Settings
<p align="center">
  <img src="./docs/images/en-habit-rule.png" width="230" alt="Habit Rules" />
  <img src="./docs/images/en-profile.png" width="230" alt="Profile" />
  <img src="./docs/images/en-setting.png" width="230" alt="Settings" />
</p>

- **Personal Habit Rules**: Set custom study rules to maintain motivation and prevent routines from becoming monotonous.
- **Profile Settings**: Flexibly customize avatar, language, notification preferences, and more.

---

## Technical Highlights & Solved Challenges

### 1. Fixing Unread Anchor Misalignment When Posting Notes Without Opening Chat

- **Problem**:  
  Standard chat applications assume users "open the chat to mark messages as read." However, in Scripture Habit, a specific user behavior pattern emerged where users "post study notes daily directly from the dashboard without opening the chat room."  
  In this scenario, the last-read position remained stuck at an old timestamp. When the user eventually opened the chat after several days, the unread message anchor was misplaced significantly.

- **Solution**:  
  - **Read Timestamp Update on Note Submission**:  
    Modified the Firestore transaction during note saving to automatically update `lastReadTimestamp`, treating "posting a note" as active application engagement.
  - **Pure Function for Unread Anchor Calculation (`computeUnreadAnchorId`)**:  
    Created a pure helper function that sorts fetched messages chronologically and identifies the first message received after the most recent note submission timestamp as the unread anchor.
  - **Unit Testing with Vitest**:  
    Wrote 6 display scenario tests (e.g., posting notes without opening chat, mixed read/unread states) to verify correct behavior.

### 2. Reducing Unnecessary Re-renders via Split Context
- **Problem**: Storing all global state in a single React Context caused full component tree re-renders whenever a new chat message was received, threatening input performance.
- **Solution**: Separated state and actions into 4 distinct contexts (`DataContext`, `MessageActionsContext`, `GroupActionsContext`, `UIActionsContext`), preventing unnecessary re-renders of unrelated components.

---

## Security & Testing

- **Security**: Firebase AppCheck and Zod input validation
- **Error Monitoring**: Sentry integration for real-time production error logging
- **Testing**: Vitest (Unit testing) and Playwright (E2E testing) to prevent regressions

---

## Tech Stack

| Category | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript 7.0 (Native), Vite 8.1, Vanilla CSS |
| **State Management** | React Context (Split Context), `useReducer`, Zustand |
| **Backend API** | Node.js 26.0, Express 5.0, Vercel Serverless Functions |
| **Database / Auth** | Google Cloud Firestore, Firebase Authentication, Firebase AppCheck |
| **AI** | Google Gemini API (Automatic Translation & Weekly Letter Generation) |
| **API Documentation** | OpenAPI 3.0, Swagger UI (`/api/docs`) |
| **Testing** | Vitest (Unit), Playwright (E2E) |

### Database Schema (ER Diagram)
<p align="center">
  <img src="./docs/images/ER-diagram.png" width="850" alt="ER Diagram" />
</p>

### Directory Architecture
<p align="center">
  <img src="./docs/images/directory-path-architecture.png" width="850" alt="Directory Architecture" />
</p>

---

## API Documentation (Swagger UI)

Public Swagger UI conforming to OpenAPI 3.0 specification is available:

- **[Swagger UI Screen](https://scripturehabit.app/api/docs)**: `https://scripturehabit.app/api/docs`
- **[OpenAPI JSON](https://scripturehabit.app/api/openapi.json)**: `https://scripturehabit.app/api/openapi.json`

---

## Documentation

### English Version
- **[Technical Documentation Index](./docs/README.md)**
- **[Development & Setup Guide](./docs/development-guide.md)**
- **[Architecture & Structure](./docs/architecture.md)**
- **[Chat & Dashboard Sync](./docs/feature-chat-dashboard.md)**
- **[Note Posting Mechanism](./docs/logic-note-posting.md)**

### 日本語版 (Japanese Version)
- **[ドキュメント目次](./docs/ja/README.md)**
- **[開発および環境セットアップガイド](./docs/ja/development-guide.md)**
- **[アーキテクチャ設計書](./docs/ja/architecture.md)**
- **[チャット & ダッシュボード同期設計](./docs/ja/feature-chat-dashboard.md)**
- **[ノート投稿 & ストリーク計算ロジック](./docs/ja/logic-note-posting.md)**

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.


